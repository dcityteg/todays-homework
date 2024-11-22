const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash } = require('./db');
const pool = require('./db').pool;
const upload = require('./multer');  // 导入 multer 配置
const router = express.Router();

// 设置作业页面
router.get('/', async (req, res) => {
    const { s: suppliedPassword } = req.query;
    const storedHash = await getPasswordHash();

    // 校验密码
    const isValidPassword = await bcrypt.compare(suppliedPassword || '', storedHash);
    if (!isValidPassword) {
        return res.status(403).send('Invalid password or missing password. Example: /setc?s=yourpassword');
    }

    // 查询作业内容和最后更改时间
    const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
    let homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
    const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

    // 使用正则表达式查找图片并替换为占位符
    homework = homework.replace(/!\[image\]\(data:image\/png;base64,[^)]*\)/g, '[image]');

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
            <h1>设置展示内容</h1>
            <form method="POST" action="/setc" enctype="multipart/form-data">
                <textarea id="homework" name="homework" rows="10" cols="50">${homework}</textarea>
                <br>
                <button type="button" onclick="insertAtCursor('homework', '[image]')">插入已上传图片</button>
                <button type="button" onclick="insertAtCursor('homework', '\\n')">换行</button>
                <br><br>
                <input type="file" name="images" accept="image/*" multiple />
                <br>
                <button type="submit">提交</button>
            </form>
            <hr>
            <h2>Change Password</h2>
            <form method="POST" action="/set-password">
                <input type="password" name="newPassword" placeholder="New Password" required />
                <button type="submit">Change Password</button>
            </form>

            <hr>

            <h3>最后更改时间:</h3>
            <p>${updatedAt ? updatedAt.toLocaleString() : '未设置作业'}</p>
        </body>
        </html>
    `);
});

// 处理作业内容和图片上传
router.post('/', upload.array('images', 3), async (req, res) => {
    let homework = req.body.homework || '（无内容）';
    const images = req.files;

    try {
        let updatedHomework = homework;

        // 如果有上传的图片，将它们替换到作业内容中的占位符
        images.forEach((image) => {
            const imageMarkdown = `![image](data:image/png;base64,${image.buffer.toString('base64')})`;
            updatedHomework = updatedHomework.replace('[image]', imageMarkdown);
        });

        // 更新数据库中的作业内容以及更新时间
        await pool.query(
            `INSERT INTO homework (id, content, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (id) 
             DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP;`,
            [1, updatedHomework]
        );

        res.redirect('/');  // 提交成功后重定向到主页
    } catch (err) {
        console.error('保存作业内容或图片时出错:', err);
        res.status(500).send('保存作业内容或图片时出错');
    }
});

module.exports = router;
