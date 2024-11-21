const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// 创建 JSDOM 窗口以支持 DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// 导出 DOMPurify 实例
module.exports = DOMPurifyInstance;
