export interface ContactQueryFilter {
  name?: string | RegExp,
  alias?: string | RegExp,
}
export interface RoomQueryFilter {
  topic: string | RegExp,
}
