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
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                }
                h1, h2 {
                    margin-bottom: 15px;
                }
                form {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    width: 100%;
                    max-width: 600px;
                    margin: auto;
                }
                textarea {
                    font-family: Arial, sans-serif;
                    font-size: 16px;
                    padding: 10px;
                    width: 100%;
                    height: 200px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
                button {
                    padding: 8px 16px;
                    font-size: 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                input[type="file"] {
                    padding: 10px;
                }
                .password-section {
                    margin-top: 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                    max-width: 600px;
                    margin: auto;
                }
                input[type="password"] {
                    font-family: Arial, sans-serif;
                    font-size: 16px;
                    padding: 10px;
                    width: 100%;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
            </style>
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
                <div>
                    <button type="button" onclick="insertAtCursor('homework', '[image]')">插入图片占位符</button>
                    <button type="button" onclick="insertAtCursor('homework', '\\n')">插入换行</button>
                </div>
                <input type="file" name="images" accept="image/*" multiple />
                <button type="submit">提交</button>
            </form>
            
            <hr>

            <div class="password-section">
                <h2>更改密码</h2>
                <form method="POST" action="/set-password">
                    <input type="password" name="newPassword" placeholder="新密码" required />
                    <button type="submit">更改密码</button>
                </form>
            </div>
        </body>
        </html>
    `);
});
}


