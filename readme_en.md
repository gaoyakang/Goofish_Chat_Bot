# Goofish Chat Bot

A Node.js-based **Xianyu (Goofish) WebSocket real-time chat auto-reply bot** that listens to Xianyu messages and automatically responds to users.

---

## Features

| Feature | Description |
|---------|-------------|
| **WebSocket Real-time Connection** | Establishes a persistent connection via `wss://wss-goofish.dingtalk.com/` to receive Xianyu messages in real time |
| **Auto Login & Token Management** | Automatically obtains/refreshes access tokens with automatic Cookie updates |
| **Auto-reply Messages** | Sends preset replies based on message types (text, image, location, transfer, order, etc.) |
| **Historical Message Sync** | Automatically fetches historical messages on connection to avoid replying to old messages |
| **Heartbeat Keep-alive** | Sends heartbeat packets every 15 seconds and refreshes tokens every 10 minutes to maintain a stable long connection |
| **Message Deduplication** | Prevents duplicate processing of the same message based on `messageId` |
| **Logging** | Automatically saves console output to `log.txt` |
| **Image/Text Message Sending** | Supports sending text and image messages |
| **Media File Upload** | Supports uploading images and other media files to the Xianyu server |
| **Item Info Query** | Supports querying item details by item ID |

---

## Project Structure

```
├── goofish_live.js          # Core class: WebSocket connection, message listening, and auto-reply
├── goofish_apis.js          # API wrapper: Token acquisition, refresh, media upload, item query
├── utils/
│   ├── goofish_utils.js     # Utility functions: Cookie conversion, time formatting, encryption/decryption, etc.
│   └── types.js             # Message type constructors: text, image, voice messages
└── log.txt                  # Runtime logs (auto-generated)
```

---

## Quick Start

### 1. Install Dependencies

```bash
pnpm install ws node-fetch form-data
```

### 2. Configure Cookie

Fill in your Xianyu cookie string in the entry file:

```javascript
const XianyuLive = require("./goofish_live.js");

const cookies_str = "";  // Get the cookie from any request(must login) on https://www.goofish.com/
const xianyuLive = new XianyuLive(cookies_str);
xianyuLive.start();
```

### 3. Run

```bash
pnpm run dev
```

---

## Core Modules

### `XianyuLive` Class (goofish_live.js)

Main controller responsible for:
- Establishing and maintaining the WebSocket connection with heartbeat
- Processing various message types (historical messages, real-time messages, ACK responses)
- Automatically triggering reply logic based on message type
- Managing message deduplication and initialization state

**Auto-reply Rules:**

| User Message Type | Auto-reply Content |
|-------------------|--------------------|
| `[图片]` (Image) | "收到您发送的图片了" (Received your image) |
| `[位置]` (Location) | "收到您发送的位置了" (Received your location) |
| `[语音聊天]` (Voice Chat) | "收到您的语音聊天请求了" (Received your voice chat request) |
| `[视频聊天]` (Video Chat) | "收到您的视频聊天请求了" (Received your video chat request) |
| `[链接]` (Link) | "收到您发送的链接了" (Received your link) |
| `已收到对方转账` (Transfer Received) | Sends a Baidu Netdisk link (with extraction code) |
| `[我已拍下，待付款]` (Ordered, Pending Payment) | "收到您的订单了，请尽快付款" (Received your order, please pay soon) |
| `[我已付款，等待你发货]` (Paid, Awaiting Shipment) | "我已经收到付款即将为您打包商品" (Payment received, packing your item soon) |
| `[记得及时发货]` (Reminder to Ship) | "好的，我会尽快发货的" (Okay, I will ship as soon as possible) |
| `[我发起了地址修改申请]` (Address Change Request) | "收到您的地址修改申请了" (Received your address change request) |
| `[我发起了退款申请]` (Refund Request) | "收到您的退款申请了" (Received your refund request) |
| Other Text | "Hello, {username}! 我现在有点忙，稍后回复您哦～" (Hello, {username}! I'm a bit busy right now, will reply later~) |

### `XianyuApis` Class (goofish_apis.js)

Wraps Xianyu HTTP APIs:
- `get_token()` — Obtains login token (SSL verification disabled)
- `refresh_token()` — Refreshes session token
- `upload_media(file_path)` — Uploads media files (SSL verification disabled)
- `get_item_info(item_id)` — Queries item information
- Automatic Cookie management (updates from `set-cookie` response headers)

### Utility Functions (goofish_utils.js)

| Function | Purpose |
|----------|---------|
| `generate_mid()` | Generates a unique message ID |
| `generate_uuid()` | Generates a UUID |
| `generate_device_id(unb)` | Generates a device identifier based on user ID |
| `generate_sign(t, token, data)` | Generates an API request signature |
| `decrypt(rawData)` | Decrypts message data |
| `trans_cookies(str)` | Converts cookie string to object |
| `get_session_cookies_str(session)` | Converts cookie object to string |
| `get_date_str()` | Gets a formatted date/time string |

### Message Type Constructors (types.js)

```javascript
const { make_text, make_image, make_audio } = require("./utils/types.js");

// Construct a text message
make_text("Hello, welcome to inquire!");

// Construct an image message
make_image("https://example.com/image.jpg");

// Construct a voice message
make_audio("https://example.com/audio.mp3");
```

---

## Technical Details

- **Communication Protocol**: WebSocket (based on DingTalk IM PaaS protocol)
- **Message Format**: Custom JSON protocol containing `lwp` path, `headers`, and `body`
- **Encryption**: Message bodies support Base64 encoding and AES decryption
- **Cookie Management**: Automatically parses and updates `set-cookie` response headers
- **SSL Handling**: Some API calls disable SSL certificate verification (consistent with the Python version)

---

## Notes

1. **Cookie Validity**: Cookies expire and need to be updated regularly
2. **Risk Control**: Frequent auto-replies may trigger platform risk controls; please use reasonably
3. **SSL Verification**: The `get_token` and `upload_media` methods disable SSL verification; use with caution in production environments
4. **Log Files**: `log.txt` is created automatically at runtime; monitor disk space during long-term operation

---

## License

For educational and research purposes only. Please comply with Xianyu platform agreements and applicable laws and regulations.