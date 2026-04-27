# Global Leaderboard Microservice

This is the leaderboard microservice for the Distributed Systems trivia project.

It is a separate REST API service. It receives the player's username and final score from the frontend, stores the score in persistent JSON file storage, sorts all results, and returns the global leaderboard for the front page.

## Why this is a microservice

The leaderboard logic is separated from the frontend and main backend. Other parts of the system only need to call the REST API. The internal storage and sorting logic can be changed later without changing the whole application.

This supports:

- microservice-based design
- REST communication
- openness through a clear JSON API
- scalability because the leaderboard can be deployed separately
- failure isolation because the game can still run if the leaderboard is unavailable

## Requirements

Install Node.js first.

## How to run

Open this folder in a terminal and run:

```bash
npm install
npm start
```

The service runs on:

```text
http://localhost:3001
```

## API endpoints

### 1. Health check

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "service": "leaderboard-service",
  "timestamp": "2026-04-27T10:00:00.000Z"
}
```

### 2. Submit score

```http
POST /score
```

Request body:

```json
{
  "username": "Wenrui",
  "score": 3
}
```

Rules:

- username must not be empty
- score must be an integer from 0 to 4
- there are 4 questions in the current trivia game

Example response:

```json
{
  "message": "Score saved successfully.",
  "entry": {
    "username": "Wenrui",
    "score": 3,
    "submittedAt": "2026-04-27T10:00:00.000Z"
  },
  "leaderboard": []
}
```

### 3. Get global leaderboard

```http
GET /leaderboard
```

Example response:

```json
{
  "leaderboard": [
    {
      "username": "Wenrui",
      "score": 3,
      "submittedAt": "2026-04-27T10:00:00.000Z"
    }
  ],
  "totalEntries": 1
}
```

### 4. Clear leaderboard for demo

```http
DELETE /leaderboard
```

This is mainly for testing and demo recording.

## How to connect from frontend

When the game ends, the frontend can send the username and score to the service:

```javascript
async function submitScore(username, score) {
  const response = await fetch("http://localhost:3001/score", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, score })
  });

  if (!response.ok) {
    throw new Error("Failed to submit score");
  }

  return response.json();
}
```

To show the leaderboard on the front page:

```javascript
async function getLeaderboard() {
  const response = await fetch("http://localhost:3001/leaderboard");

  if (!response.ok) {
    throw new Error("Failed to load leaderboard");
  }

  return response.json();
}
```

## Persistent storage

The submitted scores are stored in:

```text
data/leaderboard.json
```

This means the leaderboard is not only stored in application memory.
