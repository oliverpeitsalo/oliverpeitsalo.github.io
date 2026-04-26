import React from 'react';

export interface Player {
  id: string;
  name: string;
  score: number;
}

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 w-full h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Players</h2>
      <ul className="flex-1 overflow-y-auto space-y-2">
        {players.map((player) => (
          <li key={player.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="font-semibold text-gray-700">{player.name}</span>
            <span className="text-blue-600 font-bold">{player.score}</span>
          </li>
        ))}
        {players.length === 0 && (
          <p className="text-gray-400 text-sm italic">Waiting for players...</p>
        )}
      </ul>
    </div>
  );
}
