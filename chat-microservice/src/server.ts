import { WebSocketServer, WebSocket } from "ws"
import dotenv from "dotenv"

dotenv.config()

const port_number = process.env.PORT ? Number(process.env.PORT) : 55555


// // STRUCTURES // 
const clients = new Map<WebSocket, string>();

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

function getConnectedUsers(): string[] {
  return Array.from(clients.values());
}

webSocketServer.on("connection", (socket) => {
  console.log("Client connected")

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString())

      // JOIN //
      if (parsed.type === "JOIN") {
        if (!parsed.user) { return }

        clients.set(socket, parsed.user)

        // Send the current users list to the new user
        socket.send(JSON.stringify({
          type: "USERS_LIST",
          users: getConnectedUsers()
        }))

        // Notify OTHER users that a new user joined (not the user themselves)
        for (const client of webSocketServer.clients) {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "USER_JOIN",
              user: parsed.user
            }))
          }
        }

        return
      }

      // CHAT //
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
          type: "USER_LEAVE",
          user: username
        }))
      }

      clients.delete(socket)
      console.log("Client disconnected")
    })
})

console.log(`Chat WebSocket service running in port:${port_number}`)