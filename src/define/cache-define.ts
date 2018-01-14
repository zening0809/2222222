import * as EnumDef from './enum-define';

/**
 * 映射房间信息
 *
 * @export
 * @interface RoomMap
 */
export interface RoomMap {
  /**
   * 房间名
   *
   * @type {string}
   * @memberof RoomMap
   */
  topic: string,
  /**
   * 房间类型
   *
   * @type {string}
   * @memberof RoomMap
   */
  type: EnumDef.RoomType,
  /**
   * 房间在服务器端的id
   *
   * @type {string}
   * @memberof RoomMap
   */
  gid?: string,
  /**
   * 房间管理员信息
   *
   *  <用户alias, 用户权限>
   */
  // Map<string, Set<string>>
  admin: Set<string>
}

/**
 * 房间名称缓存
 *
 * 用于房间名称改变后的延时容差
 *
 * @export
 * @interface RoomTopicCache
 */
export interface RoomTopicCache {
  /**
   * 房间id，可通过房间信息映射<RoomMap>来重定向到房间
   *
   * @type {string}
   * @memberof RoomTopicCache
   */
  roomId: string,
  /**
   * 房间新名称
   *
   * @type {string}
   * @memberof RoomTopicCache
   */
  newTopic: string,
  /**
   * 本缓存的信息合并时间段
   *
   * @type {number}
   * @memberof RoomTopicCache
   */
  expireTime: number
}

/**
 * 待发信息队列Map的值
 *
 * @export
 * @interface WaitMsgData
 */
export interface WaitMsgData {
  /**
   * 信息类型
   *
   * @type {string}
   * @memberof WaitMsgData
   */
  // TODO: 需要考虑发送图片及其他类型的信息
  type?: string,
  /**
   * 信息内容
   *
   * @type {string}
   * @memberof WaitMsgData
   */
  text: string,
  /**
   * At用户的id列表
   *
   * @type {Set<string>}
   * @memberof WaitMsgData
   */
  atList: Set<string>,
  /**
   * 信息建立时间
   *
   * @type {Date}
   * @memberof WaitMsgData
   */
  time?: Date,
  errCount: number,
}

/**
 * 待发信息队列Map的键
 *
 * @export
 * @interface WaitMsgKey
 */
export interface WaitMsgKey {
  /**
   * 房间topic
   *
   * @type {string}
   * @memberof WaitMsgKey
   */
  roomTopic?: string,
  /**
   * 用户alias
   *
   * @type {string}
   * @memberof WaitMsgKey
   */
  userAlias?: string,
  /**
   * 最晚发送时间
   *
   * @type {Date}
   * @memberof WaitMsgKey
   */
  time?: Date,
  /**
   * 允许合并消息
   *
   * @type {boolean}
   * @memberof WaitMsgKey
   */
  merge?: boolean,
  /**
   * 产生随机数防止重复
   *
   * @type {number}
   * @memberof WaitMsgKey
   */
  random?: number
}

/**
 * 新建群的信息
 *
 * @export
 * @interface NewRoomInfo
 */
export interface NewRoomInfo {
  topic: string,
  members: Set<string>,
  type: string
}

/**
 * 定义数据缓存结构
 *
 * @export
 * @interface CacheData
 */
export interface CacheData {

  /**
   * 待核实信息的roomid列表
   *
   * @type {Set<string>}
   * @memberof CacheData
   */
  ukRoom: Set<string>,

  /**
   * 待核实信息的userid列表
   *
   * @type {Set<string>}
   * @memberof CacheData
   */
  ukUser: Set<string>,

  /**
   * 房间信息映射列表
   *
   * 即 @@roomid -> 房间信息
   *
   * @type {Map<string, RoomMap>}
   * @memberof CacheData
   */
  roomMap: Map<string, RoomMap>,

  /**
   * 联系人信息映射表
   *
   * 用@id映射 alias
   *
   * @type {Map<string,string>}
   * @memberof CacheData
   */
  contactMap: Map<string, string>,
  /**
   * 房间改名后的延时容差缓存
   *
   * 房间旧topic -> 房间信息
   *
   * @type {Map<string, RoomTopicCache>}
   * @memberof CacheData
   */
  roomOldTopic: Map<string, RoomTopicCache>,

  /**
   * 待发信息队列
   *
   * @type {Map<WaitMsgKey, WaitMsgData>}
   * @memberof CacheData
   */
  waitMsg: Map<WaitMsgKey, WaitMsgData>,
  /**
   * 待改alias列表
   *
   * key为 联系人id，value为新alias
   * @type {Map<string,string>}
   * @memberof CacheData
   */
  waitAlias: Map<string, string>,
  /**
   * 待建群列表
   *
   * key为 任务id，value为新群信息
   * @type {Map<string, NewRoomInfo>}
   * @memberof CacheData
   */
  waitCreateRoom: Map<string, NewRoomInfo>,
  /**
   * 信息模板列表
   *
   * @type {Map<string, string>}
   * @memberof CacheData
   */
  msgTpl: Map<string, string>,
  /**
   * 正则匹配列表
   *
   * @type {Map<string, RegExp>}
   * @memberof CacheData
   */
  regexpList: Map<string, RegExp>,
  /**
   * 白名单用户alias列表
   *
   * 白名单用户有如下特权：
   * * 不被踢出房间
   *
   * TODO: 需要补充
   *
   * @type {Set<string>}
   * @memberof CacheData
   */
  whiteUserList: Set<string>
  /**
   * 其他Bot的alias列表
   *
   * 建群时会被拉进群，且自动加入白名单
   *
   * @type {Set<string>}
   * @memberof CacheData
   */
  botAliasList: Set<string>,
}
