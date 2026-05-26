const {
  generate_mid,
  generate_uuid,
  generate_device_id,
  generate_sign,
  decrypt,
} = require("../lib/goofish_js_version_2.js");

/**
 * 将 Cookie 字符串转换为对象
 * @param {string} cookies_str - Cookie 字符串
 * @returns {object} Cookie 对象
 */
function trans_cookies(cookies_str) {
  const cookies = {};
  const cookie_pairs = cookies_str.split(";");
  for (const pair of cookie_pairs) {
    const [key, value] = pair.trim().split("=");
    if (key && value !== undefined) {
      cookies[key] = value;
    }
  }
  return cookies;
}

/**
 * 获取会话 Cookie 字符串
 * @param {object} session - 会话对象（包含 cookies）
 * @returns {string} Cookie 字符串
 */
function get_session_cookies_str(session) {
  return Object.entries(session)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

/**
 * 时间格式化
 * @returns {string} 日期 字符串，比如 2026/05/26 20:03
 */
function get_date_str() {
  const date = new Date();
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat("zh-CN", options);
  return formatter.format(date);
}

module.exports = {
  trans_cookies,
  get_session_cookies_str,
  generate_mid,
  generate_uuid,
  generate_device_id,
  generate_sign,
  decrypt,
  get_date_str,
};
