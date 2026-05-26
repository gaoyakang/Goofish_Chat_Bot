const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const XianyuApis = require("./goofish_apis.js");
const {
  generate_mid,
  generate_uuid,
  generate_device_id,
  decrypt,
  get_date_str,
} = require("../utils/goofish_utils.js");
const { make_text } = require("../utils/types.js");

// ========== 日志自动保存功能 ==========
const logFilePath = path.join(__dirname, "log.txt");

// 重定向 console.log 和 console.error 到文件
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");

  // 输出到控制台
  originalLog.apply(console, args);

  // 写入日志文件
  try {
    fs.appendFileSync(logFilePath, `${message}\n`);
  } catch (e) {
    originalError("日志写入失败:", e.message);
  }
};

console.error = function (...args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");

  // 输出到控制台
  originalError.apply(console, args);

  // 写入日志文件
  try {
    fs.appendFileSync(logFilePath, `[ERROR] ${message}\n`);
  } catch (e) {
    originalError("日志写入失败:", e.message);
  }
};

// 清空旧日志文件
try {
  fs.writeFileSync(logFilePath, "");
} catch (e) {
  originalError("清空日志文件失败:", e.message);
}

class XianyuLive {
  constructor(cookies_str) {
    this.base_url = "wss://wss-goofish.dingtalk.com/";
    this.cookies_str = cookies_str;
    this.cookies = this._parse_cookies(cookies_str);
    this.unb = this.cookies.unb || ""; // 保存 unb 到实例变量
    this.device_id = generate_device_id(this.unb);
    this.xianyu = null;
    this.ws = null;
    this.heartbeat_timer = null;
    this.token_refresh_timer = null;
    this.processed_message_ids = new Set(); // 记录已处理过的消息ID，防止重复回复
    this.is_initialized = false; // 是否完成初始化（历史消息已同步完毕）
  }

  /**
   * 初始化会话
   */
  async init_session() {
    const cookies = this._parse_cookies(this.cookies_str);
    this.xianyu = new XianyuApis(cookies, this.device_id);
    await this.xianyu.get_token();
  }

  /**
   * 解析 Cookie 字符串
   */
  _parse_cookies(cookies_str) {
    const cookies = {};
    const pairs = cookies_str.split("; ");
    for (const pair of pairs) {
      try {
        const parts = pair.split("=");
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join("=");
          if (key && value !== undefined) {
            cookies[key] = value;
          }
        }
      } catch (e) {
        continue;
      }
    }
    return cookies;
  }

  /**
   * 启动 WebSocket 连接
   */
  async start() {
    await this.init_session();

    const url = this.base_url;
    this.ws = new WebSocket(url, {
      headers: {
        Cookie: this.cookies_str,
        Host: "wss-goofish.dingtalk.com",
        Connection: "Upgrade",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        Origin: "https://www.goofish.com",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });

    this.ws.on("open", async () => {
      console.log("WebSocket连接已建立");
      await this.init(this.ws);
      this.start_heartbeat();
      this.start_token_refresh();
    });

    this.ws.on("message", async (messageData) => {
      try {
        const message = JSON.parse(messageData);
        // 处理心跳响应（code: 404 通常是心跳响应）
        if (message.code === 404) {
          return;
        }

        // 处理其他需要ACK的消息
        if (message.headers) {
          const ack = {
            code: 200,
            headers: {
              mid: message.headers.mid || generate_mid(),
              sid: message.headers.sid || "",
            },
          };

          if (message.headers["app-key"]) {
            ack.headers["app-key"] = message.headers["app-key"];
          }
          if (message.headers.ua) {
            ack.headers.ua = message.headers.ua;
          }
          if (message.headers.dt) {
            ack.headers.dt = message.headers.dt;
          }
          await this.ws.send(JSON.stringify(ack));
        }

        await this.handle_message(message);
      } catch (e) {
        console.error("[ERROR] 消息解析失败:", e.message);
      }
    });

    this.ws.on("error", (error) => {
      console.error("WebSocket错误:", error);
    });

    this.ws.on("close", () => {
      console.log("WebSocket连接已关闭");
      clearInterval(this.heartbeat_timer);
      clearInterval(this.token_refresh_timer);
    });
  }

  /**
   * WebSocket 初始化
   */
  async init(ws) {
    const data = await this.xianyu.get_token();
    const token = data["data"]?.["accessToken"] || "";

    if (!token) {
      console.error("获取token失败");
      process.exit(0);
    }

    const msg = {
      lwp: "/reg",
      headers: {
        "cache-header": "app-key token ua wv",
        "app-key": "444e9908a51d1cb236a27862abc769c9",
        token: token,
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 DingTalk(2.1.5) OS(Windows/10) Browser(Chrome/133.0.0.0) DingWeb/2.1.5 IMPaaS DingWeb/2.1.5",
        dt: "j",
        wv: "im:3,au:3,sy:6",
        sync: "0,0;0;0;",
        did: this.device_id,
        mid: generate_mid(),
      },
    };
    await ws.send(JSON.stringify(msg));

    const currentTime = Date.now();
    const syncMsg = {
      lwp: "/r/SyncStatus/ackDiff",
      headers: { mid: generate_mid() },
      body: [
        {
          pipeline: "sync",
          tooLong2Tag: "PNM,1",
          channel: "sync",
          topic: "sync",
          highPts: 0,
          pts: currentTime * 1000,
          seq: 0,
          timestamp: currentTime,
        },
      ],
    };
    await ws.send(JSON.stringify(syncMsg));

    // 发送历史消息请求
    await this.request_history_messages(ws);
  }

  /**
   * 请求历史消息
   */
  async request_history_messages(ws) {
    // 从已有的会话中获取第一个会话ID
    if (this.last_session_id) {
      const msg = {
        lwp: "/r/MessageManager/listUserMessages",
        headers: {
          mid: generate_mid(),
        },
        body: [
          `${this.last_session_id}@goofish`, // 会话ID（带域名后缀）
          false, // 是否反向查询
          9007199254740991, // 初始游标（最大值）
          20, // 每次获取20条
          false, // 不包含系统消息
        ],
      };
      await ws.send(JSON.stringify(msg));
    }
  }

  /**
   * 心跳保活任务
   */
  start_heartbeat() {
    this.heartbeat_timer = setInterval(async () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msg = {
          lwp: "/!",
          headers: { mid: generate_mid() },
        };
        this.ws.send(JSON.stringify(msg));
      }
    }, 15000);
  }

  /**
   * Token 刷新任务（每10分钟刷新一次）
   */
  start_token_refresh() {
    this.token_refresh_timer = setInterval(async () => {
      await this.xianyu.get_token();
    }, 600000);
  }

  /**
   * 发送消息
   */
  async send_msg(ws, cid, uid, msg_type) {
    const mid = generate_mid();

    const msg = {
      lwp: "/r/MessageSend/sendByReceiverScope",
      headers: { mid: mid },
      body: [
        {
          uuid: generate_uuid(),
          cid: `${cid}@goofish`,
          conversationType: 1,
          content: {
            contentType: 101,
            custom: {
              type: null,
              data: null,
            },
          },
          redPointPolicy: 0,
          extension: {
            extJson: "{}",
          },
          ctx: {
            appVersion: "1.0",
            platform: "web",
          },
          mtags: {},
          msgReadStatusSetting: 1,
        },
        {
          actualReceivers: [`${uid}@goofish`, `${this.unb}@goofish`],
        },
      ],
    };

    // 根据消息类型构造不同的 payload（与Python保持一致）
    if (msg_type.type === "text") {
      // 构造文本消息payload
      const payload = {
        contentType: 1,
        text: {
          text: msg_type.text,
        },
      };
      // Base64编码payload
      const textBase64 = Buffer.from(JSON.stringify(payload), "utf-8").toString(
        "base64",
      );
      msg.body[0].content.custom.type = 1;
      msg.body[0].content.custom.data = textBase64;
    } else if (msg_type.type === "image") {
      // 构造图片消息payload
      const payload = {
        contentType: 2,
        image: {
          pics: [
            {
              type: 0,
              url: msg_type.image,
              width: 0,
              height: 0,
            },
          ],
        },
      };
      const imageBase64 = Buffer.from(
        JSON.stringify(payload),
        "utf-8",
      ).toString("base64");
      msg.body[0].content.custom.type = 2;
      msg.body[0].content.custom.data = imageBase64;
    }

    await ws.send(JSON.stringify(msg));
  }

  /**
   * 发送 ACK 响应
   */
  async send_ack(ws, message) {
    const ack = {
      code: 200,
      headers: {
        mid: message.headers?.mid || generate_mid(),
        sid: message.headers?.sid || "",
      },
    };
    if (message.headers?.["app-key"]) {
      ack.headers["app-key"] = message.headers["app-key"];
    }
    if (message.headers?.ua) {
      ack.headers.ua = message.headers.ua;
    }
    if (message.headers?.dt) {
      ack.headers.dt = message.headers.dt;
    }
    await ws.send(JSON.stringify(ack));
  }

  /**
   * 消息处理
   */
  async handle_message(message) {
    // 收到 /s/vulcan 消息时，发送历史消息请求
    if (message.lwp === "/s/vulcan") {
      await this.request_history_messages(this.ws);
    }

    // 收到 /s/para 消息时，发送同步状态确认以订阅实时消息推送
    if (message.lwp === "/s/para") {
      const currentTime = Date.now();
      const syncMsg = {
        lwp: "/r/SyncStatus/ackDiff",
        headers: { mid: generate_mid() },
        body: [
          {
            pipeline: "sync",
            tooLong2Tag: "PNM,1",
            channel: "sync",
            topic: "sync",
            highPts: 0,
            pts: currentTime * 1000,
            seq: 0,
            timestamp: currentTime,
          },
        ],
      };
      await this.ws.send(JSON.stringify(syncMsg));
    }

    // 检查消息是否包含body
    if (!message.body) {
      return;
    }

    // 检查是否是历史消息响应
    if (message.body.userMessageModels) {
      await this.handle_history_messages(message);
      return;
    }

    // 检查是否包含syncPushPackage
    if (!message.body.syncPushPackage) {
      return;
    }

    const dataArray = message.body.syncPushPackage.data;

    // 检查data数组是否存在且非空
    if (!dataArray || dataArray.length === 0) {
      return;
    }

    // 遍历所有数据项
    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      const rawData = item.data;

      let parsedData = null;

      try {
        parsedData = JSON.parse(rawData);
      } catch (parseError) {
        try {
          const decryptedData = decrypt(rawData);
          parsedData = JSON.parse(decryptedData);
        } catch (e) {
          try {
            const decodedData = Buffer.from(rawData, "base64").toString(
              "utf-8",
            );
            parsedData = JSON.parse(decodedData);
          } catch (decodeError) {
            console.error("[ERROR] 消息解析失败:", decodeError.message);
            continue;
          }
        }
      }

      if (parsedData) {
        try {
          // 格式1: parsedData['1'] 是数组（会话列表更新）
          if (Array.isArray(parsedData["1"])) {
            // 保存会话ID
            if (parsedData["1"].length > 0) {
              const sessionInfo = parsedData["1"][0];
              if (sessionInfo["1"] && sessionInfo["1"].includes("@goofish")) {
                this.last_session_id = sessionInfo["1"].split("@")[0];
                await this.request_history_messages(this.ws);
              }
            }
            continue;
          }

          // 格式2: parsedData['1'] 是对象（聊天消息）
          if (parsedData["1"] && typeof parsedData["1"]["2"] === "string") {
            const cid = parsedData["1"]["2"];

            // 检查是否包含 @goofish 标识
            if (cid.includes("@goofish")) {
              // 获取消息ID用于去重
              const extJson = parsedData["1"]["10"]?.["extJson"];
              const bizTag = parsedData["1"]["10"]?.["bizTag"];

              let messageId = null;

              if (typeof extJson === "string") {
                const extJsonMatch = extJson.match(/"messageId":"([^"]+)"/);
                if (extJsonMatch) {
                  messageId = extJsonMatch[1];
                }
              }

              if (!messageId && typeof bizTag === "string") {
                const bizTagMatch = bizTag.match(/"messageId":"([^"]+)"/);
                if (bizTagMatch) {
                  messageId = bizTagMatch[1];
                }
              }

              if (!messageId) {
                messageId =
                  parsedData["1"]["6"]?.["3"]?.["1"] ||
                  parsedData["1"]["6"]?.["1"] ||
                  parsedData["1"]["6"]?.["3"]?.["7"] ||
                  parsedData["1"]["6"]?.["7"];
              }

              // 检查是否已经处理过该消息
              if (messageId && this.processed_message_ids.has(messageId)) {
                continue;
              }

              // 检查是否已完成初始化（避免回复历史消息）
              if (!this.is_initialized) {
                if (messageId) {
                  this.processed_message_ids.add(messageId);
                }
                continue;
              }

              const cleanCid = cid.split("@")[0];

              // 提取发送者信息
              const sendUserName = parsedData["1"]["10"]?.["reminderTitle"];
              const sendUserId = parsedData["1"]["10"]?.["senderUserId"];
              const sendUserMessageType =
                parsedData["1"]["10"]?.["detailNotice"];

              // 标记消息已处理
              if (messageId) {
                this.processed_message_ids.add(messageId);
              }

              // 构造回复内容（自动回复机器人）
              let reply = "";
              console.log(
                `[${get_date_str()}] [用户] ${sendUserName} 说: "${parsedData["1"]["10"]?.["detailNotice"]}"`,
              );
              // 根据不同消息类型返回对应的回复（完全匹配原代码中的消息类型）
              if (sendUserMessageType === "[图片]") {
                reply = "收到您发送的图片了";
              } else if (sendUserMessageType === "[位置]") {
                reply = "收到您发送的位置了";
              } else if (sendUserMessageType === "[语音聊天]") {
                reply = "收到您的语音聊天请求了";
              } else if (sendUserMessageType === "[视频聊天]") {
                reply = "收到您的视频聊天请求了";
              } else if (sendUserMessageType === "[链接]") {
                reply = "收到您发送的链接了";
              } else if (sendUserMessageType === "已收到对方转账") {
                reply =
                  "收到您的转账了，请提取：链接: https://pan.baidu.com/s/1KZype1mV5u4P-rsEI_rt6Q?pwd=ricy 提取码: ricy";
              } else if (sendUserMessageType === "[我已拍下，待付款]") {
                reply = "收到您的订单了，请尽快付款";
              } else if (sendUserMessageType === "[我已付款，等待你发货]") {
                reply = "我已经收到付款即将为您打包商品";
              } else if (sendUserMessageType === "[记得及时发货]") {
                reply = "好的，我会尽快发货的";
              } else if (sendUserMessageType === "[我发起了地址修改申请]") {
                reply = "收到您的地址修改申请了";
              } else if (sendUserMessageType === "[我发起了退款申请]") {
                reply = "收到您的退款申请了";
              } else {
                // 默认回复
                reply = `Hello, ${sendUserName}!  我现在有点忙，稍后回复您哦～.`;
              }

              // 发送文字回复
              try {
                await this.send_msg(
                  this.ws,
                  cleanCid,
                  sendUserId,
                  make_text(reply),
                );
                console.log(
                  `[${get_date_str()}] [系统] 自动回复用户 [${sendUserName}] 说: "${reply}"`,
                );
              } catch (sendError) {
                console.error("[ERROR] 自动回复发送失败:", sendError.message);
              }
            }
          } else if (parsedData.chatType !== undefined) {
            // 格式3: 会话唤起消息 (bizType: 370)
            const sessionId =
              parsedData.sessionId ||
              parsedData.operation?.sessionInfo?.sessionId;
            if (sessionId) {
              this.last_session_id = sessionId;
            }
          } else if (parsedData.operation?.content?.contentType === 40) {
            // 格式4: 会话列表消息 (bizType: 40)
            const sessionId =
              parsedData.sessionId ||
              parsedData.operation?.sessionInfo?.sessionId;
            if (sessionId) {
              this.last_session_id = sessionId;
              await this.request_history_messages(this.ws);
            }
          }
        } catch (e) {
          console.error("[ERROR] 解析消息失败:", e.message);
        }
      }
    }
  }

  /**
   * 处理历史消息响应
   */
  async handle_history_messages(message) {
    try {
      const userMessageModels = message.body.userMessageModels;

      for (const userMessage of userMessageModels) {
        // 记录历史消息ID，避免后续重复处理
        const messageId = userMessage.message?.messageId;
        if (messageId) {
          this.processed_message_ids.add(messageId);
        }
      }

      // 历史消息处理完成，标记初始化完成
      this.is_initialized = true;
    } catch (e) {
      console.error("[ERROR] 处理历史消息失败:", e.message);
    }
  }
}

module.exports = XianyuLive;
