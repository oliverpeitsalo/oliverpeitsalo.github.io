import { WebSocketServer, WebSocket } from "ws"
import dotenv from "dotenv"

dotenv.config()

const port_number = process.env.PORT ? Number(process.env.PORT) : 55555

// TYPES // 
type Client = { 
  socket: WebSocket; 
  username: string; 
}; 
// // STRUCTURES // 

const clients = new Map<WebSocket, Client>();

// SERVER //
const webSocketServer = new WebSocketServer({ port: port_number })


// HELPERS //
function broadcast(message: string) {
  for (const client of webSocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}

webSocketServer.on("connection", (socket) => {
  console.log("Client connected")

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString())

      if (parsed.type === "JOIN") {
        if (!parsed.user) { return }

        clients.set(socket, parsed.user)

        broadcast(JSON.stringify({
          user: "SERVER",
          text: `${parsed.user} joined the chat`
        }))

        return
      }

      if (parsed.type === "CHAT") {
        const username = clients.get(socket)

        if (!username || !parsed.text) { return }

        broadcast(JSON.stringify({
          user: username,
          text: parsed.text
        }))

        return
      }

    } catch (error) {
      console.error("Error:", error)
    }
  })

    socket.on("close", () => {
      const username = clients.get(socket)

    if (username) {
      broadcast(JSON.stringify({
        user: "SERVER",
        text: `${username} left the chat`
      }))
    }

    clients.delete(socket)
    console.log("Client disconnected")
  })
})

console.log(`Chat WebSocket service running on ws://localhost:${port_number}`)