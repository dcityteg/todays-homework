const express = require('express');
const { marked } = require('marked');
const { pool } = require('./db');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const router = express.Router();

// 初始化 DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

router.get('/', async (req, res) => {
    try {
        // 查询作业内容和更新时间
        const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

        const renderedHomework = DOMPurifyInstance.sanitize(marked(homework));

        // 格式化时间（根据中国时区）
        const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置时间';

        res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>今日作业</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                    img { max-width: 100%; height: auto; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>今日作业</h1>
                <div>${renderedHomework || '<p>暂未上传作业</p>'}</div>
                <hr>
                <p><strong>更改时间：</strong>${formattedUpdatedAt}</p>
                      <script src="https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.0.0-beta.4/libs/cn/index.js"></script>
                <script>
                    new CozeWebSDK.WebChatClient({
                        config: {
                        bot_id: '7330973276627468288',
                        },
                        componentProps: {
                        title: 'Coze',
                        },
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('内部服务器错误');
    }
});

module.exports = router;
