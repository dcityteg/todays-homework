const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const app = express();

// 初始化 DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// 初始化 PostgreSQL 连接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

// 配置 multer 用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 检查并创建数据库表
const checkAndCreateTables = async () => {
    const createHomeworkTableQuery = `
        CREATE TABLE IF NOT EXISTS homework (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL CHECK (length(content) > 0)
        );
    `;

    const createHomeworkImagesTableQuery = `
        CREATE TABLE IF NOT EXISTS homework_images (
            id SERIAL PRIMARY KEY,
            homework_id INT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
            image_data BYTEA NOT NULL
        );
    `;

    const createPasswordTableQuery = `
        CREATE TABLE IF NOT EXISTS password (
            id SERIAL PRIMARY KEY,
            hash TEXT NOT NULL
        );
    `;

    try {
        await pool.query(createHomeworkTableQuery);
        await pool.query(createHomeworkImagesTableQuery);
        await pool.query(createPasswordTableQuery);

        // 确保密码表中至少有一条记录
        const result = await pool.query('SELECT * FROM password');
        if (result.rows.length === 0) {
            const defaultPassword = 'defaultpassword';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await pool.query('INSERT INTO password (hash) VALUES ($1)', [hashedPassword]);
            console.log(`默认密码设置为: ${defaultPassword}`);
        }
    } catch (err) {
        console.error('创建表格时出错:', err);
    }
};

checkAndCreateTables();

// 获取当前密码哈希值
const getPasswordHash = async () => {
    const result = await pool.query('SELECT hash FROM password LIMIT 1');
    return result.rows[0].hash;
};

// 更新密码
const updatePassword = async (newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE password SET hash = $1 WHERE id = 1', [hashedPassword]);
};

// 显示今日作业
app.get('/', async (req, res) => {
    try {
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
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

// 设置作业页面
app.get('/setc', async (req, res) => {
    const { s: suppliedPassword } = req.query;
    const storedHash = await getPasswordHash();

    // 校验密码
    const isValidPassword = await bcrypt.compare(suppliedPassword || '', storedHash);
    if (!isValidPassword) {
        return res.status(403).send('密码错误或未提供，请在URL中添加正确的密码参数。例如 /setc?s=密码');
    }

    const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
    const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Set Homework</title>
            <script>
                function insertAtCursor(areaId, text) {
                    const textarea = document.getElementById(areaId);
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const before = textarea.value.substring(0, start);
                    const after = textarea.value.substring(end);
                    textarea.value = before + text + after;
                    textarea.selectionStart = textarea.selectionEnd = start + text.length;
                    textarea.focus();
                }
            </script>
        </head>
        <body>
            <h1>设置今日作业</h1>
            <form method="POST" action="/setc" enctype="multipart/form-data">
                <textarea id="homework" name="homework" rows="10" cols="50">${homework}</textarea>
                <br>
                <button type="button" onclick="insertAtCursor('homework', '[image]')">插入图片占位符</button>
                <button type="button" onclick="insertAtCursor('homework', '\\n')">插入换行</button>
                <br><br>
                <input type="file" name="images" accept="image/*" multiple />
                <br>
                <button type="submit">提交</button>
            </form>
            <hr>
            <h2>更改密码</h2>
            <form method="POST" action="/set-password">
                <input type="password" name="newPassword" placeholder="新密码" required />
                <button type="submit">更改密码</button>
            </form>
        </body>
        </html>
    `);
});

// 保存作业内容和图片
app.post('/setc', upload.array('images', 3), async (req, res) => {
    const homework = req.body.homework || '（无内容）';
    const images = req.files;

    try {
        let updatedHomework = homework;

        // 上传图片后，将图片 Markdown 插入到作业内容中
        images.forEach((image) => {
            const imageMarkdown = `![image](data:image/png;base64,${image.buffer.toString('base64')})`;
            updatedHomework = updatedHomework.replace(/\[image\]/, imageMarkdown); // 替换标记为图片
        });

        await pool.query(
            `INSERT INTO homework (id, content) VALUES ($1, $2)
             ON CONFLICT (id) DO UPDATE SET content = $2;`,
            [1, updatedHomework]
        );

        res.redirect('/');
    } catch (err) {
        res.status(500).send('保存作业内容或图片时出错');
    }
});

// 更新密码
app.post('/set-password', async (req, res) => {
    const newPassword = req.body.newPassword;
    if (!newPassword) return res.status(400).send('密码不能为空');
    try {
        await updatePassword(newPassword);
        res.send('密码已更改成功！<a href="/setc">返回设置页面</a>');
    } catch (err) {
        res.status(500).send('更改密码时出错');
    }
});

// 优雅关闭数据库连接
process.on('SIGINT', async () => {
    await pool.end();
    process.exit();
});

module.exports = app;
