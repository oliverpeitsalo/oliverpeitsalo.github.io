import { useCallback, useEffect, useRef, useState } from 'react';

// TYPES //
type ChatProps = {
  username: string
}

export function Chat({ username }: ChatProps) {
  const socketReference = useRef<WebSocket | null>(null)
  const messagesEndReference = useRef<HTMLDivElement | null>(null)

  const [messages, setMessages] = useState<Array<{ user: string; text: string }>>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

 
  const connect = useCallback(() => {
    if (!username.trim()) { return }

    socketReference.current?.close()

    const webSocket = new WebSocket(
      window.location.hostname === "localhost"
        ? "ws://localhost:55555"
        : "wss://trivia-chat.onrender.com"
    )

    socketReference.current = webSocket

    webSocket.onopen = () => {
      setStatus("connected")

      webSocket.send(JSON.stringify({
        type: "JOIN",
        user: username
      }))
    }

    webSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "USER_JOIN") {
          setConnectedUsers((prev) => 
            prev.includes(data.user) ? prev : [...prev, data.user]
          )
        } else if (data.type === "USER_LEAVE") {
          setConnectedUsers((prev) => prev.filter((u) => u !== data.user))
        } else if (data.type === "USERS_LIST") {
          setConnectedUsers(data.users || [])
        } else if (!data.user || !data.text) { 
          return 
        } else {
          setMessages((prev) => [...prev, data])
        }
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
        setStatus("error")
      }
    }
  }, [username])

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
    }
  }, [connect, username])

  const handleSend = () => {
    if (!inputValue.trim()) { return } 
    const socket = socketReference.current
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
      <div className="flex flex-col h-full w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Connecting to chat...</p>
        </div>
      </div>
    }
    {status === "connected" && (
      <div className="flex flex-col h-full w-full bg-white">
        <div className="flex flex-1 min-h-0">
          {/* Chat Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0 bg-gray-50/50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm font-medium">No messages yet. Say hi!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.user === username;
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-gray-500 mb-1 px-2 font-medium">{msg.user}</span>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] break-words shadow-sm text-sm ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndReference} />
            </div>
            <div className="p-3 bg-white border-t border-gray-100">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleSendKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 pl-4 pr-12 py-2.5 bg-gray-100 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Connected Users Sidebar */}
          <div className="w-56 border-l border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-800 text-sm">Connected Users</h3>
              <p className="text-xs text-gray-500 mt-1">{connectedUsers.length} online</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {connectedUsers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-4">No users connected</p>
              ) : (
                connectedUsers.map((user, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg text-sm font-medium truncate ${
                      user === username
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {user === username ? `${user} (you)` : user}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    {status === "error" && (
      <div className="flex flex-col h-full w-full items-center justify-center bg-white p-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-800 font-medium mb-1">Connection Lost</p>
        <p className="text-gray-500 text-sm mb-6">Couldn't connect to the chat server.</p>
        <button
          onClick={() => {
            setStatus("connecting")
            connect()
          }}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Try Again
        </button>
      </div>
    )}
  </>
  );
}
