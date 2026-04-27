use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
}

#[derive(Clone)]
struct RoomState {
    question: String,
    correct_answer: String,
    answers: Vec<String>,
    scores: Vec<(String, u32)>,
    clients: Vec<Tx>,
    answered: Vec<String>,
}

#[derive(Deserialize)]
struct OpenTdbResponse {
    results: Vec<OpenTdbQuestion>,
}

#[derive(Deserialize)]
struct OpenTdbQuestion {
    question: String,
    correct_answer: String,
    incorrect_answers: Vec<String>,
}

async fn fetch_question() -> (String, String, Vec<String>) {
    println!("\n[OpenTDB] Fetching new question...");

    let url = "https://opentdb.com/api.php?amount=1&type=multiple";

    let resp: OpenTdbResponse = reqwest::get(url)
        .await
        .expect("failed to fetch question")
        .json()
        .await
        .expect("failed to parse question");

    let q = &resp.results[0];

    println!("[OpenTDB] Question: {}", q.question);
    println!("[OpenTDB] Correct answer: {}", q.correct_answer);
    println!("[OpenTDB] Incorrect answers: {:?}", q.incorrect_answers);

    let mut answers = q.incorrect_answers.clone();
    answers.push(q.correct_answer.clone());

    (q.question.clone(), q.correct_answer.clone(), answers)
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
                            question: String::new(),
                            correct_answer: String::new(),
                            answers: Vec::new(),
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

            // Fetch question if room was new
            if need_new_question {
                let (q, correct, answers) = fetch_question().await;

                let mut rooms_lock = rooms.lock().unwrap();
                let room = rooms_lock.get_mut(&client_msg.room).unwrap();

                room.question = q.clone();
                room.correct_answer = correct.clone();
                room.answers = answers.clone();

                println!("[Room {}] Loaded first question", client_msg.room);

                // Broadcast new question
                let payload = serde_json::to_string(&serde_json::json!({
                    "type": "new_question",
                    "question": q,
                    "answers": answers
                }))
                .unwrap();

                let msg = Message::Text(payload);

                for client in room.clients.iter() {
                    let _ = client.send(msg.clone());
                }
            }

            // Skip if join message
            if client_msg.msg_type.as_deref() == Some("join") {
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

                // Score update
                let is_correct = answer == &room.correct_answer;

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
                    question: room.question.clone(),
                    correct_users,
                    scores: room.scores.clone(),
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

            // Fetch new question if needed
            if all_answered {
                let (q, correct, answers) = fetch_question().await;

                {
                    let mut rooms_lock = rooms.lock().unwrap();
                    let room = rooms_lock.get_mut(&client_msg.room).unwrap();

                    room.question = q.clone();
                    room.correct_answer = correct.clone();
                    room.answers = answers.clone();
                    room.answered.clear();
                }

                new_question_payload = Some((q, answers));
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

