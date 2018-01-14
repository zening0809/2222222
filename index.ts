import * as finis from 'finis';
import App from './src/app';
import botExtend from './src/bot-extend';
import Config from './src/config';
import wsExtend from './src/ws-extend';
// import Cache from './src/cache'
import {
  // Locker,
  log,
  WsMsgDef,
} from './src/common'

const config = Config.getConfig()
const app = new App(config)

/** 载入事件处理 */
wsExtend.inject(app)
botExtend.inject(app)

process.on('uncaughtException', e => {
  log.error('Main', 'uncaughtException: %s', e)
  console.log(e)
})

// DEBUG:
const { ws } = app

finis((code, signal) => {
  const exitMsg = `Wechaty exit ${code} because of ${signal} `
  log.error('Main', exitMsg)
  const data = <WsMsgDef.WsError>{}
  data.code = code
  data.message = exitMsg
  ws.emit(<string>WsMsgDef.WsMsgType.bot_error, data)
  ws.close()
})
