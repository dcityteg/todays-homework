const express = require('express');
const multer = require('multer');
const { marked } = require('marked');
const bcrypt = require('bcrypt');  // 确保导入 bcrypt

const router = express.Router();

// 配置 multer 用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = (pool, DOMPurifyInstance) => {
    // 显示今日作业
    router.get('/', async (req, res) => {
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
    router.get('/setc', async (req, res) => {
        const { s: suppliedPassword } = req.query;
        const result = await pool.query('SELECT hash FROM password LIMIT 1');
        const storedHash = result.rows[0]?.hash;

        // 校验密码
        const isValidPassword = storedHash && (await bcrypt.compare(suppliedPassword || '', storedHash));
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
            </head>
            <body>
                <h1>设置今日作业</h1>
                <form method="POST" action="/setc" enctype="multipart/form-data">
                    <textarea name="homework" rows="10" cols="50">${homework}</textarea>
                    <input type="file" name="images" accept="image/*" multiple />
                    <button type="submit">提交</button>
                </form>
            </body>
            </html>
        `);
    });

    // 保存作业内容和图片
    router.post('/setc', upload.array('images', 3), async (req, res) => {
        const homework = req.body.homework || '（无内容）';
        const images = req.files;

        try {
            let updatedHomework = homework;

            images.forEach((image) => {
                const imageMarkdown = `![image](data:image/png;base64,${image.buffer.toString('base64')})`;
                updatedHomework = updatedHomework.replace(/\[image\]/, imageMarkdown);
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

    return router;
};
