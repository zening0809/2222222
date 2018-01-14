import { Gender } from './enum-define';

/**
 * Websocket通讯事件类型
 *
 * @export
 * @enum {string}
 */
export enum WsMsgType {
  bot_auth = 'auth',
  bot_scan = 'scan',
  bot_login = 'login',
  bot_logout = 'logout',
  bot_error = 'error',

  bot_get_data = 'get_data',
  bot_bind = 'bind',
  bot_pub_trip = 'pub_trip',
  bot_close_trip = 'close_trip',
  // bot_finish_trip = 'finish_trip',
  // 房间改名事件
  bot_room_topic = 'room_topic',
  // bot_admin_cmd = 'admin_cmd',
  bot_report_state = 'report_state',
  bot_message = 'message',
  bot_created_room = 'created_room',

  rev_auth = 'rev_auth',

  rev_msg = 'rev_msg',
  rev_data = 'rev_data',
  rev_command = 'rev_command',

}

export enum WsRevMsgType {
  rev_bind = 'rev_bind',
  pub_trip = 'pub_trip',
  close_trip = 'close_trip',
  finish_trip = 'finish_trip',
  trip_result = 'trip_result',
  trip_timeout = 'trip_timeout',
  warn_trip = 'warn_trip',
  // user_trip = 'user_trip',
}

export enum WsRevDataType {
  // msg_tpl = 'msg_tpl',
  config = 'config',
  // roomlist = 'roomlist',
  room = 'room',
  // alias = 'alias',
}

export enum WsRevCommandType {
  restart_bot = 'restart_bot',
  resume_bot = 'resume_bot',
  pause_bot = 'pause_bot',
  // 刷新数据
  create_room = 'create_room',
  set_alias = 'set_alias',
  set_topic = 'set_topic',
  add_member = 'add_member',
}

/**
 * ws身份登记
 *
 * 在bot向服务器建立连接完成后发送
 *
 * @export
 * @interface auth
 */
export interface WsAuth {
  /**
   * bot主服务实例uuid
   */
  uuid: string,
  /**
   * 登陆的bot的名称，用于后台区分登陆的是哪个bot
   *
   * 即运行变量中的`bot_name`参数，需要与后台设置的一致
   */
  bot_name: string,
  /**
   * bot昵称
   */
  nickname?: string,
  /**
   * 服务器返回，是否允许运行
   */
  allow_run?: boolean
}

/**
 * Bot需要扫码登陆
 *
 * @export
 * @interface scan
 */
export interface WsScan {
  /**
   * 二维码url
   *
   * @type {string}
   * @memberof scan
   */
  url: string
}

/**
 * Bot登陆完成
 *
 * @export
 * @interface login
 */
export interface WsLogin {
  /**
   * Bot的昵称
   */
  nickname: string
}

/**
 * Bot登出
 *
 * @export
 * @interface logout
 */
export interface WsLogout {
  /**
   * Bot的昵称
   */
  nickname: string
}

/**
 * 错误信息
 *
 * @export
 * @interface error
 */
export interface WsError {
  /**
   * 错误码
   */
  code?: number,
  /**
   * 错误信息
   */
  message?: string
  error?: Error
}

/**
 * 房间改名信息
 *
 * @export
 * @interface WsRoomTopic
 */
export interface WsRoomTopic {
  /**
   * 房间id，即@@xxx
   */
  roomid: string,
  oldTopic?: string,
  newTopic: string,
  /**
   * 房间在服务器端的id
   */
  gid?: string,
}

export interface WsMessage {
  /** 仅验证 */
  key?: string,
  // 信息类型 text,location
  type?: string,
  url?: string,
  /** 信息原文 */
  msg?: string,
  date?: string,
  userId?: string,
  alias?: string,
  nickname?: string,
  gender?: Gender,
  guest?: boolean,
  roomId?: string,
  topic?: string,
  atList?: Set<{
    userId?: string,
    alias: string,
    nickname: string,
  }>,
  /** 标识完成行程/关闭行程 */
  done?: boolean,
  owner?: {
    alias?: string,
    nickname?: string,
  },
  memberNum?: number
  gid?: string,
}

// TODO: 需补充服务器下发数据的定义

export interface WsRevAuth {
  /**
   * 房间id，即@@xxx
   */
  roomid: string,
  oldTopic?: string,
  newTopic: string,
  /**
   * 房间在服务器端的id
   */
  gid?: string,
}

export interface WsReport {
  uuid: string,
  /** bot是否已登陆 */
  bot_login: boolean
  /** bot是否在运行中 */
  bot_running: boolean,
  /** bot是否允许服务 */
  bot_usable: boolean,
  /** 消息发送 的等待队列数量 */
  waitMsgCount: number,
  /** 创建房间 的等待队列数量 */
  waitRoomCount: number,
  /** 联系人备注 的等待队列数量 */
  waitAliasCount: number,
}
