'use strict'

/**
 * 部署环境的配置 模板
 */

module.exports = {
  //后端服务器的ws地址
  ws: 'http://127.0.0.1:7001/bot',
  //bot cookie文件路径或文件名前缀。
  //在docker环境下，可以使用/bot/config/ 做前缀，可以将bot的cookie文件存在宿主机上
  profile: 'bot_cookie',
  //bot的代号，需要和后端配置一致
  bot_name: 'bot10086',
  //调试模式开关
  debug: false,
  //操作限制阈值
  locker: {
    //发送信息间隔时间（毫秒）
    limit_msg: 10 * 1000,
    // 设置用户备注的间隔时间
    limit_alias: 10 * 1000,
    //创建房间操作的间隔时间
    limit_create_room: 10 * 1000,
  },
  //白名单用户备注名称列表，字符串数组
  whiteUserList: [],
  //其他bot的备注名称列表，字符串数组
  botAliasList: [],
  //加好友自动回复内容
  newFriendRevMsg: 'Hi!',
}
