import { useState, useEffect, useRef } from 'react';

// TYPES //
type ChatProps = {
  username: string
}

export function Chat({ username }: ChatProps) {
  const socketReference = useRef<WebSocket | null>(null)
  const messagesEndReference = useRef<HTMLDivElement | null>(null)

  const [messages, setMessages] = useState<Array<{ user: string; text: string }>>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    messagesEndReference.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!username) { return }

    connect()

    return () => {
      const ws = socketReference.current
      socketReference.current = null
      ws?.close()
      setSocket(null)
    }
  }, [username])

  const connect = () => {
    if (!username.trim()) { return }

    socketReference.current?.close()

    const webSocket = new WebSocket(
      window.location.hostname === "localhost"
        ? "ws://localhost:55555"
        : "wss://trivia-chat.onrender.com"
    )

    socketReference.current = webSocket
    setSocket(webSocket)
    setStatus("connecting")

    webSocket.onopen = () => {
      setStatus("connected")
      setSocket(webSocket)

      webSocket.send(JSON.stringify({
        type: "JOIN",
        user: username
      }))
    }

    webSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (!data.user || !data.text) { return }

        setMessages((prev) => [...prev, data])
      } catch {
        console.error("Invalid message")
      }
    }

    webSocket.onerror = () => {
      setStatus("error")
    }

    webSocket.onclose = () => {
       if (socketReference.current === webSocket) {
        socketReference.current = null
        setSocket(null)
        setStatus("error")
      }
    }
  }

  const handleSend = () => {
    if (!inputValue.trim()) { return } 
    if (!socket || socket.readyState !== WebSocket.OPEN) { return } 

    socket.send(JSON.stringify({
      type: "CHAT",
      user: username,
      text: inputValue
    }))

    setInputValue("")
  }

  const handleSendKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
    {status === "connecting" && 
      <div className="w-full h-full flex items-center justify-center">
        <p>Connecting to chat...</p>
      </div>
    }
    {status === "connected" && (
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
            <div ref={messagesEndReference} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleSendKeyPress}
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
    )}
    {status === "error" && (
      <div className="w-full p-6 bg-gray-50 flex flex-col items-center justify-center">
      <p className="text-red-500 text-sm mb-2">
        Couldn't connect to chat server
      </p>

      <button
        onClick={connect}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
    )}
  </>
  );
}
