use futures::{StreamExt, SinkExt};
use serde::{Serialize, Deserialize};
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};

#[derive(Serialize, Deserialize, Debug)]
struct ClientMessage {
    nick: String,
    answer: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ServerMessage {
    question: String,
    correct_users: Vec<String>,
    scores: Vec<(String, u32)>,
}

async fn handle_client(
    stream: TcpStream,
    question: Arc<String>,
    scores: Arc<Mutex<Vec<(String, u32)>>>,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("WebSocket handshake failed: {:?}", e);
            return;
        }
    };

    let (mut write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                eprintln!("WebSocket error: {:?}", e);
                break;
            }
        };

        // Only handle text frames
        let text = match msg.to_text() {
            Ok(t) if !t.trim().is_empty() => t,
            _ => continue, // skip empty or non-text frames
        };

        // Parse JSON safely
        let client_msg: ClientMessage = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Invalid JSON: {:?}", e);
                continue;
            }
        };

        let correct_answer = 2;

        // ---- LOCK SECTION ----
        let (correct_users, scores_snapshot) = {
            let mut scores_lock = scores.lock().unwrap();

            // Update score
            let mut found = false;
            for (nick, score) in scores_lock.iter_mut() {
                if *nick == client_msg.nick {
                    if client_msg.answer == correct_answer {
                        *score += 1;
                    }
                    found = true;
                }
            }

            if !found {
                scores_lock.push((
                    client_msg.nick.clone(),
                    if client_msg.answer == correct_answer { 1 } else { 0 },
                ));
            }

            let correct_users: Vec<String> = scores_lock
                .iter()
                .filter(|(_, s)| *s > 0)
                .map(|(nick, _)| nick.clone())
                .collect();

            let snapshot = scores_lock.clone();

            (correct_users, snapshot)
        };
        // ---- LOCK DROPPED ----

        let response = ServerMessage {
            question: question.to_string(),
            correct_users,
            scores: scores_snapshot,
        };

        let json = serde_json::to_string(&response).unwrap();

        if let Err(e) = write.send(Message::Text(json)).await {
            eprintln!("Failed to send message: {:?}", e);
            break;
        }
    }

    println!("Client disconnected");
}

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("0.0.0.0:9001").await.unwrap();
    println!("WebSocket server running on ws://localhost:9001");

    let question = Arc::new("What is 1 + 1? (1-4)".to_string());
    let scores = Arc::new(Mutex::new(Vec::<(String, u32)>::new()));

    loop {
        let (stream, _) = listener.accept().await.unwrap();

        let q = Arc::clone(&question);
        let s = Arc::clone(&scores);

        tokio::spawn(async move {
            handle_client(stream, q, s).await;
        });
    }
}
