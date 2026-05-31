/**
 * WebSocket 消息协议 - 负责消息的编码和解码
 */

/**
 * 将对象编码为 JSON 字符串
 */
export function encodeMessage(data) {
  return typeof data === 'string' ? data : JSON.stringify(data)
}

/**
 * 将 JSON 字符串解码为对象
 */
export function decodeMessage(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}
