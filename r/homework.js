const express = require('express');
const { pool } = require('./db'); // 从 db.js 导入数据库连接池
const DOMPurify = require('dompurify');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');

const router = express.Router();

// 作业页面路由
router.get('/', async (req, res) => {
    try {
        // 查询作业内容
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        
        // 使用 DOMPurify 和 marked 渲染作业内容
        const renderedHomework = DOMPurify.sanitize(marked(homework));

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Today's Homework</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                    img { max-width: 100%; height: auto; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>今日作业</h1>
                <div>${renderedHomework || '<p>暂无作业内容</p>'}</div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('服务器内部错误');
    }
});

module.exports = router;
