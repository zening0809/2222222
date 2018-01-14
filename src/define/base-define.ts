/**
 * 系统参数
 *
 * @export
 * @interface Config
 */

export interface Config {
  /**
   * Websocket地址，如 ws://127.0.0.1/bot
   *
   * @type {string}
   * @memberof Config
   */
  ws: string,
  /**
   * 会话Cookie文件路径或文件名
   *
   * @type {string}
   * @memberof Config
   */
  profile: string,
  /**
   * Bot的名称，需与后台设置的一致。
   *
   * @type {string}
   * @memberof Config
   */
  bot_name: string,
  /**
   * 调试开关，打开后有更多输出信息
   *
   * @type {boolean}
   * @memberof Config
   */
  debug: boolean,
  /**
   * 操作阈值
   *
   * limit_msg 信息发送间隔时间，单位秒
   *
   * limit_alias 别名操作间隔时间，单位秒
   *
   * limit_create_room 创建群操作间隔时间，单位秒
   *
   * @memberof Config
   */
  locker: {
    limit_msg: number,
    limit_alias: number,
    limit_create_room: number,
  },
  /**
   * 白名单用户列表（用户的alias）
   *
   * @type {string[]}
   * @memberof Config
   */
  whiteUserList: string[],
  /**
   * bot列表（alias）
   *
   * @type {string[]}
   * @memberof Config
   */
  botAliasList: string[],
  /**
   * 新好友自动回复信息
   *
   * @type {string}
   * @memberof Config
   */
  newFriendRevMsg: string,
}

/**
 * Bot操作锁
 *
 * 用于控制操作间隔
 *
 * @interface Locker
 */
export interface Locker {
  /**
   * 状态锁
   *
   * @type {boolean}
   * @memberof Locker
   */
  lock: boolean,
  /**
   * 操作计数器
   *
   * @type {number}
   * @memberof Locker
   */
  count?: number,
  /**
   * 间隔时间，单位毫秒
   *
   * @type {number}
   * @memberof Locker
   */
  limit_time: number,
  /**
   * 上次操作时间
   *
   * @type {number}
   * @memberof Locker
   */
  last_time?: number,
}

/**
 * Bot状态
 *
 * 在App中使用
 *
 * @export
 * @interface BotState
 */
export interface BotState {
  /**
   * 发送信息 锁
   *
   * @type {Locker}
   */
  sendMsgLocker: Locker,
  /**
   * 发送信息定时器
   *
   * @type {NodeJS.Timer}
   * @memberof BotState
   */
  sendMsgTimer: NodeJS.Timer,
  /**
   * 修改别名 锁
   *
   * @type {Locker}
   */
  aliasLocker: Locker,
  /**
   * 修改别名定时器
   *
   * @type {NodeJS.Timer}
   * @memberof BotState
   */
  aliasTimer: NodeJS.Timer,
  /**
   * 建群 锁
   *
   * @type {Locker}
   */
  createRoomLocker: Locker,
  /**
   * 建群定时器
   *
   * @type {NodeJS.Timer}
   * @memberof BotState
   */
  createRoomTimer: NodeJS.Timer,
  /**
   * 上报bot状态定时器
   *
   * @type {NodeJS.Timer}
   * @memberof BotState
   */
  reportTimer: NodeJS.Timer,
  /**
   * 是否允许Bot进行服务
   *
   * @type {boolean}
   * @memberof BotState
   */
  bot_usable: boolean,
  /**
   * Bot是否在运行
   *
   * @type {boolean}
   * @memberof BotState
   */
  bot_running: boolean,
  /**
   * Bot是否已登录
   *
   * @type {boolean}
   * @memberof BotState
   */
  bot_login: boolean,
}

export interface BotMsg {
  text: string,
  roomTopic?: string,
  userAlias?: string,
  atList: Set<string>,
  merge?: boolean
}
