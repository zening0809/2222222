import {
  BaseExtend,
  App,
  WsMsgDef,
  log,
  AppEvent,
  BotMsg,
  CacheDef,
  Room,
  Contact,
} from './common'

const {
  WsMsgType,
  WsRevCommandType,
  // WsRevMsgType,
  WsRevDataType,
} = WsMsgDef

/**
 * Websocket扩展模块
 *
 * 用于处理Websocket接收到的事件
 *
 * @export
 * @class WsExtend
 * @extends {BaseExtend}
 */
export default class WsExtend extends BaseExtend {
  public constructor(app: App) {
    log.info('WsExtend', 'class init!')
    super(app)

    this.addBaseEvent()
    this.addMsgEvent()
  }

  /**
   * 监听基础事件
   *
   * @private
   * @memberof WsExtend
   */
  private addBaseEvent() {
    log.info('WsExtend', 'call addBaseEvent()')
    const app = this.app
    const { ws, config, uuid } = app
    ws
      .on('connect', () => {
        // 连接成功
        log.info('WsExtend', 'Websocket connect succeed')
        const data = <WsMsgDef.WsAuth>{}
        data.bot_name = config.bot_name
        data.uuid = uuid
        ws.emit(WsMsgType.bot_auth, data)
      })
      .on('disconnect ', reason => {
        this.app.emit(AppEvent.pause_bot, 'disconnect')
        // 连接中断
        // 参数为字符串，表明 服务器关闭连接/客户端关闭连接
        log.info('WsExtend', 'Websocket disconnect: %s', reason)
        // TODO: 后期考虑是否断开后通过其他途径发送服务掉线通知

        // 暂停bot服务
      })
      .on('reconnect', attemptsNumber => {
        // 重新连接成功
        log.info('WsExtend', 'Websocket reconnect succeed: %d times', attemptsNumber)
        const data = <WsMsgDef.WsAuth>{
          bot_name: config.bot_name,
          uuid: uuid,
        }
        ws.emit(WsMsgType.bot_auth, data)
      })
      .on('reconnect_attempt', attemptsNumber => {
        this.app.emit(AppEvent.pause_bot, 'disconnect')
        // 尝试重新连接中
        log.silly('WsExtend', 'Websocket reconnect attempt: %d times', attemptsNumber)
      })
      .on('connect_error', e => {
        // 连接错误
        log.error('WsExtend', 'Websocket connect error: %s', e)
      })
      .on('reconnect_failed', () => {
        // 无法再次重连
        log.warn('WsExtend', 'Websocket reconnect failed')
        // TODO: 后期考虑增加通知，并重启Docker
      })
      .on('connect_timeout', time => {
        // 连接超时
        log.warn('WsExtend', 'Websocket connect timeout: %s second', time)
      })
      .on('error', e => {
        // 全局错误
        log.error('WsExtend', 'Websocket error: %s', JSON.stringify(e))
      })
  }

  /**
   * 监听信息事件
   *
   * @private
   * @memberof WsExtend
   */
  private addMsgEvent() {
    log.info('WsExtend', 'call addMsgEvent()')
    const app = this.app
    const { ws, state } = app
    ws
      .on(WsMsgType.rev_auth, data => {
        // data = {
        //   allow_run: boolean,
        //   uuid: string,
        // }
        log.silly('wsExtend', 'On %s event, data: %s', WsMsgType.rev_auth, JSON.stringify(data))
        if (data && data.allow_run) {
          state.bot_usable = true
          if (!state.bot_running) {
            // 启动bot
            app.emit(AppEvent.start_bot)
          } else {
            // 向服务器发送身份信息
            if (state.bot_login) {
              let self
              try {
                self = app.bot.self()
                ws.emit(WsMsgType.bot_login, {
                  nickname: self && self.name() || '',
                })
              } catch (e) {
                log.error('wsExtend', 'addMsgEvent() err:\n', e)
              }
            }
          }
        } else {
          // 服务器不允许运行，退出
          app.emit(AppEvent.quit, 'Server not allow run the bot')
        }
      })
      // 所有回复信息类事件统一处理
      .on(WsMsgType.rev_msg, data => {
        this.rev_msg.call(this, data)
      })
      // 所有命令事件统一处理
      .on(WsMsgType.rev_command, async data => {
        await this.rev_command.call(this, data)
      })
      // 所有下发数据事件统一处理
      .on(WsMsgType.rev_data, data => {
        this.rev_data.call(this, data)
      })
  }

  /**
   * 处理回复信息
   *
   * @private
   * @param {any} data
   * @memberof WsExtend
   */
  private async rev_msg(data) {
    // const { addSay } = this.app
    const msg = <BotMsg>{}
    // const data = {
    //   topic: '',//房间名称
    //   alias: '',//好友alias
    //   msg: '',//信息内容
    // }

    log.silly('wsExtend', 'rev_msg() rev data: %s', JSON.stringify(data))
    // 添加一个不发言开关
    if (data.notSay) {
      return
    }
    if (data && data.msg) {
      // TODO: 这里要做一个过滤，将信息内藏的at列表转化
      msg.text = data.msg
      // 合并回复
      msg.merge = true
    }
    if (data.topic) {
      msg.roomTopic = data.topic
      msg.atList = new Set().add(data.alias)
      // web版不支持@人
      // const s1 = String.fromCharCode(8199)
      // const s2 = String.fromCharCode(8198)
      log.silly('wsExtend', 'rev_msg() msg data: %s', JSON.stringify(msg))
      const re = /\u2007[^\u2006\u2007]+\u2006/g
      const list = msg.text.match(re)
      // console.log('text:\n%s', JSON.stringify(msg.text))
      // console.log('at数组：\n%s', JSON.stringify(list))
      if (list && list.length > 0) {
        for (const a of list) {
          const alias = a.replace(/[\u2006\u2007]/g, '')
          const c = await this.app.getContact(alias)
          // console.log('当前处理at: %s\n提取出: %s\n获取到联系人：\n%s', a, alias, JSON.stringify(c))
          // const c = Contact.load(alias)
          let name = ''
          if (c) {
            name = '@' + c.name() + ' '
            // console.log('获取到name: %s', name)
          }
          msg.text = msg.text.replace(a, name)
        }
      }
    } else {
      msg.userAlias = data.alias
    }
    this.app.addSay(msg)
  }

  /**
   * 处理执行指令
   *
   * @private
   * @param {any} data
   * @memberof WsExtend
   */
  private async rev_command(data) {
    const app = this.app
    let room: Room | null
      , owner
    // const { bot, ws } = app
    try {
      switch (data.command) {
        case WsRevCommandType.restart_bot:
          log.info('Ws', 'rev_command() Server command: restart bot!')
          app.emit(AppEvent.restart_bot)
          break
        case WsRevCommandType.resume_bot:
          log.info('Ws', 'rev_command() Server command: resume bot!')
          app.emit(AppEvent.resume_bot)
          break
        case WsRevCommandType.pause_bot:
          log.info('Ws', 'rev_command() Server command: pause bot!')
          app.emit(AppEvent.pause_bot)
          break
        case WsRevCommandType.create_room: // 创建房间
          // const data = {
          //   command: 'create_room',
          //   list: [{
          //     taskId: '',
          //     topic: '',
          //     type: '',
          //     members: [],
          //   }]
          // }
          log.info('Ws', 'rev_command() Server command: create room!')
          if (!data.list) {
            log.warn('Ws', 'rev_command() Rev create room data err: %s', data)
            return
          }
          data.list.forEach(async task => {
            const taskId = task.taskId || task.topic
            const roomInfo = <CacheDef.NewRoomInfo>{
              topic: task.topic,
              type: task.type || '',
              members: new Set(task.members || []),
            }
            log.info('Ws', 'rev_command() 准备建群: \n%s\n', JSON.stringify(task))
            await app.createRoom(taskId, roomInfo)
              .catch(async e => {
                log.warn('Ws', 'rev_command() 创建群失败: %s', e.message)
                await app.bot.say(`Bot日志: 创建群 "${roomInfo.topic}" 失败！\n${e.message}`)
              })
          })
          break
        case WsRevCommandType.set_alias: // 设置联系人alias
          // const data = {
          //   command: 'set_alias',
          //   alias: string, //如果是tmp#开头，则自动识别
          //   newAlias: string,
          // }
          log.info('Ws', 'rev_command() Server command: set alias!')
          if (!data.alias || !data.newAlias) {
            log.warn('Ws', 'rev_command() Rev set alias data err: %s', JSON.stringify(data))
            return
          }
          const contact = await app.getContact(data.alias)
          if (!contact) {
            log.warn('Ws', 'rev_command() Can\' find contact, alias: %s', data.alias)
            // TODO: 添加失败汇报
            return
          }
          app.setAlias(contact, data.newAlias)
          break
        case WsRevCommandType.set_topic: // 设置房间名称
          // const data = {
          //   command: 'set_alias',
          //   topic: string,
          //   newTopic: string,
          // }
          log.info('Ws', 'rev_command() Server command: set topic!')
          if (!data.topic || !data.newTopic) {
            log.warn('Ws', 'rev_command() Rev set topic data err: %s', JSON.stringify(data))
            return
          }
          room = await Room.find({ topic: data.topic })
          if (!room) {
            log.warn('Ws', 'rev_command() Can\' find room, topic: %s', data.topic)
            // TODO: 添加失败汇报
            return
          }
          owner = room.owner()
          if (owner && !owner.self()) {
            log.warn('Ws', 'rev_command() The bot is\'t owner for room "%s"', data.topic)
            await app.bot.say(`Bot日志: 我不是群 "${data.topic}" 的群主，修改群名称操作取消！\n可手动改名为： ${data.newTopic}`)
            // TODO: 添加失败汇报
            return
          }
          await room.topic(data.newTopic)
          break
        case WsRevCommandType.add_member: // 增加成员
          // const data = {
          //   command: 'add_member',
          //   topic: string,
          //   members: [string],
          //   say: string,
          // }
          log.info('Ws', 'rev_command() Server command: add member to Room!')
          if (!data.topic || !data.members) {
            log.warn('Ws', 'rev_command() Rev add member data err: %s', JSON.stringify(data))
            return
          }
          room = await Room.find({ topic: data.topic })
          if (!room) {
            log.warn('Ws', 'rev_command() Can\' find room, topic: %s', data.topic)
            // TODO: 添加失败汇报
            return
          }
          // owner = room.owner()
          // if (owner && !owner.self()) {
          //   log.warn('Ws', 'rev_command() The bot is\'t owner for room "%s"', data.topic)
          //   // TODO: 添加失败汇报
          //   return
          // }
          const cList: Contact[] = []
          const msg = <BotMsg>{
            atList: new Set(),
            merge: true,
          }
          try {
            if (data.members) {
              for (const alias of data.members) {
                const c = await app.getContact(alias)
                if (c) {
                  const ret = await room.add(c)
                    .catch(e => {
                      log.error('Ws', 'rev_command()', e)
                    })
                  if (ret) {
                    log.silly('Ws', 'rev_command() 添加联系人 "%s" 到房间 "%s" 成功！', alias, data.topic)
                    cList.push(c)
                    msg.atList.add(alias)
                  } else {
                    log.warn('Ws', 'rev_command() 添加联系人 "%s" 到房间 "%s" 失败！', alias, data.topic)
                    await app.bot.say(`Bot日志: 添加联系人 "${alias}" 到群 "${data.topic}" 失败！`)
                  }
                } else {
                  log.warn('Ws', 'rev_command() 添加联系人 "%s" 到房间 "%s" 失败: 未能找到联系人！', alias, data.topic)
                  await app.bot.say(`Bot日志: 添加联系人 "${alias}" 到群 "${data.topic}" 失败！\n未能找到此联系人！`)
                }
              }
              if (cList.length > 0 && data.say) {
                // NOTE: 是否应该在此处做个回调，通知服务器某用户已经进入群
                msg.roomTopic = room.topic()
                msg.text = data.say
                await app.addSay(msg)
              }
            }
          } catch (e) {
            log.error('Ws', 'rev_command()', e)
          }
          break

        default:
          break
      }
    } catch (e) {
      log.warn('Ws', 'rev_command() Rev server command error: %s', e)
    }
  }

  /**
   * 处理回复数据
   *
   * @private
   * @param {any} data
   * @memberof WsExtend
   */
  private async rev_data(data) {
    const app = this.app
    const { config, state, cache, loadSetting } = app
    // const data = {
    //   type: string,
    // }

    switch (data.type) {
      case WsRevDataType.config:
        // data.config = {
        //   key: value
        // }
        log.info('Ws', 'rev_data() Rev data: config data!')
        if (!data.config) {
          log.warn('Ws', 'rev_data() Rev config data err: %s', data)
          return
        }
        if (data.config.locker) {
          const locker = data.config.locker
          config.locker.limit_alias = locker.limit_alias || state.aliasLocker.limit_time
          config.locker.limit_msg = locker.limit_msg || state.sendMsgLocker.limit_time
          config.locker.limit_create_room = locker.limit_create_room || state.createRoomLocker.limit_time
        }
        if (data.config.whiteUserList) {
          config.whiteUserList = data.config.whiteUserList
        }
        if (data.config.botAliasList) {
          config.botAliasList = data.config.botAliasList
        }
        loadSetting()
        break
      case WsRevDataType.room:
        // data.room = [{
        //   topic,
        //   roomId,
        //   gid,
        //   type,
        //   admin[],
        // }]
        log.info('Ws', 'rev_data() Rev data: roomMap data!')
        if (!data.room) {
          log.warn('Ws', 'rev_data() Rev roomMap data err: %s', JSON.stringify(data))
          return
        }
        for (const r of data.room) {
          if (!r.topic || !r.gid || !r.type) {
            log.warn('Ws', 'rev_data() room data err: %s', r)
            continue
          }
          let room = await Room.find({ topic: r.topic })
          if (!room && r.roomId) {
            room = await Room.load(r.roomId)
          }
          if (!room) {
            log.warn('Ws', 'rev_data() room "%s" not found!', r.topic)
            continue
          }
          const rMap = <CacheDef.RoomMap>{}
          rMap.topic = r.topic
          rMap.type = r.type
          if (r.gid) {
            rMap.gid = r.gid
          }
          rMap.admin = new Set(r.admin || [])
          cache.roomMap.set(room.id, rMap)
        }
        break

      default:
        break
    }

  }

}
