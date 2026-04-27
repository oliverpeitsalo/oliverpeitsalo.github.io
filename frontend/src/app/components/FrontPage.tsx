// import { Container } from "@mui/material"
import { Chat } from './Chat';
import { useNavigate } from "react-router-dom";
import { useState } from 'react';

export default function FrontPage() {
  const [username, setUsername] = useState<string>("");
  const [inputUsername, setInputUsername] = useState<string>("");
  // const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    // const setRoomId = crypto.randomUUID();
    // navigate(`/room/${newRoomId}`);
    navigate("/room/1")
  }

  const handleJoinTrivia = () => {
    // if (!roomId.trim()) {
    //   return
    // }
    
    // navigate(`/room/${roomId.trim()}`);
  };

  const handleLeaderboard = () => {
      console.log('View leaderboard');
  };

  const handleContinueKeyPress = () => {
  if (!inputUsername.trim()) { return }
    setUsername(inputUsername.trim())
}

  return (
    <>
      <div className="size-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="text-center space-y-8">
            <h1 className="text-5xl font-bold text-gray-800 mb-12">Trivia Game</h1>
          {!username && (
            <div className="w-full p-6 bg-gray-50">
              <div className="max-w-md mx-auto bg-white p-5 rounded-xl shadow-md">
                <p className="mb-2">Enter your username</p>
      
                <input
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  className="w-full border p-2 mb-2 rounded"
                  placeholder="Username"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { 
                      handleContinueKeyPress() 
                    }
                  }}
                />
      
                <button
                  onClick={() => {
                    if (!inputUsername.trim()) { return } 
                    setUsername(inputUsername.trim())
                  }}
                  disabled={!inputUsername.trim()}
                  className="w-full bg-blue-600 text-white p-2 rounded 
                  disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
          {username && (
            <div>
              <div className="mb-10 px-6 py-2 bg-gray-100 rounded-full shadow-lg shadow-blue-200/50">
                <h2 className="text-gray-800">
                  Username: <span className="font-semibold text-blue-600">{username}</span>
                </h2>
              </div>
              <div className="flex flex-col gap-4 min-w-[300px]">
                <button
                  onClick={handleCreateRoom}
                  className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  Create New Trivia Room
                </button>

                <button
                  onClick={handleJoinTrivia}
                  className="px-8 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  Join Trivia Room
                </button>

                <button
                  onClick={handleLeaderboard}
                  className="px-8 py-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  Leaderboard
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
        {username &&
          <Chat username={username} />
        }
      </div>
    </>
  );
}