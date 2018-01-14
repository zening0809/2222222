import { Config } from './common';
import { log } from 'wechaty';

export default {
  getConfig,
}

function getConfig(): Config {
  let config = <Config>{}
  config.ws = process.env['websocket_url'] || 'http://127.0.0.1:7001/bot'
  config.profile = process.env['WECHATY_PROFILE'] || 'bot_cookie'
  config.bot_name = process.env['bot_name'] || 'bot10086'
  config.debug = process.env['DEBUG'] === 'true'
  config.locker = {
    limit_msg: (<any>process.env['limit_sendmsg'] || 10) * 1000,
    limit_alias: (<any>process.env['limit_alias'] || 10) * 1000,
    limit_create_room: (<any>process.env['limit_create_room'] || 10) * 1000,
  }
  config.whiteUserList = (<string>process.env['white_user_list'] || '').split('|')
  config.botAliasList = (<string>process.env['bot_list'] || '').split('|')
  config.newFriendRevMsg = (<string>process.env['newMsg'] || '')

  try {
    const tmp = require('./dev_config.js')
    config = Object.assign(config, tmp)
  } catch (e) {
    console.error('config err: ' + JSON.stringify(e));
  }

  if (process.env.CONFIG_FILE) {
    try {
      const tmp = require(<string>process.env.CONFIG_FILE)
      config = Object.assign(config, tmp)
    } catch (e) {
      log.error('config err: ' + JSON.stringify(e));
    }
  }

  if (!/^(http|https):\/\//.test(config.ws)) {
    log.error('Config', 'websocket url error! config.ws:"%s"', config.ws)
  }
  return config
}
