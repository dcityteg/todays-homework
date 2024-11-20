const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { marked } = require('marked');
const { Pool } = require('pg');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// 初始化 DOMPurify，用于防止 XSS
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

const app = express();

// 初始化 PostgreSQL 连接池，使用 Vercel 设置的 DATABASE_URL 环境变量
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// 配置 /src 文件夹为静态资源目录
app.use(express.static(path.join(__dirname, '../src')));

// 设置 marked 的配置
marked.setOptions({
    gfm: true,
    breaks: true,
});

// 检查并创建 `homework` 表（如果不存在）
const checkAndCreateTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS homework (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL CHECK (length(content) > 0)
        );
    `;
    try {
        await pool.query(createTableQuery);
        console.log('表格创建或已经存在');
    } catch (err) {
        console.error('创建表格时出错:', err);
    }
};

// 在应用启动时调用，确保数据库表存在
checkAndCreateTable();

// 根路径 `/` 显示今日作业
app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = result.rows.length > 0 ? result.rows[0].content : '';
        const renderedHomework = DOMPurifyInstance.sanitize(marked(homework));

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
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <h1>今日作业</h1>
                <div>${renderedHomework || '<p>暂无作业内容</p>'}</div>
                <br>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('从数据库获取作业内容时出错:', err);
        res.status(500).send('服务器内部错误');
    }
});

// `/setc` 路由 - 设置作业
app.get('/setc', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Set Homework</title>
        </head>
        <body>
            <h1>设置今日作业</h1>
            <form method="POST" action="/setc">
                <textarea name="homework" rows="10" cols="50" placeholder="输入Markdown格式的作业内容" maxlength="500"></textarea>
                <br>
                <button type="submit">提交</button>
            </form>
        </body>
        </html>
    `);
});

// 接收作业内容并存储到 PostgreSQL
app.post('/setc', async (req, res) => {
    const sanitizeInput = (input) => input.replace(/<script.*?>.*?<\/script>/gim, '');
    const homework = sanitizeInput(req.body.homework || '（无内容）');

    try {
        await pool.query(`
            INSERT INTO homework (id, content) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET content = $2;
        `, [1, homework]);

        res.send(`
            <h1>作业已更新！</h1>
            <p>点击 <a href="/">这里</a> 查看今日作业。</p>
        `);
    } catch (err) {
        console.error('保存作业内容到数据库时出错:', err);
        res.status(500).send('服务器内部错误');
    }
});

// 优雅地关闭数据库连接
process.on('SIGINT', async () => {
    await pool.end();
    process.exit();
});

module.exports = app;
