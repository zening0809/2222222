import * as Websocket from 'socket.io-client';
import { CacheExtend } from './cache-extend';
import { EventEmitter } from 'events';
import {
  AppEvent,
  BaseExtend,
  BotMsg,
  BotState,
  CacheDef,
  Config,
  Contact,
  log,
  Room,
  uuid,
  Wechaty,
  WsMsgDef,
  Locker,
} from './common';

export class App extends EventEmitter {
  public ws: SocketIOClient.Socket
  public bot: Wechaty
  /**
   * 运行配置
   * @type {Config}
   * @memberof App
   */
  public config: Config
  /**
   * 数据缓存
   * @type {CacheDef.CacheData}
   * @memberof App
   */
  public cache: CacheDef.CacheData
  /**
   * 数据缓存扩展
   *
   * @type {Cache}
   * @memberof App
   */
  public cacheExtend: CacheExtend
  /**
   * 运行状态数据
   * @type {BotState}
   * @memberof App
   */
  public state: BotState
  /**
   * 唯一运行标识
   * @type {string}
   * @memberof App
   */
  public uuid: string
  /**
   * 功能扩展
   * @type {BaseExtend[]}
   * @memberof App
   */
  public extend: BaseExtend[]

  /**
   * Creates an instance of App.
   * @param {Config} config
   * @memberof App
   */
  public constructor(config: Config) {
    super()
    log.info('App', 'new App()')
    this.uuid = uuid.v1()
    this.config = config
    this.loadEvent()
    this.init()
    CacheExtend.inject(this)
  }

  private init() {
    this.cache = <CacheDef.CacheData>{
      ukRoom: new Set(),
      ukUser: new Set(),
      roomMap: new Map(),
      contactMap: new Map(),
      roomOldTopic: new Map(),
      waitMsg: new Map(),
      waitAlias: new Map(),
      waitCreateRoom: new Map(),
      msgTpl: new Map(),
      regexpList: new Map(),
      whiteUserList: new Set(),
      botAliasList: new Set(),
    }
    this.state = <BotState>{
      aliasLocker: <Locker>{},
      sendMsgLocker: <Locker>{},
      createRoomLocker: <Locker>{},
      bot_login: false,
      bot_running: false,
      bot_usable: false,
    }

    this.extend = []
    this.loadSetting()
    this.ws = Websocket(this.config.ws)
    this.bot = Wechaty.instance({ profile: this.config.profile })
  }

  /**
   * 注入扩展
   *
   * @param {BaseExtend} extend
   * @memberof App
   */
  public inject(extend: BaseExtend) {
    this.extend.push(extend)
  }

  /**
   * 载入配置项
   *
   * 在接收到服务器更新配置的指令后，可以调用以刷新当前应用的配置
   *
   * @memberof App
   */
  public loadSetting() {
    this.state.aliasLocker.limit_time = this.config.locker.limit_alias || 10 * 1000
    this.state.sendMsgLocker.limit_time = this.config.locker.limit_msg || 10 * 1000
    this.state.createRoomLocker.limit_time = this.config.locker.limit_create_room || 5 * 1000
    this.config.whiteUserList.forEach(i => {
      this.cache.whiteUserList.add(i.trim())
    })
    this.config.botAliasList.forEach(i => {
      this.cache.botAliasList.add(i.trim())
    })
    for (const v of this.cache.botAliasList.values()) {
      this.cache.whiteUserList.add(v)
    }
  }

  /**
   * 加载基础事件
   *
   * @memberof App
   */
  public loadEvent() {
    this
      .on('error', e => {
        log.warn('App', 'Error: %s', e)
      })
      .on(AppEvent.start_bot, () => {
        log.info('App', 'start bot...')
        // TODO: 待服务器后端配置完善后，此处需要启用
        // this.state.bot_running = false
        // this.state.bot_usable = false

        // 在bot扩展的实例化中监听此事件，并init bot
        clearInterval(this.state.reportTimer)
        // 每30秒上传一次运行状态
        this.state.reportTimer = setInterval(async () => { await this.reportState() }, 30000)
      })
      .on(AppEvent.pause_bot, () => {
        log.info('App', 'pause bot service')
        this.state.bot_usable = false
        clearInterval(this.state.sendMsgTimer)
        clearInterval(this.state.aliasTimer)
        clearInterval(this.state.createRoomTimer)
        // TODO: 修改别名定时器
      })
      .on(AppEvent.resume_bot, () => {
        log.info('App', 'resume bot service')
        this.state.bot_usable = true

        clearInterval(this.state.sendMsgTimer)
        clearInterval(this.state.aliasTimer)
        clearInterval(this.state.createRoomTimer)
        this.state.sendMsgTimer = setInterval(() => { this.msgTiming() }, this.state.sendMsgLocker.limit_time)
        this.state.aliasTimer = setInterval(() => { this.aliasTiming() }, this.state.aliasLocker.limit_time)
        this.state.createRoomTimer = setInterval(() => { this.createRoomTiming() }, this.state.createRoomLocker.limit_time)
      })
      .on(AppEvent.restart_bot, () => {
        log.info('App', 'restart bot...')
        this.bot.quit()
        this.state.bot_running = false
        this.state.bot_usable = false
        this.state.bot_login = false
        this.emit(AppEvent.start_bot)
      })
      .on(AppEvent.quit, msg => {
        this.state.bot_usable = false
        log.info('App', 'EVENT: quit because: %s', msg)
        this.quit()
      })
  }

  /**
   * 关闭整个程序运行
   *
   * @param {number} [code=0] 退出码
   * @memberof App
   */
  public quit(code = 0) {
    log.info('App', 'App exit %d bacause of call quit()', code)
    this.bot.quit()
    this.ws.close()
    process.exit(code)
  }

  /**
   * 设置联系人备注
   *
   * @param {Contact} contact
   * @param {string} alias
   * @memberof App
   */
  public setAlias(contact: Contact, alias: string) {
    const map = this.cache.contactMap.get(contact.id) || ''
    // 如果联系人现在的alias和要设置的alias一致，或者alias是当前id，则跳过
    if (contact.alias() === alias || alias === map) {
      log.silly('App', 'setAlias() 要设置的alias不必要，跳过')
      return
    }
    // contact.alias(alias).then(r => {
    //   log.silly('App', 'setAlias() 设置用户 "%s" alias 为 "%s" %s ', contact.id, alias, r ? '成功' : '失败')
    // }).catch(e => {
    //   log.silly('App', 'setAlias() 设置用户 "%s" alias 为 "%s" 出现异常: \n%s ', contact.id, alias, JSON.stringify(e))
    // })
    log.silly('App', 'setAlias() 进入alias设置队列, id: "%s" , alias: "%s"', contact.id, alias)
    this.cache.contactMap.set(contact.id, alias)
    this.cache.waitAlias.set(contact.id, alias)
  }

  /**
   * 添加待建房间
   *
   * @param {string} taskId
   * @param {CacheDef.NewRoomInfo} room
   * @returns
   * @memberof App
   */
  public async createRoom(taskId: string, room: CacheDef.NewRoomInfo): Promise<boolean> {
    if (!room) {
      const err = '创建群失败：缺少群基础信息！'
      log.warn('App', err)
      throw new Error(err)
    }
    if (!room.topic) {
      const err = '创建群失败：没有指定群名称！'
      log.warn('App', err)
      throw new Error(err)
    }
    if (room.members.size < 2) {
      const err = '创建群失败：群基础成员数量不足！'
      log.warn('App', err)
      throw new Error(err)
    }
    const r = await Room.find({ topic: room.topic })
    if (r) {
      // TODO: 要创建的房间已经存在，应该如何去判断？
      await r.say('Hi!\n你要创建的房间已经存在！')
      const err = `创建群失败：要创建的群 "${room.topic}" 已存在！将直接认定创建成功！`
      log.warn('App', 'createRoom()', err)
      this.ws.emit(WsMsgDef.WsMsgType.bot_created_room, {
        topic: room.topic,
        taskId,
      })
      throw new Error(err)
    }
    this.cache.waitCreateRoom.set(taskId, room)
    return true
  }

  /**
   * 添加信息进入Bot信息队列
   *
   * @param {BotMsg} msg
   * @memberof App
   */
  public addSay(msg: BotMsg) {
    const timeLimit = Math.ceil(this.config.locker.limit_msg * 1.5)
    const maxTextSize = 500
    const maxAtNum = 20
    const key = <CacheDef.WaitMsgKey>{}
    let data = <CacheDef.WaitMsgData>{}
    key.userAlias = msg.userAlias
    key.roomTopic = msg.roomTopic
    key.merge = msg.merge
    data.text = msg.text
    data.time = new Date()
    data.errCount = 0
    if (msg.roomTopic && msg.atList) {
      data.atList = msg.atList
    }
    let time = Date.now()
    time = Math.ceil(time / timeLimit) * timeLimit
    key.time = new Date(time)
    if (key.merge) {
      const wMsg = this.cache.waitMsg.get(key)
      // 如果信息合并字数少，则进行合并
      if (wMsg) {
        const textSize = wMsg.text.length + msg.text.length
        const atNum = wMsg.atList.size + (msg.atList.size || 0)
        if (textSize < maxTextSize && atNum < maxAtNum) {
          // 合并重复内容
          if (wMsg.text !== msg.text) {
            wMsg.text = wMsg.text + '\n\n-----\n\n' + msg.text
          }
          if (msg.atList) {
            msg.atList.forEach(i => {
              wMsg.atList.add(i)
            })
          }
          data = wMsg
        } else {
          key.random = Math.random()
        }
      }
    } else {
      key.random = Math.random()
    }
    // FIXME: 可能存在无法合并信息的问题
    this.cache.waitMsg.set(key, data)
  }

  /**
   * 遍历信息队列发送信息
   *
   * @memberof App
   */
  public async msgTiming() {
    // log.silly('App', 'msgTiming() in')
    const { cache, state, bot } = this
    if (!state.bot_running || !state.bot_login || !state.bot_usable) {
      return
    }
    if (!state.sendMsgLocker.lock && cache.waitMsg.size > 0) {
      state.sendMsgLocker.lock = true
      const startTime = Date.now()
      let sendCount = 0
      if (state.sendMsgLocker.count === undefined) {
        state.sendMsgLocker.count = 0
      }
      for (const [key, msg] of cache.waitMsg) {
        let isSend = false
        if (!state.bot_usable || !state.bot_running) {
          break
        }
        if (msg && msg.text && (key.roomTopic || key.userAlias)) {
          if (key.roomTopic) {
            const room = await Room.find({ topic: key.roomTopic })
            if (room) {
              const contact: Contact[] = []
              if (msg.atList && msg.atList.size > 0) {
                for (const at of msg.atList) {
                  const c = await this.getContact(at)
                  if (c) {
                    contact.push(c)
                  }
                }
              }
              room.say(msg.text, contact)
              isSend = true
              sendCount++
            } else {
              log.warn('App', 'msgTiming() 找不到群 "%s"', key.roomTopic)
              await bot.say(`未找到群 "${key.roomTopic}" ，无法将信息发送到群内！\n如果确定此群组存在，请在此群内发任意信息激活此群！`)
            }
          } else if (key.userAlias) {
            const c = await this.getContact(key.userAlias)
            if (c) {
              c.say(msg.text)
              isSend = true
              state.sendMsgLocker.count++
              sendCount++
            }
          }
          state.sendMsgLocker.last_time = Date.now()
        } else {
          log.warn('App', 'msgTiming() msg obj error? \n key: %s\ndata: %s', JSON.stringify(key), JSON.stringify(msg))
        }
        if (isSend) {
          // 如果发送成功才从队列中清除
          cache.waitMsg.delete(key)
        } else {
          msg.errCount++
          cache.waitMsg.set(key, msg)
        }
        if (msg.errCount >= 3) {
          log.warn('App', 'msgTiming() 信息发送失败达到3次，将清除此任务:\n key: %s\ndata: %s', JSON.stringify(key), JSON.stringify(msg))
          cache.waitMsg.delete(key)
        }
        // 延时
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(true)
          }, state.sendMsgLocker.limit_time)
        })
      }
      const endTime = Date.now()
      state.sendMsgLocker.lock = false
      log.silly('App', 'msgTiming() send %d msg, Total time: %d ms', sendCount, endTime - startTime)
    }
  }

  public async aliasTiming() {
    // log.silly('App', 'aliasTiming() in')
    const { cache, state, bot } = this
    if (!state.bot_running || !state.bot_login || !state.bot_usable) {
      return
    }
    if (!state.aliasLocker.lock && cache.waitAlias.size > 0) {
      state.aliasLocker.lock = true
      const startTime = Date.now()
      let aliasCount = 0
      if (state.aliasLocker.count === undefined) {
        state.aliasLocker.count = 0
      }
      for (const [key, val] of cache.waitAlias) {
        const wait = val
        if (!state.bot_usable || !state.bot_running || !wait) {
          break
        }
        const contact = await Contact.load(key)
        let ret
        if (!contact) {
          log.warn('App', 'aliasTiming()  Load Contact %s fail.', key)
          continue
        }
        ret = await contact.alias(val)
          .catch(e => {
            log.error('App', 'aliasTiming() 修改用户 "%s" 备注为 "%s" 失败: %s', contact.name(), val, e.message)
          })
        if (this.config.debug) {
          await contact.say(`修改你的备注为 "${val}" ${ret ? '成功' : '失败'}`)
        }
        cache.contactMap.set(key, val)
        if (!ret) {
          log.warn('App', 'aliasTiming() Contact "%s", nickname "%s", Set alias "%s" fail.', key, contact.name(), val)
          await bot.say(`为用户 "${contact.name()}" 设置备注 "${val}" 失败！`)
        } else {
          log.silly('App', 'aliasTiming() Contact "%s", nickname "%s", Set alias "%s" ok.', key, contact.name(), val)
          aliasCount++
          state.aliasLocker.count++
          state.aliasLocker.last_time = Date.now()
          cache.waitAlias.delete(key)
        }
        // 延时
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(true)
          }, state.aliasLocker.limit_time)
        })
      }
      const endTime = Date.now()
      state.aliasLocker.lock = false
      log.silly('App', 'aliasTiming() set %d alias, Total time: %d ms', aliasCount, endTime - startTime)
    }
  }

  public async createRoomTiming() {
    // log.silly('App', 'createRoomTiming() in')
    const { cache, state, ws, bot } = this

    if (!state.bot_running || !state.bot_login || !state.bot_usable) {
      return
    }
    if (!state.createRoomLocker.lock && cache.waitCreateRoom.size > 0) {
      state.createRoomLocker.lock = true
      const startTime = Date.now()
      let createCount = 0
      if (state.createRoomLocker.count === undefined) {
        state.createRoomLocker.count = 0
      }
      for (const [key, val] of cache.waitCreateRoom) {
        const wait = val
        if (!state.bot_usable || !state.bot_running || !wait) {
          break
        }
        const contact: Contact[] = []
        for (const alias of val.members) {
          const c = await this.getContact(alias)
          if (c) {
            contact.push(c)
          }
        }
        if (contact.length < 2) {
          log.error('App', 'createRoomTiming() new room "%s" contact num < 2, can\'t create room!\ncontact list:\n%s\n', val.topic, JSON.stringify(contact))
        }
        const r = await Room.create(contact, val.topic)
          .catch(async e => {
            log.error('App', 'createRoomTiming() 创建群 "%s" 失败: ', val.topic, e.message)
          })
        if (r) {
          createCount++
          await r.ready()
          await r.topic(val.topic)
          await r.say('群 "' + val.topic + '" 创建完毕\n请勿随意更改群名称！')
          log.info('App', 'createRoomTiming() 任务ID:"%s" 创建群 "%s" 成功', key, val.topic)
          ws.emit(WsMsgDef.WsMsgType.bot_created_room, {
            topic: val.topic,
            taskId: key,
          })
          cache.waitCreateRoom.delete(key)
          // NOTE:这里需要通知服务器群建立成功
        } else {
          await bot.say(`创建群 "${val.topic}"失败！`)
        }
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve(true)
          }, state.createRoomLocker.limit_time)
        })
      }
      const endTime = Date.now()
      state.createRoomLocker.lock = false
      log.silly('App', 'createRoomTiming() create %d room, Total time: %d ms', createCount, endTime - startTime)
    }
  }

  /**
   * 根据alias获取联系人
   *
   * @param {string} alias 如果是tmp#开头的，则从中提起id，使用id加载联系人
   * @returns {(Promise<Contact | null>)}
   * @memberof App
   */
  public async getContact(alias: string): Promise<Contact | null> {
    if (!alias) {
      return null
    }
    const query = { alias }
    log.silly('App', 'getContact() 查找联系人使用条件为：%s', JSON.stringify(query))
    let contact = await Contact.find(query)
    if (!contact) {
      let id
      // 从联系人映射中，从alias取到id
      for (const [k, v] of this.cache.contactMap) {
        if (v === alias) {
          id = k
          break
        }
      }
      // 尝试从临时alias提取到id
      const r = /^tmp#(.*)/i.exec(alias)
      if (!id && r) {
        id = r[1]
      }
      if (id) {
        contact = await Contact.load(id)
      }
    }
    log.silly('App', 'getContact() Find alias "%s" 结果：%s', alias, contact)
    return contact
  }

  /**
   * 向服务器报告当前运行状态
   *
   * @memberof App
   */
  public async reportState() {
    const { ws, state } = this
    const data = {} as WsMsgDef.WsReport

    data.bot_login = state.bot_login || false
    data.bot_running = state.bot_running || false
    data.bot_usable = state.bot_usable || false
    data.uuid = this.uuid
    data.waitMsgCount = this.cache.waitMsg.size
    data.waitRoomCount = this.cache.waitCreateRoom.size
    data.waitAliasCount = this.cache.waitAlias.size

    const waitMsgCount = this.cache.waitMsg.size
    const waitRoomCount = this.cache.waitCreateRoom.size
    const waitAliasCount = this.cache.waitAlias.size

    log.silly('reportState()', '等待队列：%s', JSON.stringify({
      waitMsgCount,
      waitRoomCount,
      waitAliasCount,
    }))

    const users = await Contact.findAll()
    if (users && users.length > 0) {
      users.forEach(c => {
        // console.log(c.dump())
      })
    }

    ws.emit(WsMsgDef.WsMsgType.bot_report_state, data)
  }

  public loadRegExp() {
    // const { cache } = this
    // cache.regexpList.set('getKey', /^\s*[绑定]*([\w\-_]{16,32})\s*$/i)
    // cache.regexpList.set('closeTrip', /^\s*(取消行程|取消)\s*$/i)
    // cache.regexpList.set('finishTrip', /^\s*(完成行程|完成)\s*$/i)
    // // TODO: 发布行程指令需完善
    // cache.regexpList.set('newTrip', /^\s*(发布|新建)[行程]\s*$/i)
    // cache.regexpList.set('remove', /(移出|踢)/i)
  }
}

export default App
