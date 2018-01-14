import {
  App,
  BaseExtend,
  Contact,
  Room,
  WsMsgDef,
  log,
  AppEvent,
  RoomType,
  MsgType,
  RoomQueryFilter,
  ContactQueryFilter,
} from './common'

const {
  WsMsgType,
} = WsMsgDef
/**
 * Bot 处理模块
 *
 * 用于处理Bot接收到的事件
 *
 * @export
 * @class BotExtend
 * @extends {BaseExtend}
 */
export default class BotExtend extends BaseExtend {

  public constructor(app: App) {
    log.info('BotExtend', 'class init!')
    const { ws, state, bot } = app
    super(app)

    // const bot = app.bot
    this.addBaseEvent()
    this.addRoomEvent()
    this.addMsgEvent()
    this.addFriendEvent()
    app.on(AppEvent.start_bot, () => {
      state.bot_running = true
      bot.init()
        .catch(e => {
          state.bot_running = false
          log.error('Bot', 'init() fail: %s', e)
          const data = <WsMsgDef.WsError>{}
          data.error = e
          ws.emit(WsMsgType.bot_error, data)
          bot.quit()
          // process.exit(-1)
        })
    })
  }

  /**
   * 监听基础事件
   *
   * @private
   * @memberof BotExtend
   */
  private addBaseEvent() {
    log.info('BotExtend', 'call addBaseEvent()')
    const { bot, ws, config, state } = this.app
    bot
      .on('error', e => {
        log.error('Bot', 'error: %s', e)

        const data = <WsMsgDef.WsError>{}
        data.error = e
        ws.emit(WsMsgType.bot_error, data)

        // 调试
        if (config.debug) {
          bot.say('Wechaty error: ' + e.message)
        }
      })
      .on('login', user => {
        log.info('Bot', `Event: ${user.name()} logined`)
        // 调试
        if (config.debug) {
          bot.say('Wechaty login')
        }
        state.bot_login = true
        const data = <WsMsgDef.WsLogin>{
          nickname: user.name(),
          bot_name: config.bot_name,
        }
        ws.emit(WsMsgType.bot_login, data)
        setTimeout(function () {
          ws.emit(WsMsgType.bot_get_data, {
            room: true,
            config: true,
          })
        }, 1000);
      })
      .on('logout', user => {
        state.bot_login = false
        log.info('Bot', `${user.name()} logouted`)
        const data = <WsMsgDef.WsLogout>{}
        data.nickname = user.name()
        ws.emit(WsMsgType.bot_logout, data)
      })

      .on('scan', (url, code) => {
        if (code * 1 === 0) {
          // NOTE: qrcode是二维码图片，l是二维码实际内容
          // const loginUrl = url.replace(/\/qrcode\//, '/l/')
          const data = {
            // url: loginUrl,
            url,
            bot_name: config.bot_name,
          }
          state.bot_login = false
          log.info(`emit scan event: %s`, JSON.stringify(data))
          ws.emit(WsMsgType.bot_scan, data)
        }
        console.log(`[${code}] Scan QR Code in above url to login: \n${url}\n`)
      })
  }

  /**
   * 监听消息事件
   *
   * @private
   * @memberof BotExtend
   */
  private addMsgEvent() {
    log.info('BotExtend', 'call addMsgEvent()')
    const { bot, ws, cache, config } = this.app
    bot
      .on('message', async m => {
        const msg = m.content()
        const contact = m.from()
        const room = m.room()
        const mentioned = m.mentioned() || []
        const atList = new Set()
        const debug = config.debug
        let owner: Contact | null
        let atMe = false
        // let avatar = ''
        // if (contact) {
        //   avatar = await contact.avatar()
        // }

        if (m.self()) {
          // DEBUG:用于测试环境
          if (/删群/.test(msg) && room && debug) {
            log.info('\n按照指令开始删群 "%s"', room.topic())
            const list = room.memberList()
            for (const cc of list) {
              await room.del(cc)
              await new Promise((res, rej) => {
                setTimeout(function () {
                  res()
                }, 500)
              })
            }
            await room.quit()
          }
          return
        }

        // TODO: 有新的信息
        let rule
        if (m.type() !== MsgType.TEXT || !contact.personal()) {
          return
        }
        const data = <WsMsgDef.WsMessage>{}
        data.userId = contact.id
        data.alias = contact.alias() || ''
        data.nickname = contact.name()
        data.gender = contact.gender()
        data.date = m.obj.date
        // 如果没有alias，则设置为访客模式，使用一个临时alias，然后让服务器端注册并设置正式alias
        // log.info('Bot', '组装中的data: %s', JSON.stringify(data))
        if (!data.alias) {
          data.guest = true
          if (!cache.contactMap.has(data.userId)) {
            // log.info('Bot', 'contactMap不含: "%s" 需要设置', JSON.stringify(data.userId))
            cache.contactMap.set(data.userId, 'tmp#' + data.userId)
          }
          data.alias = cache.contactMap.get(data.userId)
          // log.info('Bot', 'contactMap中找到 "%s" 的alias为 "%s"', data.userId, data.alias)
        }

        // log.info('Bot', '组装后的data: %s', JSON.stringify(data))
        if (!room) {
          // 用户绑定
          rule = cache.regexpList.get('getKey') || /^\s*[绑定]*([\w\-_]{16,32})\s*$/i
          const o = rule.exec(msg)
          if (o) {
            // 绑定key
            data.key = o[1]
            log.info('Bot:', `用户 (%s) 请求绑定, alias(%s)，绑定码: %s`, data.nickname, data.alias, data.key)
            ws.emit(WsMsgType.bot_bind, data)
            return
          }

          // DEBUG: 调试测试
          if (debug) {
            if (/^\s*映射\s*$/i.test(msg)) {
              let t = '联系人id -> alias映射如下：'
              cache.contactMap.forEach(i => {
                t += '\n' + i
              })
              m.say(t)
              return
            }

            if (/^\s*群映射\s*$/i.test(msg)) {
              let t = '房间id -> topic映射如下：'
              cache.roomMap.forEach(i => {
                t += '\n' + t
              })
              m.say(t)
              return
            }

            if (/^alias$/i.test(msg)) {
              console.log('调试指令 设置alias，当前alias:%s', data.alias)
              if (!data.alias) {
                console.log('没有alias，取消')
                return
              }
              // contact.alias('test222222222!!!')
              const c = await this.app.getContact(data.alias)
              if (!c) {
                log.warn('Bot', 'test alias Can\' find contact, alias: %s', data.alias)
                // TODO: 添加失败汇报
                return
              }
              this.app.setAlias(c, 'testAlias')
            }
            if (/^a$/i.test(msg)) {
              console.log('调试指令 获取alias，当前alias:%s', data.alias)
              return
            }
          }

        }
        log.silly('Bot:', ` ${data.nickname} : ${msg}`)
        // ----- 以下处理群信息部分

        // TODO:需要对这部分进行重构整理

        if (room) {
          const topic = room.topic()
          if (!topic) {
            await room.refresh()
          }
          data.topic = room.topic()
          data.roomId = room.toString() || ''
          owner = room.owner()
          if (owner) {
            const tmp = {
              alias: await owner.alias() || '',
              nickname: await owner.name() || '',
            }
            if (tmp.alias || tmp.nickname) {
              data.owner = tmp
            }
          }
          if (!cache.roomMap.has(data.roomId)) {
            // 访问后端服务，获取room的相关信息
            ws.emit(WsMsgType.bot_get_data, {
              topic: data.topic,
            })
            await new Promise((res, rej) => {
              setTimeout(() => {
                res()
              }, 1000)
            })
          }
          const rMap = cache.roomMap.get(data.roomId)
          data.gid = rMap ? rMap.gid : ''

          // console.log('即将获取at用户列表')
          mentioned.forEach(c => {
            if (c.self()) {
              atMe = true
            }
            atList.add({
              alias: c.alias(),
              nickname: c.name(),
              id: c.id,
            })
          })
          data.atList = atList
        }

        // 群管理指令
        // if (room && atMe && data.alias && cache.whiteUserList.has(data.alias)) {
        //   rule = /^(开启服务)$/i
        //   if (!room.toString()) {
        //     log.warn('Bot', 'Room id is null')
        //   }
        //   const r = cache.roomMap.get(room.toString())
        //   if (!r) {
        //     // TODO: 交由后台建立群信息，开启对本群的服务
        //   }
        //   return
        // }

        // 提交群内 白名单用户指令
        if (data.alias && cache.whiteUserList.has(data.alias)) {
          rule = /^\s*#(设置群组|群组).*$/i
          if (rule.test(msg)) {
            data.msg = msg
            log.info('Bot:', `发送信息给后台%s`, JSON.stringify(data))
            ws.emit(WsMsgType.bot_message, data)
            return
          }
        }

        // console.log('data:')
        // console.log(data)
        if (room && data.alias) {
          // const tx1 = cache.roomMap.get(room.toString())
          // console.log('------------')
          // console.log('从roomMap中获取群信息:')
          // console.log(tx1)
          // console.log('------------ msg:')
          // console.log(msg)
          // console.log('------------ room:')
          // console.log(room)
          // console.log('------------')

          rule = cache.regexpList.get('remove') || /(移出|踢)/i
          if (!room.toString()) {
            log.warn('Bot', 'Room id is null')
          } else if (rule.test(msg)) {
            const r = cache.roomMap.get(room.toString())
            if (r && r.admin.has(data.alias)) {
              const cl: ContactQueryFilter[] = []
              atList.forEach(c => {
                if (c.alias && !r.admin.has(c.alias)) {
                  cl.push({ alias: c.alias, name: c.nickname })
                }
              })
              // TODO:是否允许群管理批量踢人？
              log.silly('Bot', '准备从群"%s"踢人:\n%s', room.topic(), JSON.stringify(cl))
              await this.removeMerber({ topic: room.topic() }, cl)
              return
            }
          }
        }

        // 取消行程
        rule = cache.regexpList.get('closeTrip') || /^\s*(取消行程|取消)\s*$/i
        if (rule.test(msg)) {
          log.info('Bot', 'OnMsg 用户 "%s" 发送了取消行程的指令 "%s"', data.alias, msg)
          data.done = false
          ws.emit(WsMsgType.bot_close_trip, data)
          return
        }
        // 完成行程
        rule = cache.regexpList.get('finishTrip') || /^\s*(完成行程|完成)\s*$/i
        if (rule.test(msg)) {
          log.info('Bot', 'OnMsg 用户 "%s" 发送了完成行程的指令 "%s"', data.alias, msg)
          data.done = true
          ws.emit(WsMsgType.bot_close_trip, data)
          return
        }

        // 发布行程-人找车
        // TODO: 指令需完善
        // rule = cache.regexpList.get('newTrip') || /^\s*[【|\[]{0,1}车找人[】|\]]{0,1}\s*[：|:]{0,1}\s*.*\s*$/i
        // const x = rule.exec(msg)
        // if (x) {
        //   data.msg = msg
        //   // TODO:发送到后台处理
        //   ws.emit(WsMsgType.bot_pub_trip, data)
        //   return
        // }

        // 其他任何信息发给后台
        if (m && m.rawObj && m.type() === MsgType.TEXT && m.typeSub() === MsgType.LOCATION) {
          data.type = 'location'
          data.url = m.rawObj.MMLocationUrl
          data.msg = m.rawObj.MMLocationDesc
        } else {
          data.msg = msg
        }
        log.info('Bot:', `发送信息给后台%s`, JSON.stringify(data))
        ws.emit(WsMsgType.bot_message, data)

      })
  }

  /**
   * 监听房间类事件
   *
   * @private
   * @memberof BotExtend
   */
  private addRoomEvent() {
    log.info('BotExtend', 'call addRoomEvent()')
    const { bot, ws, config, cache, cacheExtend } = this.app
    bot
      .on('room-join', (room, list, i) => {
        if (config.debug) {
          log.silly('Bot', 'Event: Room-join: %s join %s', room.topic(), i.name)
        }
        // TODO:有人进群
      })
      .on('room-leave', (room, leaveList) => {
        if (config.debug) {
          log.silly('Bot', 'Event: Room-leave: Room %s lost member %s', room.topic(), leaveList.map(c => c.name()).join(','))
        }
      })
      .on('room-topic', async (room, topic, oldTopic, changer) => {
        let recover = false
        const onlyOwner = true
        await room.refresh()
        log.info('Bot', 'Event: Room-topic: Room "%s" change topic to "%s" by member "%s"', oldTopic, topic, changer.name())
        if (changer.self() || topic === oldTopic) {
          return
        }
        const roomMap = cache.roomMap.get(room.id)
        if (!roomMap || roomMap.type === RoomType.other) {
          // 如果群不在映射表里，或者群类型是其他
          // 则认为是无关群，不管理其改名
          return
        }

        // if (roomMap && roomMap.onlyOwnerChangeTopic !== undefined) {
        //   onlyOwner = roomMap.onlyOwnerChangeTopic
        // }

        // 只有bot是群主时才会修改房间名称
        const owner = room.owner()
        if (owner && owner.self()) {
          recover = true
        }
        const alias = changer.alias()
        if (alias && cache.whiteUserList.has(alias) || owner === changer) {
          // TODO: 提示管理员使用指令修改
          const rooms = await Room.findAll({ topic })
          if (!rooms || rooms.length > 1) {

            // recover = true
            await room.say('提示：房间名称有重复！', changer)
            log.warn('Bot', '房间 "%s" 被 "%s" 改名为 "%s" 后存在重名', oldTopic, changer.name(), topic)
          }
        }
        cacheExtend.setOldTopic(room.id, oldTopic, topic)
        if (recover && (!onlyOwner || owner)) {
          if (roomMap && topic !== roomMap.topic) {
            // TODO:需要加入改名队列
            await room.topic(roomMap.topic)
          }
        } else {
          // TODO:通知服务器端绑定新名称
          const data = <WsMsgDef.WsRoomTopic>{}
          data.roomid = room.id
          data.newTopic = topic
          data.oldTopic = oldTopic
          if (roomMap) {
            data.gid = roomMap.gid || ''
          }
          ws.emit(WsMsgType.bot_room_topic, data)
        }
      })
  }

  private addFriendEvent() {
    log.info('BotExtend', 'call addFriendEvent()')
    const { bot, config } = this.app
    bot
      .on('friend', async (contact, request) => {
        if (request) {
          // request.hello
          const result = await request.accept()
          if (result) {
            if (config.newFriendRevMsg) {
              await contact.say(config.newFriendRevMsg)
            }
            console.log(`Request from ${contact.name()} is accept succesfully!`)
          } else {
            console.log(`Request from ${contact.name()} failed to accept!`)
          }

        } else {
          // logMsg = 'friend ship confirmed with ' + contact.get('name')
        }
      })
  }

  /**
   * 从群中移除一个或多个联系人
   *
   * 每个操作间隔3秒
   *
   * @private
   * @param {RoomQueryFilter} room
   * @param {ContactQueryFilter[]} contact
   * @returns
   * @memberof BotExtend
   */
  public async removeMerber(room: RoomQueryFilter, contact: ContactQueryFilter[]) {
    const r = await Room.find(room)
    const contacts = Array.isArray(contact) ? contact : [contact]
    if (!r) {
      log.warn('Bot', 'removeMerber() not find room by: %s ', JSON.stringify(room))
      return
    }
    // const owner = await r.owner()
    // if (!owner || !owner.self()) {
    //   log.warn('Bot', 'removeMerber() Bot is\'t owner for room "%s" ', r.topic())
    //   return
    // }
    let count = 0
    // console.log('准备操作的room信息： %s', JSON.stringify(r))
    // console.log('准备进入contacts循环，contacts: %s', JSON.stringify(contacts))
    contacts.forEach(async i => {
      let c
      if (!i.alias && !i.name) {
        return
      }
      if (i.alias) {
        c = await Contact.find({ alias: i.alias })
      }
      if (!c && i.name) {
        c = await Contact.find({ name: i.name })
      }
      if (c) {
        // console.log('准备踢人: %s', JSON.stringify(c))
        if (this.app.cache.whiteUserList.has(c.alias)) {
          log.warn('Bot', 'removeMerber() Bot can\'t remove member "%s" becuase member in white list.', c.name())
          return
        }
        await new Promise((res, rej) => {
          // TODO:踢人前是否需要先提示？
          log.silly('Bot', 'removeMerber() remove member "%s"', c.name())
          r.del(c).then(() => {
            count++
            setTimeout(() => {
              res()
            }, 5000)
          })
        })
      }
    })
    return count
  }
}
