npm i @y/websocket-server ws
npm i yjs y-monaco y-websocket
import http from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from '@y/websocket-server'

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  if (!(req.url || '').startsWith('/yjs')) return socket.destroy()
  wss.handleUpgrade(req, socket, head, ws => setupWSConnection(ws, req))
})

server.listen(PORT)