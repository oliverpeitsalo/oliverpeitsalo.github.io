import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

type LeaderboardScore = [string, number];

type ServerMessage = {
  type?: string;
  scores?: LeaderboardScore[];
};

export default function Leaderboard() {
  const navigate = useNavigate();
  const socketReference = useRef<WebSocket | null>(null);
  const [scores, setScores] = useState<LeaderboardScore[]>([]);
  const [status, setStatus] = useState<"connecting" | "loaded" | "error">("connecting");

  useEffect(() => {
    const socket = new WebSocket("wss://rust-trvia-microservice.onrender.com");
    // const socket = new WebSocket("ws://localhost:9001"); // For local testing
    socketReference.current = socket;

    socket.onopen = () => {
      console.log("Connected to backend for leaderboard");
      socket.send(
        JSON.stringify({
          type: "get_leaderboard",
          room: "global",
          username: "viewer",
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "all_time_leaderboard" && msg.scores) {
          setScores(msg.scores);
          setStatus("loaded");
          socket.close(); // We got what we needed, close the connection
        }
      } catch (err) {
        console.error("Failed to parse leaderboard message", err);
      }
    };

    socket.onerror = () => {
      setStatus("error");
    };

    return () => {
      if (socketReference.current === socket) {
        socketReference.current = null;
      }
      socket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col items-center font-sans">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Menu
          </button>
          <h1 className="text-2xl font-bold text-gray-800">All-Time Leaderboard</h1>
          <div className="w-[120px]"></div> {/* Spacer for center alignment */}
        </header>

        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 min-h-[500px] flex flex-col">
          {status === "connecting" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium text-lg">Loading global scores...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-800 font-bold text-xl mb-2">Connection Error</p>
              <p className="text-gray-500 mb-6">Could not retrieve the leaderboard from the server.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {status === "loaded" && (
            <div className="flex-1 flex flex-col">
              {scores.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-400 text-lg font-medium">No scores yet. Be the first!</p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Podium for top 3 (optional visual flair) */}
                  <div className="flex justify-center items-end gap-4 mb-10 mt-6 h-40">
                    {/* Rank 2 */}
                    {scores[1] && (
                      <div className="flex flex-col items-center">
                        <div className="text-gray-600 font-bold mb-2 truncate max-w-[100px]">{scores[1][0]}</div>
                        <div className="w-24 h-24 bg-gray-200 rounded-t-lg flex flex-col items-center justify-center shadow-inner border border-gray-300">
                          <span className="text-3xl font-black text-gray-400">2</span>
                          <span className="font-bold text-gray-700">{scores[1][1]} pts</span>
                        </div>
                      </div>
                    )}
                    {/* Rank 1 */}
                    {scores[0] && (
                      <div className="flex flex-col items-center">
                        <div className="text-yellow-600 font-bold mb-2 text-lg truncate max-w-[120px]">{scores[0][0]}</div>
                        <div className="w-28 h-32 bg-yellow-100 rounded-t-lg flex flex-col items-center justify-center shadow-inner border border-yellow-300">
                          <span className="text-4xl font-black text-yellow-500">1</span>
                          <span className="font-bold text-yellow-700 text-lg">{scores[0][1]} pts</span>
                        </div>
                      </div>
                    )}
                    {/* Rank 3 */}
                    {scores[2] && (
                      <div className="flex flex-col items-center">
                        <div className="text-orange-700 font-bold mb-2 truncate max-w-[100px]">{scores[2][0]}</div>
                        <div className="w-24 h-20 bg-orange-100 rounded-t-lg flex flex-col items-center justify-center shadow-inner border border-orange-200">
                          <span className="text-2xl font-black text-orange-400">3</span>
                          <span className="font-bold text-orange-800">{scores[2][1]} pts</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* List for everyone else */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    {scores.map((score, index) => (
                      <div
                        key={index}
                        className={`flex justify-between items-center p-4 border-b last:border-b-0 border-gray-200 ${
                          index < 3 ? 'bg-white' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`font-bold w-6 text-center ${
                            index === 0 ? 'text-yellow-500 text-xl' :
                            index === 1 ? 'text-gray-400 text-xl' :
                            index === 2 ? 'text-orange-400 text-xl' :
                            'text-gray-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className={`font-bold text-lg ${index < 3 ? 'text-gray-800' : 'text-gray-600'}`}>
                            {score[0]}
                          </span>
                        </div>
                        <span className="text-purple-600 font-black text-xl bg-purple-50 px-4 py-1 rounded-full border border-purple-100">
                          {score[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
