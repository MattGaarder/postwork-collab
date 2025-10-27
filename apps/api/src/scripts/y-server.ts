import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { createYjsServer } from 'yjs-server'

const port = Number(process.env.PORT || 1234)
const host = process.env.HOST || 'localhost'

const wss = new WebSocketServer({ port, host })
const yjss = createYjsServer({ createDoc: () => new Y.Doc() })

wss.on('connection', (socket, req) => yjss.handleConnection(socket, req))

console.log(`yjs websocket server on ws://${host}:${port}`)