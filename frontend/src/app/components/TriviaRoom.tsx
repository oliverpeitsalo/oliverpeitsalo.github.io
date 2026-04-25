import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

export default function TriviaGameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
      navigate(`/`);
  }

  return (
    <>
      <button
        onClick={handleBack}
        className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg transform hover:scale-105"
      >
        Back to menu
      </button>
      <div>Room: {roomId}</div>
    </>
    );
}