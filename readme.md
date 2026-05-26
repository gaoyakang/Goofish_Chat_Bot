# Goofish Chat Bot

一个基于 Node.js 的**闲鱼（Goofish）WebSocket 实时聊天自动回复机器人**，能够监听闲鱼消息并自动响应用户消息。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **WebSocket 实时连接** | 通过 `wss://wss-goofish.dingtalk.com/` 建立长连接，实时接收闲鱼消息 |
| **自动登录与 Token 管理** | 自动获取/刷新访问 Token，支持 Cookie 自动更新 |
| **消息自动回复** | 根据消息类型（文本、图片、位置、转账、订单等）自动发送预设回复 |
| **历史消息同步** | 连接时自动拉取历史消息，避免重复回复旧消息 |
| **心跳保活** | 每 15 秒发送心跳包，每 10 分钟刷新 Token，保持长连接稳定 |
| **消息去重** | 基于 `messageId` 去重，防止重复处理同一条消息 |
| **日志记录** | 自动将控制台输出保存到 `log.txt` 文件 |
| **图片/文本消息发送** | 支持发送文本消息和图片消息 |
| **媒体文件上传** | 支持上传图片等媒体文件到闲鱼服务器 |
| **商品信息查询** | 支持通过商品 ID 获取商品详情 |

---

## 项目结构

```
├── goofish_live.js          # 核心类：WebSocket 连接、消息监听与自动回复
├── goofish_apis.js          # API 封装：Token 获取、刷新、媒体上传、商品查询
├── utils/
│   ├── goofish_utils.js     # 工具函数：Cookie 转换、时间格式化、加密/解密等
│   └── types.js             # 消息类型构造器：文本、图片、语音消息
└── log.txt                  # 运行日志（自动生成）
```

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install ws node-fetch form-data
```

### 2. 配置 Cookie

在入口文件中填入你的闲鱼 Cookie 字符串：

```javascript
const XianyuLive = require("./goofish_live.js");

const cookies_str = "";  // 通过网页 https://www.goofish.com/ 获取任意登陆后的请求的cookie
const xianyuLive = new XianyuLive(cookies_str);
xianyuLive.start();
```

### 3. 运行

```bash
pnpm run dev
```

---

## 核心模块说明

### `XianyuLive` 类（goofish_live.js）

主控制器，负责：
- 建立 WebSocket 连接并维持心跳
- 处理各类消息（历史消息、实时消息、ACK 响应）
- 根据消息类型自动触发回复逻辑
- 管理消息去重和初始化状态

**自动回复规则：**

| 用户消息类型 | 自动回复内容 |
|-------------|-------------|
| `[图片]` | "收到您发送的图片了" |
| `[位置]` | "收到您发送的位置了" |
| `[语音聊天]` | "收到您的语音聊天请求了" |
| `[视频聊天]` | "收到您的视频聊天请求了" |
| `[链接]` | "收到您发送的链接了" |
| `已收到对方转账` | 发送百度网盘链接（含提取码） |
| `[我已拍下，待付款]` | "收到您的订单了，请尽快付款" |
| `[我已付款，等待你发货]` | "我已经收到付款即将为您打包商品" |
| `[记得及时发货]` | "好的，我会尽快发货的" |
| `[我发起了地址修改申请]` | "收到您的地址修改申请了" |
| `[我发起了退款申请]` | "收到您的退款申请了" |
| 其他文本 | "Hello, {用户名}! 我现在有点忙，稍后回复您哦～" |

### `XianyuApis` 类（goofish_apis.js）

封装闲鱼 HTTP API：
- `get_token()` — 获取登录 Token（禁用 SSL 验证）
- `refresh_token()` — 刷新会话 Token
- `upload_media(file_path)` — 上传媒体文件（禁用 SSL 验证）
- `get_item_info(item_id)` — 查询商品信息
- 自动管理 Cookie 更新（响应头中的 `set-cookie`）

### 工具函数（goofish_utils.js）

| 函数 | 用途 |
|------|------|
| `generate_mid()` | 生成消息唯一 ID |
| `generate_uuid()` | 生成 UUID |
| `generate_device_id(unb)` | 基于用户 ID 生成设备标识 |
| `generate_sign(t, token, data)` | 生成 API 请求签名 |
| `decrypt(rawData)` | 解密消息数据 |
| `trans_cookies(str)` | Cookie 字符串转对象 |
| `get_session_cookies_str(session)` | Cookie 对象转字符串 |
| `get_date_str()` | 获取格式化时间字符串 |

### 消息类型构造器（types.js）

```javascript
const { make_text, make_image, make_audio } = require("./utils/types.js");

// 构造文本消息
make_text("你好，欢迎咨询！");

// 构造图片消息
make_image("https://example.com/image.jpg");

// 构造语音消息
make_audio("https://example.com/audio.mp3");
```

---

## 技术细节

- **通信协议**：WebSocket（基于钉钉 IM PaaS 协议）
- **消息格式**：自定义 JSON 协议，包含 `lwp` 路径、`headers`、`body`
- **加密方式**：消息体支持 Base64 编码和 AES 解密
- **Cookie 管理**：自动解析和更新 `set-cookie` 响应头
- **SSL 处理**：部分 API 调用禁用 SSL 证书验证（与 Python 版本保持一致）

---

## 注意事项

1. **Cookie 有效性**：Cookie 会过期，需要定期更新
2. **风控风险**：频繁自动回复可能触发平台风控，请合理控制频率
3. **SSL 验证**：`get_token` 和 `upload_media` 方法禁用了 SSL 验证，生产环境请谨慎使用
4. **日志文件**：运行时会自动创建 `log.txt`，长期运行请注意磁盘空间

---

## License

仅供学习研究使用，请遵守闲鱼平台相关协议和法律法规。