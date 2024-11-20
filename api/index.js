const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');
const { Pool } = require('pg');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// 初始化 DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

const app = express();

// 初始化 PostgreSQL 连接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

// 配置静态资源路径和中间件
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src')));

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

    try {
        await pool.query(createHomeworkTableQuery);
        await pool.query(createHomeworkImagesTableQuery);
        console.log('数据库表格创建或已存在');
    } catch (err) {
        console.error('创建表格时出错:', err);
    }
};

// 在应用启动时调用
checkAndCreateTables();

// 根路径 `/` 显示今日作业
app.get('/', async (req, res) => {
    try {
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const renderedHomework = DOMPurifyInstance.sanitize(marked(homework));

        const imagesResult = await pool.query('SELECT image_data FROM homework_images WHERE homework_id = $1', [1]);
        const images = imagesResult.rows.map((row) => `<img src="data:image/png;base64,${row.image_data.toString('base64')}" />`);

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
                <div>${images.join('')}</div>
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
            <form method="POST" action="/setc" enctype="multipart/form-data">
                <textarea name="homework" rows="10" cols="50" placeholder="输入Markdown格式的作业内容" maxlength="500"></textarea>
                <br>
                <input type="file" name="images" accept="image/*" multiple />
                <br>
                <button type="submit">提交</button>
            </form>
        </body>
        </html>
    `);
});

// 接收作业内容和图片并存储到数据库
app.post('/setc', upload.array('images', 3), async (req, res) => {
    const sanitizeInput = (input) => input.replace(/<script.*?>.*?<\/script>/gim, '');
    const homework = sanitizeInput(req.body.homework || '（无内容）');

    try {
        // 更新作业内容
        await pool.query(`
            INSERT INTO homework (id, content) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET content = $2;
        `, [1, homework]);

        // 删除旧图片
        await pool.query('DELETE FROM homework_images WHERE homework_id = $1', [1]);

        // 限制图片数量为 3 张
        const images = req.files.slice(0, 3);
        for (const image of images) {
            await pool.query(`
                INSERT INTO homework_images (homework_id, image_data) VALUES ($1, $2);
            `, [1, image.buffer]);
        }

        res.send(`
            <h1>作业已更新！</h1>
            <p>点击 <a href="/">这里</a> 查看今日作业。</p>
        `);
    } catch (err) {
        console.error('保存作业内容或图片时出错:', err);
        res.status(500).send('服务器内部错误');
    }
});

// 优雅地关闭数据库连接
process.on('SIGINT', async () => {
    await pool.end();
    process.exit();
});

module.exports = app;
