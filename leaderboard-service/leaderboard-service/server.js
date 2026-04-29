const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "leaderboard.json");
const MAX_SCORE = 9999;
const MAX_ENTRIES_RETURNED = 20;

app.use(cors());
app.use(express.json());

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
  } catch (error) {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

async function readLeaderboard() {
  await ensureDataFile();

  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    const leaderboard = JSON.parse(data);

    if (!Array.isArray(leaderboard)) {
      return [];
    }

    return leaderboard;
  } catch (error) {
    console.error("Failed to read leaderboard data:", error.message);
    return [];
  }
}

async function writeLeaderboard(leaderboard) {
  await ensureDataFile();

  const temporaryFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(leaderboard, null, 2), "utf8");
  await fs.rename(temporaryFile, DATA_FILE);
}

function isValidUsername(username) {
  return (
    typeof username === "string" &&
    username.trim().length > 0 &&
    username.trim().length <= 30
  );
}

function isValidScore(score) {
  return (
    typeof score === "number" &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= MAX_SCORE
  );
}

function sortLeaderboard(leaderboard) {
  return leaderboard.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });
}

app.get("/", (req, res) => {
  res.json({
    service: "Global Leaderboard Microservice",
    status: "running",
    endpoints: {
      health: "GET /health",
      submitScore: "POST /score",
      leaderboard: "GET /leaderboard",
      clearDemoData: "DELETE /leaderboard"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "leaderboard-service",
    timestamp: new Date().toISOString()
  });
});

app.post("/score", async (req, res) => {
  try {
    const { username, score } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: "Invalid username. Username must be a non-empty string with at most 30 characters."
      });
    }

    if (!isValidScore(score)) {
      return res.status(400).json({
        error: `Invalid score. Score must be an integer between 0 and ${MAX_SCORE}.`
      });
    }

    const leaderboard = await readLeaderboard();

    const newEntry = {
      username: username.trim(),
      score,
      submittedAt: new Date().toISOString()
    };

    const existingEntry = leaderboard.find(
      (entry) => entry.username === newEntry.username
    );

    if (existingEntry) {
      if (newEntry.score > existingEntry.score) {
        existingEntry.score = newEntry.score;
        existingEntry.submittedAt = newEntry.submittedAt;
      }
    } else {
      leaderboard.push(newEntry);
    }

    const sortedLeaderboard = sortLeaderboard(leaderboard);

    await writeLeaderboard(sortedLeaderboard);

    res.status(201).json({
      message: "Score saved successfully.",
      entry: newEntry,
      leaderboard: sortedLeaderboard.slice(0, MAX_ENTRIES_RETURNED)
    });
  } catch (error) {
    console.error("Failed to save score:", error.message);
    res.status(500).json({
      error: "Internal server error while saving the score."
    });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await readLeaderboard();
    const sortedLeaderboard = sortLeaderboard(leaderboard);

    res.json({
      leaderboard: sortedLeaderboard.slice(0, MAX_ENTRIES_RETURNED),
      totalEntries: sortedLeaderboard.length
    });
  } catch (error) {
    console.error("Failed to get leaderboard:", error.message);
    res.status(500).json({
      error: "Internal server error while reading the leaderboard."
    });
  }
});

/*
  This endpoint is mainly for the course demo and testing.
  It allows the group to reset the leaderboard before recording the video.
*/
app.delete("/leaderboard", async (req, res) => {
  try {
    await writeLeaderboard([]);

    res.json({
      message: "Leaderboard cleared successfully."
    });
  } catch (error) {
    console.error("Failed to clear leaderboard:", error.message);
    res.status(500).json({
      error: "Internal server error while clearing the leaderboard."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found."
  });
});

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`Leaderboard microservice is running on port ${PORT}`);
  });
});
