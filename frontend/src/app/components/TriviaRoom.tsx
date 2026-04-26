import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import PlayerList from "./PlayerList";
import type { Player } from "./PlayerList";
import GameTimer from "./GameTimer";
import { Chat } from "./Chat";

// Mock game states
type GamePhase = "WAITING" | "QUESTION" | "REVEAL" | "LEADERBOARD";

export default function TriviaGameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [serverMsg, setServerMsg] = useState(null);

  // Game state
  const [phase, setPhase] = useState<GamePhase>("WAITING");
  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "Alice", score: 0 },
    { id: "2", name: "Bob", score: 0 },
  ]);
  const [currentQuestion, setCurrentQuestion] = useState("What is the capital of France?");
  const [options, setOptions] = useState(["London", "Berlin", "Paris", "Madrid"]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number>(2);

  const handleBack = () => {
    navigate(`/`);
  };

  // Mock rust backend test example
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9001");
    socket.onmessage = (event) => {
      setServerMsg(JSON.parse(event.data));
    };
    setWs(socket);
    
    // Mock simulation loop for frontend testing
    const timer1 = setTimeout(() => setPhase("QUESTION"), 3000);
    return () => {
      socket.close();
      clearTimeout(timer1);
    };
  }, []);

  const sendAnswer = (index: number) => {
    if (phase !== "QUESTION" || selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        nick: "Alice", // mock nick
        answer: index
      }));
    }
  };

  const handleTimeUp = () => {
    if (phase === "QUESTION") {
      setPhase("REVEAL");
      
      // Update scores based on answers (mock)
      if (selectedAnswer === correctAnswerIndex) {
         setPlayers(prev => prev.map(p => p.name === "Alice" ? { ...p, score: p.score + 100 } : p));
      }

      setTimeout(() => {
        setPhase("LEADERBOARD");
        setTimeout(() => {
          // Reset for next question (mock)
          setCurrentQuestion("Which planet is known as the Red Planet?");
          setOptions(["Earth", "Mars", "Jupiter", "Venus"]);
          setCorrectAnswerIndex(1);
          setSelectedAnswer(null);
          setPhase("QUESTION");
        }, 5000);
      }, 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <button
          onClick={handleBack}
          className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back to Menu
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Room: {roomId}</h1>
        <div className="px-6 py-2 bg-blue-100 text-blue-800 font-semibold rounded-lg">
          Phase: {phase}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar: Player List */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <PlayerList players={players} />
        </div>

        {/* Center: Game Board */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex-1 flex flex-col items-center justify-center relative">
            
            {phase === "WAITING" && (
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-4 animate-pulse">Waiting for game to start...</h2>
                <p className="text-gray-500">Get ready!</p>
              </div>
            )}

            {(phase === "QUESTION" || phase === "REVEAL") && (
              <div className="w-full flex flex-col items-center">
                {phase === "QUESTION" && <GameTimer durationSeconds={10} onTimeUp={handleTimeUp} />}
                
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-8">
                  {currentQuestion}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                  {options.map((opt, idx) => {
                    let btnClass = "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800";
                    
                    if (phase === "REVEAL") {
                      if (idx === correctAnswerIndex) {
                        btnClass = "bg-green-500 border-green-600 text-white animate-bounce";
                      } else if (idx === selectedAnswer && idx !== correctAnswerIndex) {
                        btnClass = "bg-red-500 border-red-600 text-white";
                      } else {
                        btnClass = "bg-gray-100 border-gray-200 text-gray-400 opacity-50";
                      }
                    } else if (selectedAnswer === idx) {
                       btnClass = "bg-blue-500 border-blue-600 text-white";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => sendAnswer(idx)}
                        disabled={phase !== "QUESTION" || selectedAnswer !== null}
                        className={`p-6 text-lg font-bold rounded-xl border-2 transition-all duration-200 shadow-sm ${btnClass}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "LEADERBOARD" && (
              <div className="text-center w-full">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Current Standings</h2>
                <div className="max-w-md mx-auto bg-gray-50 rounded-lg p-4 border border-gray-200">
                  {players.sort((a,b) => b.score - a.score).map((p, index) => (
                    <div key={p.id} className="flex justify-between items-center p-3 border-b last:border-b-0 border-gray-200">
                      <span className="font-bold text-gray-700 text-lg">{index + 1}. {p.name}</span>
                      <span className="text-blue-600 font-bold text-xl">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Sidebar: Chat */}
        <div className="lg:col-span-1 flex flex-col h-[500px] lg:h-auto">
           <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
              <h2 className="text-xl font-bold p-4 bg-gray-50 border-b border-gray-200 text-gray-800">Room Chat</h2>
              <div className="flex-1 relative">
                 <Chat />
              </div>
           </div>
        </div>

      </div>

      {/* Debug Info */}
      <div className="mt-8 text-xs text-gray-400 font-mono">
        Debug Server Msg: {JSON.stringify(serverMsg)}
      </div>
    </div>
  );
}