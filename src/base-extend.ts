import {
  App,
} from './common'

/**
 * 基础扩展
 *
 * 用于在App基础上扩充功能
 *
 * @export
 * @class BaseExtend
 */
export class BaseExtend {
  public app: App

  public constructor(app: App) {
    this.app = app
  }

  /**
   * 实例化扩展并注入app实例中
   *
   * @param {App} app
   * @memberof BaseExtend
   */
  public static inject(app: App) {
    app.inject(new this(app))
  }
}

export default BaseExtend
