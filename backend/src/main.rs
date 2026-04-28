use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};

type Tx = tokio::sync::mpsc::UnboundedSender<Message>;
type Rooms = Arc<Mutex<HashMap<String, RoomState>>>;

#[derive(Serialize, Deserialize, Debug)]
struct ClientMessage {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    room: String,
    username: String,
    answer: Option<String>, // frontend sends the chosen answer text
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ServerMessage {
    #[serde(rename = "type")]
    msg_type: String,
    question: String,
    correct_users: Vec<String>,
    scores: Vec<(String, u32)>,
    #[serde(skip_serializing_if = "Option::is_none")]
    correct_answer: Option<String>,
}

#[derive(Clone)]
struct TriviaQuestion {
    question: String,
    correct_answer: String,
    answers: Vec<String>,
}

#[derive(Clone)]
struct RoomState {
    current_question: Option<TriviaQuestion>,
    question_queue: VecDeque<TriviaQuestion>,
    scores: Vec<(String, u32)>,
    clients: Vec<Tx>,
    answered: Vec<String>,
}

#[derive(Deserialize)]
struct OpenTdbResponse {
    response_code: u32,
    results: Vec<OpenTdbQuestion>,
}

#[derive(Deserialize)]
struct OpenTdbQuestion {
    question: String,
    correct_answer: String,
    incorrect_answers: Vec<String>,
}

async fn fetch_questions(amount: usize) -> Vec<TriviaQuestion> {
    println!("\n[OpenTDB] Fetching {} questions...", amount);

    let url = format!("https://opentdb.com/api.php?amount={}&type=multiple", amount);

    for attempt in 0..3 {
        let resp = reqwest::get(&url).await;
        if let Err(err) = resp {
            eprintln!("[OpenTDB] Request failed (attempt {}): {:?}", attempt + 1, err);
            continue;
        }

        let resp = resp.unwrap();
        if !resp.status().is_success() {
            eprintln!("[OpenTDB] HTTP error (attempt {}): {}", attempt + 1, resp.status());
            continue;
        }

        let full_resp: Result<OpenTdbResponse, _> = resp.json().await;
        if let Err(err) = full_resp {
            eprintln!("[OpenTDB] JSON parse error (attempt {}): {:?}", attempt + 1, err);
            continue;
        }

        let full_resp = full_resp.unwrap();
        if full_resp.response_code != 0 || full_resp.results.is_empty() {
            eprintln!("[OpenTDB] API error (attempt {}), response_code: {}, results len: {}", attempt + 1, full_resp.response_code, full_resp.results.len());
            continue;
        }

        let questions = full_resp
            .results
            .into_iter()
            .map(|q| {
                let mut answers = q.incorrect_answers.clone();
                answers.push(q.correct_answer.clone());
                TriviaQuestion {
                    question: q.question,
                    correct_answer: q.correct_answer,
                    answers,
                }
            })
            .collect();

        return questions;
    }

    eprintln!("[OpenTDB] All retries failed, using fallback questions");
    let fallback = TriviaQuestion {
        question: "What is the capital of France?".to_string(),
        correct_answer: "Paris".to_string(),
        answers: vec![
            "London".to_string(),
            "Berlin".to_string(),
            "Madrid".to_string(),
            "Paris".to_string(),
        ],
    };
    vec![fallback; amount]
}

async fn handle_client(stream: TcpStream, rooms: Rooms) {

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(_e) => {
            return;
        }
    };
    println!("\n[Server] New client connected");

    let (mut ws_write, mut ws_read) = ws_stream.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

    let tx_for_cleanup = tx.clone();
    let rooms_for_cleanup = rooms.clone();

    // Task: send messages to client
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Task: read messages from client
    let read_task = tokio::spawn(async move {
        while let Some(msg) = ws_read.next().await {
            let msg = match msg {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[Error] WebSocket error: {:?}", e);
                    break;
                }
            };

            let text = match msg.to_text() {
                Ok(t) if !t.trim().is_empty() => t,
                _ => continue,
            };

            println!("\n[Server] Incoming message: {}", text);

            let client_msg: ClientMessage = match serde_json::from_str(text) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("[Error] Invalid JSON: {:?}", e);
                    continue;
                }
            };

            println!(
                "[Room {}] {} sent: {:?}",
                client_msg.room, client_msg.username, client_msg
            );

            // Ensure room exists
            let mut need_new_question = false;

            {
                let mut rooms_lock = rooms.lock().unwrap();

                if !rooms_lock.contains_key(&client_msg.room) {
                    println!("[Room {}] Creating new room", client_msg.room);
                    need_new_question = true;

                    rooms_lock.insert(
                        client_msg.room.clone(),
                        RoomState {
                            current_question: None,
                            question_queue: VecDeque::new(),
                            scores: Vec::new(),
                            clients: Vec::new(),
                            answered: Vec::new(),
                        },
                    );
                }

                // Add client to room
                let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                if !room.clients.iter().any(|c| c.same_channel(&tx)) {
                    println!("[Room {}] {} joined the room", client_msg.room, client_msg.username);
                    room.clients.push(tx.clone());
                }
            }

            // Fetch a batch of questions if room was new
            if need_new_question {
                let questions = fetch_questions(10).await;
                let mut rooms_lock = rooms.lock().unwrap();
                let room = rooms_lock.get_mut(&client_msg.room).unwrap();

                let mut queue: VecDeque<TriviaQuestion> = questions.into_iter().collect();
                let first_question = queue.pop_front().unwrap();

                room.current_question = Some(first_question.clone());
                room.question_queue = queue;

                println!("[Room {}] Loaded first question", client_msg.room);

                let payload = serde_json::to_string(&serde_json::json!({
                    "type": "new_question",
                    "question": first_question.question,
                    "answers": first_question.answers
                }))
                .unwrap();

                let msg = Message::Text(payload);

                for client in room.clients.iter() {
                    let _ = client.send(msg.clone());
                }
            }

            // Handle join message
            if client_msg.msg_type.as_deref() == Some("join") {
                let current_q = {
                    let rooms_lock = rooms.lock().unwrap();
                    if let Some(room) = rooms_lock.get(&client_msg.room) {
                        room.current_question.clone()
                    } else {
                        None
                    }
                };

                if let Some(q) = current_q {
                    let payload = serde_json::to_string(&serde_json::json!({
                        "type": "new_question",
                        "question": q.question,
                        "answers": q.answers
                    })).unwrap();
                    let _ = tx.send(Message::Text(payload));
                }
                continue;
            }
            // Must be answer message
            if client_msg.msg_type.as_deref() != Some("answer") {
                continue;
            }

            let answer = client_msg.answer.as_ref().unwrap();
            // Handle answer
            let all_answered;
            let response_to_broadcast: Option<ServerMessage>;
            let mut new_question_payload: Option<(String, Vec<String>)> = None;

            {
                let mut rooms_lock = rooms.lock().unwrap();
                let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                let current_question = room
                    .current_question
                    .as_ref()
                    .expect("current question must exist");

                // Score update
                let is_correct = answer == &current_question.correct_answer;

                if is_correct {
                    println!("[Room {}] {} answered CORRECTLY!", client_msg.room, client_msg.username);
                } else {
                    println!("[Room {}] {} answered WRONG!", client_msg.room, client_msg.username);
                }

                let mut found = false;
                for (username, score) in room.scores.iter_mut() {
                    if *username == client_msg.username {
                        if is_correct {
                            *score += 1;
                        }
                        found = true;
                    }
                }

                if !found {
                    room.scores.push((
                        client_msg.username.clone(),
                        if is_correct { 1 } else { 0 },
                    ));
                }

                // Mark answered
                if !room.answered.contains(&client_msg.username) {
                    room.answered.push(client_msg.username.clone());
                }

                println!(
                    "[Room {}] Answered count: {}/{}",
                    client_msg.room,
                    room.answered.len(),
                    room.clients.len()
                );

                // Prepare score update
                let correct_users: Vec<String> = room
                    .scores
                    .iter()
                    .filter(|(_, s)| *s > 0)
                    .map(|(username, _)| username.clone())
                    .collect();

                response_to_broadcast = Some(ServerMessage {
                    msg_type: "scores_update".to_string(),
                    question: current_question.question.clone(),
                    correct_users,
                    scores: room.scores.clone(),
                    correct_answer: Some(current_question.correct_answer.clone()),
                });

                // Check if all answered
                all_answered = room.answered.len() == room.clients.len();

                if all_answered {
                    println!("[Room {}] All players answered!", client_msg.room);
                }
            }

            // Broadcast score update
            if let Some(resp) = response_to_broadcast {
                let json = serde_json::to_string(&resp).unwrap();
                let msg = Message::Text(json);

                let rooms_lock = rooms.lock().unwrap();
                let room = rooms_lock.get(&client_msg.room).unwrap();

                for client in room.clients.iter() {
                    let _ = client.send(msg.clone());
                }
            }

            // Fetch next question when the round is complete
            if all_answered {
                let next_question: Option<TriviaQuestion>;
                let mut need_more_questions = false;

                {
                    let mut rooms_lock = rooms.lock().unwrap();
                    let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                    next_question = room.question_queue.pop_front();
                    if room.question_queue.len() < 3 {
                        need_more_questions = true;
                    }
                }

                if let Some(next) = next_question {
                    {
                        let mut rooms_lock = rooms.lock().unwrap();
                        let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                        room.current_question = Some(next.clone());
                        room.answered.clear();
                    }

                    new_question_payload = Some((next.question.clone(), next.answers.clone()));

                    if need_more_questions {
                        let questions = fetch_questions(10).await;
                        let mut rooms_lock = rooms.lock().unwrap();
                        let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                        room.question_queue.extend(questions);
                    }
                } else {
                    let mut questions = fetch_questions(10).await;
                    let next = questions.remove(0);
                    let queue: VecDeque<TriviaQuestion> = questions.into_iter().collect();

                    {
                        let mut rooms_lock = rooms.lock().unwrap();
                        let room = rooms_lock.get_mut(&client_msg.room).unwrap();
                        room.current_question = Some(next.clone());
                        room.question_queue = queue;
                        room.answered.clear();
                    }

                    new_question_payload = Some((next.question.clone(), next.answers.clone()));
                }
            }

            // Broadcast new question
            if let Some((q, answers)) = new_question_payload {
                println!("[Room {}] Broadcasting NEW QUESTION", client_msg.room);

                let payload = serde_json::to_string(&serde_json::json!({
                    "type": "new_question",
                    "question": q,
                    "answers": answers
                }))
                .unwrap();

                let msg = Message::Text(payload);

                let rooms_lock = rooms.lock().unwrap();
                let room = rooms_lock.get(&client_msg.room).unwrap();

                for client in room.clients.iter() {
                    let _ = client.send(msg.clone());
                }
            }
        }
    });

    tokio::select! {
        _ = write_task => (),
        _ = read_task => (),
    }

    // Cleanup
    {
        let mut rooms_lock = rooms_for_cleanup.lock().unwrap();
        for (_, room) in rooms_lock.iter_mut() {
            room.clients.retain(|c| !c.same_channel(&tx_for_cleanup));
        }
    }

    println!("[Server] Client disconnected");
}

#[tokio::main]
async fn main() {
    // Render provides a PORT environment variable.
    // Locally, we fall back to 9001.
    let port = std::env::var("PORT").unwrap_or_else(|_| "9001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let listener = TcpListener::bind(&addr).await.unwrap();

    println!("[Server] Running on ws://0.0.0.0:{}", port);

    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));

    loop {
        let (stream, _) = listener.accept().await.unwrap();
        let rooms_clone = rooms.clone();

        tokio::spawn(async move {
            handle_client(stream, rooms_clone).await;
        });
    }
}

