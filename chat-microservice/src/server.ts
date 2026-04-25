import { WebSocketServer, WebSocket } from "ws"
import dotenv from "dotenv"

dotenv.config()

const port_number = process.env.PORT ? Number(process.env.PORT) : 55555

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
        const message = JSON.stringify({
            user: parsed.user,
            text: parsed.text
        })
        broadcast(message)
        } catch (err) {
            console.error("Error handling message:", err)
        }
    })

    socket.on("close", () => {
        console.log("Client disconnected")
    })
})

console.log(`Chat WebSocket service running on ws://localhost:${port_number}`)