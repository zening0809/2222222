import * as Websocket from 'socket.io-client';
const ws = Websocket('ws://127.0.0.1:7001/chat')

ws
  .on('connect', () => {
    console.log('Websocket connected')
    ws.emit('chat', 'hello!')
    ws.emit('chat1', { type: 11, data: { x: 'str', y: 12312 } })
  })
  .on('error', err => {
    console.log('Websocket error: ' + JSON.stringify(err))
  })
  .on('res', data => {
    console.log('res from server: %s!', data)
  })
