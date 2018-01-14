import {
  App,
  BaseExtend,
  log,
  CacheDef,
} from './common'

export class CacheExtend extends BaseExtend {

  public constructor(app: App) {
    log.info('BotExtend', 'class init!')
    super(app)
    app.cacheExtend = this
  }

  /**
   * 设置容差房间名称
   *
   * 当群名称改后，服务器端可能会仍记录了老房间名称，就可以在这里查找了
   *
   * @param {any} roomId
   * @param {any} oldTopic
   * @param {any} newTopic
   * @memberof CacheExtend
   */
  public setOldTopic(roomId, oldTopic, newTopic) {
    const { cache } = this.app
    const room = <CacheDef.RoomTopicCache>{}
    room.roomId = roomId
    room.newTopic = newTopic
    // TODO: 有效期改为动态配置的
    room.expireTime = new Date().getTime() + 10 * 60 * 1000
    cache.roomOldTopic.set(oldTopic, room)
    return room
  }

  /**
   * 获取容差房间信息
   *
   * @param {any} oldTopic
   * @returns
   * @memberof CacheExtend
   */
  public getOldTopic(oldTopic) {
    const { cache } = this.app
    const room = cache.roomOldTopic.get(oldTopic)
    return room || false
  }
}

export default CacheExtend
