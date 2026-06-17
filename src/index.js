const XianyuLive = require("./goofish_live.js");

// 从环境变量读取 cookie，避免硬编码
const cookies_str = process.env.COOKIES_STR || "";
if (!cookies_str) {
    console.error("错误：未设置 COOKIES_STR 环境变量，请在 Render 的 Environment Variables 中配置");
    process.exit(1);
}

const xianyuLive = new XianyuLive(cookies_str);
xianyuLive.start();
