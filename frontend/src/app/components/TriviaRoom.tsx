import { useParams } from "react-router-dom";

export default function TriviaGameRoom() {
  const { roomId } = useParams();

  return (
    <div>Room: {roomId}</div>
    );
}