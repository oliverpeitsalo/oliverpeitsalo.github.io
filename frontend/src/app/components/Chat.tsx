import { useState, useEffect } from 'react';

export function Chat() {
  const [messages, setMessages] = useState<Array<{ user: string; text: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    const webSocket = new WebSocket("ws://localhost:55555");
    let isMounted = true;

    setStatus("connecting");

    webSocket.onopen = () => {
      if (!isMounted) return;
      setStatus("connected");
    };

    webSocket.onmessage = (event) => {
      if (!isMounted) return;

      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.error("Invalid JSON:", event.data);
      }
    };

    webSocket.onerror = (err) => {
      console.error("WebSocket error:", err);
      if (!isMounted) return;
      setStatus("error");
    };

    webSocket.onclose = () => {
      if (!isMounted) return;
      setStatus("error");
    };

    setSocket(webSocket);

    return () => {
      isMounted = false;
      webSocket.close();
    };
  }, []);

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages([...messages, { user: 'You', text: inputValue }]);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
    {status === "connecting" && <p>Connecting to chat...</p>}
    {status === "connected" &&
      <div className="w-full p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 p-5">
          <div className="h-32 overflow-y-auto mb-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-sm">No messages yet...</p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold text-blue-600">{msg.user}: </span>
                  <span className="text-gray-800">{msg.text}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    }
    {status === "error" && (
      <div className="w-full p-6 bg-gray-50">
        <p className="text-red-500 text-sm">
          Couldn't connect to chat server
        </p>
      </div>
    )}
    </>
  );
}
