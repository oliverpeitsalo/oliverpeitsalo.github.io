// import { Container } from "@mui/material"
import { Chat } from './Chat';
import { useNavigate } from "react-router-dom";
import { useState } from 'react';

export default function FrontPage() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    const newRoomId = crypto.randomUUID();

    navigate(`/room/${newRoomId}`);
  }

  const handleJoinTrivia = () => {
    if (!roomId.trim()) {
      return
    }
    
    navigate(`/room/${roomId.trim()}`);
  };

  const handleLeaderboard = () => {
      console.log('View leaderboard');
  };

  return (
    <div className="size-full flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center space-y-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-12">Trivia Game</h1>

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
      </div>
      <Chat />
    </div>
  );
}