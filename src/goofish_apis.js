const fetch = require("node-fetch");
const FormData = require("form-data");
const https = require("https");
const { generate_sign } = require("../utils/goofish_utils.js");

/**
 * 禁用 SSL 验证的 Agent（用于 get_token 和 upload_media）
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

class XianyuApis {
  constructor(cookies, device_id) {
    this.session = { ...cookies };
    this.device_id = device_id;
    this.base_url = "https://h5api.m.goofish.com";
    this.login_url =
      "https://h5api.m.goofish.com/h5/mtop.taobao.idlemessage.pc.login.token/1.0/";
  }

  /**
   * 获取 Token
   * 注意：此方法禁用 SSL 验证（与 Python 的 verify=False 一致）
   */
  async get_token() {
    const t = String(Math.floor(Date.now()));
    const token = this.session["_m_h5_tk"]?.split("_")[0] || "";

    const params = {
      jsv: "2.7.2",
      appKey: "34839810",
      t: t,
      sign: "",
      v: "1.0",
      type: "originaljson",
      accountSite: "xianyu",
      dataType: "json",
      timeout: "20000",
      api: "mtop.taobao.idlemessage.pc.login.token",
      sessionOption: "AutoLoginOnly",
      spm_cnt: "a21ybx.im.0.0",
      spm_pre: "a21ybx.item.want.1.14ad3da6ALVq3n",
      log_id: "14ad3da6ALVq3n",
    };

    const data_val = `{"appKey":"444e9908a51d1cb236a27862abc769c9","deviceId":"${this.device_id}"}`;
    params["sign"] = generate_sign(t, token, data_val);

    const headers = {
      Host: "h5api.m.goofish.com",
      "sec-ch-ua-platform": '"Windows"',
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      accept: "application/json",
      "sec-ch-ua":
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      "content-type": "application/x-www-form-urlencoded",
      "sec-ch-ua-mobile": "?0",
      origin: "https://www.goofish.com",
      "sec-fetch-site": "same-site",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      referer: "https://www.goofish.com/",
      "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,zh-TW;q=0.7,ja;q=0.6",
      priority: "u=1, i",
      Cookie: this._get_cookie_string(),
    };

    const body = new URLSearchParams({
      data: data_val,
    });

    const url = new URL(this.login_url);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: headers,
      body: body.toString(),
      agent: httpsAgent, // 禁用 SSL 验证
    });

    const text = await response.text();

    // 打印响应帮助调试
    try {
      const data = JSON.parse(text);
      if (data.ret && data.ret[0] && data.ret[0].includes("FAIL")) {
        console.error("[ERROR] API调用失败:", data.ret[1] || data.ret[0]);
      }
      this._update_cookies(response);
      return data;
    } catch {
      console.error("[ERROR] 响应解析失败:", text);
      this._update_cookies(response);
      return { ret: ["FAIL"], data: null };
    }
  }

  /**
   * 刷新 Token
   * 注意：此方法**不**禁用 SSL 验证（与 Python 一致）
   */
  async refresh_token() {
    const t = Date.now().toString();
    const token = this.session["_m_h5_tk"]?.split("_")[0] || "";

    const params = {
      jsv: "2.4.11",
      appKey: "34839810",
      t: t,
      sign: "",
      api: "mtop.xianyu.message.session.refreshSession",
      v: "1.0",
      type: "json",
      dataType: "json",
      timeout: "20000",
      callback: "",
      spm_pre: "a21ybx.item.want.1.12523da6waCtUp",
      spm_cnt: "a21ybx.item.want.1.12523da6waCtUp",
      log_id: "12523da6waCtUp",
    };

    const data_val = "{}";
    params["sign"] = generate_sign(t, token, data_val);

    const headers = {
      Cookie: this._get_cookie_string(),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://www.goofish.com",
      Referer: "https://www.goofish.com/",
    };

    const response = await fetch(
      `${this.base_url}/h5/mtop.xianyu.message.session.refreshsession/1.0/`,
      {
        method: "POST",
        headers: headers,
        body: new URLSearchParams(params).toString(),
        // 默认启用 SSL 验证
      },
    );

    const text = await response.text();
    this._update_cookies(response);

    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return { ret: ["FAIL"], data: null };
    }
  }

  /**
   * 上传媒体文件
   * 注意：此方法禁用 SSL 验证（与 Python 的 verify=False 一致）
   */
  async upload_media(file_path) {
    const headers = {
      Cookie: this._get_cookie_string(),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      Origin: "https://www.goofish.com",
      Referer: "https://www.goofish.com/",
    };

    const form = new FormData();
    form.append("file", require("fs").createReadStream(file_path));

    const response = await fetch(
      "https://h5api.m.goofish.com/h5/mtop.xianyu.message.attachment.upload/1.0/",
      {
        method: "POST",
        headers: { ...headers, ...form.getHeaders() },
        body: form,
        agent: httpsAgent, // 禁用 SSL 验证
      },
    );

    const text = await response.text();
    this._update_cookies(response);

    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return { ret: ["FAIL"], data: null };
    }
  }

  /**
   * 获取商品信息
   * 注意：此方法**不**禁用 SSL 验证（与 Python 一致）
   */
  async get_item_info(item_id) {
    const t = Date.now().toString();
    const token = this.session["_m_h5_tk"]?.split("_")[0] || "";

    const params = {
      jsv: "2.4.11",
      appKey: "34839810",
      t: t,
      sign: "",
      api: "mtop.xianyu.item.detail.get",
      v: "1.0",
      type: "json",
      dataType: "json",
      timeout: "20000",
      callback: "",
      itemId: item_id,
      spm_pre: "a21ybx.item.want.1.12523da6waCtUp",
      spm_cnt: "a21ybx.item.want.1.12523da6waCtUp",
      log_id: "12523da6waCtUp",
    };

    const data_val = `{"itemId":"${item_id}"}`;
    params["sign"] = generate_sign(t, token, data_val);

    const headers = {
      Cookie: this._get_cookie_string(),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://www.goofish.com",
      Referer: "https://www.goofish.com/",
    };

    const response = await fetch(
      `${this.base_url}/h5/mtop.xianyu.item.detail.get/1.0/`,
      {
        method: "POST",
        headers: headers,
        body: new URLSearchParams(params).toString(),
        // 默认启用 SSL 验证
      },
    );

    const text = await response.text();
    this._update_cookies(response);

    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return { ret: ["FAIL"], data: null };
    }
  }

  /**
   * 获取当前会话 Cookie 字符串
   */
  _get_cookie_string() {
    return Object.entries(this.session)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  /**
   * 更新 Cookie（先删旧的，再加新的，与原 Python 一致）
   */
  _update_cookies(response) {
    const setCookieHeader = response.headers.get("set-cookie");
    if (!setCookieHeader) return;

    // set-cookie 头部可能包含多个 Cookie，每个 Cookie 用逗号分隔
    // 但 Cookie 值本身也可能包含逗号，所以需要更智能的解析
    const cookies = [];
    let current = "";
    let inValue = false;

    for (let i = 0; i < setCookieHeader.length; i++) {
      const char = setCookieHeader[i];
      if (char === "=") {
        inValue = true;
      } else if (char === ";" && inValue) {
        inValue = false;
      }

      if (char === "," && !inValue) {
        cookies.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      cookies.push(current.trim());
    }

    for (const cookie of cookies) {
      const parts = cookie.split(";")[0].trim().split("=");
      if (parts.length >= 2) {
        const key = parts[0];
        const value = parts.slice(1).join("=");

        // 先删除旧的 Cookie（与原 Python 逻辑一致）
        if (key in this.session) {
          delete this.session[key];
        }

        // 添加新的 Cookie
        this.session[key] = value;
      }
    }
  }
}

module.exports = XianyuApis;
