
/**
 * 房间类型
 *
 * @export
 * @enum {number}
 */
export enum RoomType {
  big = 'big',
  driver = 'driver',
  other = 'other',
}

/**
 * App Class的事件类型
 *
 * @export
 * @enum {number}
 */
export enum AppEvent {
  start_bot = 'start-bot',
  pause_bot = 'pause-bot',
  resume_bot = 'resume-bot',
  restart_bot = 'restart-bot',
  quit = 'quit',
  clean_task = 'clean-task',
  msg_lock = 'msg_lock',
  msg_unlock = 'msg_unlock',
}

export enum Gender {
  Unknown = 0,
  Male = 1,
  Female = 2,
}
