/**
 * 文本消息类型
 * @param {string} text - 文本内容
 * @returns {object} 文本消息对象
 */
function make_text(text) {
    return {
        type: "text",
        text: text
    };
}

/**
 * 图片消息类型
 * @param {string} image_url - 图片URL
 * @returns {object} 图片消息对象
 */
function make_image(image_url) {
    return {
        type: "image",
        image: image_url
    };
}

/**
 * 语音消息类型
 * @param {string} audio_url - 语音URL
 * @returns {object} 语音消息对象
 */
function make_audio(audio_url) {
    return {
        type: "audio",
        audio: audio_url
    };
}

module.exports = {
    make_text,
    make_image,
    make_audio
};