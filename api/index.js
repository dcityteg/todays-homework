const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');
const { Pool } = require('pg');
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

// 动态密码存储（仅保存在内存中）
let homeworkPassword = null;

// 设置密码方法（仅在控制台调用）
const setPassword = (newPassword) => {
    homeworkPassword = newPassword;
    console.log(`作业设置密码已更新为: ${newPassword}`);
};

// 示例：在应用启动时设置初始密码
setPassword('123abc');

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

    try {
        await pool.query(createHomeworkTableQuery);
        await pool.query(createHomeworkImagesTableQuery);
        console.log('数据库表格创建或已存在');
    } catch (err) {
        console.error('创建表格时出错:', err);
    }
};

checkAndCreateTables();

// 获取当前作业内容及图片
const getHomeworkData = async () => {
    try {
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';

        const imagesResult = await pool.query('SELECT id, image_data FROM homework_images WHERE homework_id = $1', [1]);
        const images = imagesResult.rows.map((row) => ({
            id: row.id,
            data: `data:image/png;base64,${row.image_data.toString('base64')}`,
        }));

        return { homework, images };
    } catch (err) {
        console.error('获取作业内容及图片时出错:', err);
        throw err;
    }
};

// 显示今日作业
app.get('/', async (req, res) => {
    try {
        const { homework, images } = await getHomeworkData();
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

// 设置作业页面（带密码验证）
app.get('/setc', async (req, res) => {
    const { s: suppliedPassword } = req.query;

    // 验证密码
    if (homeworkPassword && homeworkPassword !== suppliedPassword) {
        return res.status(403).send('密码错误或未提供，请在URL中添加正确的密码参数。例如 /setc?s=密码');
    }

    try {
        const { homework, images } = await getHomeworkData();
        const imagesMarkdown = images.map((img) => `![image](${img.data})`).join('\n');

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
                <form method="POST" action="/setc" enctype="multipart/form-data">
                    <textarea name="homework" rows="10" cols="50" placeholder="输入Markdown格式的作业内容">${homework}</textarea>
                    <br>
                    ${imagesMarkdown || '<p>暂无已上传图片</p>'}
                    <input type="file" name="images" accept="image/*" multiple />
                    <br>
                    <button type="submit">提交</button>
                </form>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('服务器内部错误');
    }
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

        // 更新数据库内容
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

// 优雅关闭数据库连接
process.on('SIGINT', async () => {
    await pool.end();
    process.exit();
});

module.exports = app;
