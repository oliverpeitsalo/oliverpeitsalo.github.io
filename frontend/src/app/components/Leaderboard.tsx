import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

type LeaderboardScore = [string, number];

// Node.js Leaderboard Microservice types
interface LeaderboardEntry {
  username: string;
  score: number;
  submittedAt: string;
}

interface NodeLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  totalEntries: number;
}

// Rust Backend types
type ServerMessage = {
  type?: string;
  scores?: LeaderboardScore[];
};

type ValidationStatus = {
  status: "connecting" | "loaded" | "error" | "inconsistent";
  rustData: LeaderboardScore[] | null;
  nodeData: LeaderboardScore[] | null;
  isConsistent: boolean;
  errorMessage?: string;
};

/**
 * Validates leaderboard data consistency across multiple distributed services.
 * This implements the distributed systems pattern of multi-source verification.
 */
export default function Leaderboard() {
  const navigate = useNavigate();
  const socketReference = useRef<WebSocket | null>(null);
  const [scores, setScores] = useState<LeaderboardScore[]>([]);
  const [validation, setValidation] = useState<ValidationStatus>({
    status: "connecting",
    rustData: null,
    nodeData: null,
    isConsistent: false,
  });

  // Fetch leaderboard from Node.js microservice
  const fetchNodeLeaderboard = async (): Promise<LeaderboardScore[] | null> => {
    try {
      const response = await fetch("https://leaderboard-service-lhoy.onrender.com/leaderboard");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data: NodeLeaderboardResponse = await response.json();
      
      console.log("Node.js raw response:", data);
      
      // Convert from {username, score, submittedAt} format to [username, score] tuples
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        return data.leaderboard
          .map((entry: LeaderboardEntry) => [entry.username, entry.score] as LeaderboardScore)
          .sort((a, b) => b[1] - a[1]); // Sort by score descending
      }
      
      console.warn("Node.js response missing leaderboard array:", data);
      return null;
    } catch (err) {
      console.error("Failed to fetch from Node.js leaderboard service:", err);
      return null;
    }
  };

  // Reset leaderboard in Node.js microservice
  const clearLeaderboard = async () => {
  try {
    const response = await fetch(
      "https://leaderboard-service-lhoy.onrender.com/leaderboard",
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to clear leaderboard");
    }

    console.log("Leaderboard cleared");

    setScores([]);
  } catch (error) {
    console.error("Error clearing leaderboard:", error);
  }
};

  // Validate consistency between two data sources
 const isDataConsistent = (
    data1: LeaderboardScore[] | null,
    data2: LeaderboardScore[] | null
  ): boolean => {
    if (!data1 || !data2) return false;

    const top10_1 = data1.slice(0, 10);
    const top10_2 = data2.slice(0, 10);

    if (top10_1.length !== top10_2.length) return false;

    return top10_1.every((entry, idx) =>
      entry[0] === top10_2[idx][0] && entry[1] === top10_2[idx][1]
    );
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchBothSources = async () => {
      setValidation(prev => ({ ...prev, status: "connecting" }));
      
      // Fetch from Node.js microservice
      const nodeData = await fetchNodeLeaderboard();
      
      // Fetch from Rust backend via WebSocket
      const rustData = await new Promise<LeaderboardScore[] | null>((resolve) => {
        const socket = new WebSocket("wss://rust-trvia-microservice.onrender.com");
        // const socket = new WebSocket("ws://localhost:9001"); // For local testing
        socketReference.current = socket;

        const timeout = setTimeout(() => {
          socket.close();
          resolve(null);
        }, 10000); // 10 second timeout

        socket.onopen = () => {
          console.log("Connected to Rust backend for leaderboard");
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
              clearTimeout(timeout);
              resolve(msg.scores);
              socket.close();
            }
          } catch (err) {
            console.error("Failed to parse leaderboard message", err);
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
      });

      if (!isMounted) return;

      // Determine consistency
      const isConsistent = isDataConsistent(rustData, nodeData);
      const validatedData = isConsistent && rustData ? rustData : rustData || nodeData || [];

      const newValidation: ValidationStatus = {
        rustData,
        nodeData,
        isConsistent,
        status: validatedData.length > 0 ? (isConsistent ? "loaded" : "inconsistent") : "error",
        errorMessage: isConsistent ? undefined : "⚠️ Data inconsistency detected between services"
      };

      setValidation(newValidation);
      setScores(validatedData);
    };

    fetchBothSources();

    return () => {
      isMounted = false;
      if (socketReference.current) {
        socketReference.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col items-center font-sans">
      <button
          onClick={clearLeaderboard}
          style={{
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500"
          }}
        >
          Reset leaderboard
        </button>
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
          {validation.status === "connecting" && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium text-lg">Validating data from multiple sources...</p>
              <p className="text-gray-400 text-sm mt-2">Checking: Rust Backend + Node.js Microservice</p>
            </div>
          )}

          {validation.status === "inconsistent" && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Data Inconsistency Detected</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    The leaderboard data differs between services. Showing data from the primary source (Rust Backend).
                    This may indicate synchronization issues in the distributed system.
                  </p>
                </div>
              </div>
            </div>
          )}

          {validation.status === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-800 font-bold text-xl mb-2">Connection Error</p>
              <p className="text-gray-500 mb-6">Could not retrieve leaderboard from any service.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {(validation.status === "loaded" || validation.status === "inconsistent") && (
            <div className="flex-1 flex flex-col">
              {/* Validation Status Badge */}
              <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                validation.isConsistent 
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
              }`}>
                <span className={validation.isConsistent ? "text-green-500" : "text-yellow-500"}>
                  {validation.isConsistent ? "✓" : "⚠"}
                </span>
                <span>
                  {validation.isConsistent 
                    ? "Data validated across all sources" 
                    : "Data from primary source (validation pending)"}
                </span>
              </div>

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
