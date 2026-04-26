import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function TriviaGameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
      navigate(`/`);
  }

  const [ws, setWs] = useState(null);
  const [serverMsg, setServerMsg] = useState(null);

  // rust backend test example
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9001");
    socket.onmessage = (event) => {
      setServerMsg(JSON.parse(event.data));
    };
    setWs(socket);
  }, []);

  // constant answer for testing
  const sendAnswer = () => {
    ws.send(JSON.stringify({
      nick: "Alice",
      answer: 2
    }));
  };

  return (
    <>
      <button
        onClick={handleBack}
        className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
      >
        Back to menu
      </button>
      <div>Room: {roomId}</div>
      <button onClick={sendAnswer}>Send Answer</button>
      <pre>{JSON.stringify(serverMsg, null, 2)}</pre>
    </>
    );
}