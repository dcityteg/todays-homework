const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash } = require('./db');
const pool = require('./db').pool;
const router = express.Router();

// Set Homework Route
router.get('/', async (req, res) => {
    const { s: suppliedPassword } = req.query;
    const storedHash = await getPasswordHash();

    // Validate password
    const isValidPassword = await bcrypt.compare(suppliedPassword || '', storedHash);
    if (!isValidPassword) {
        return res.status(403).send('Invalid password or missing password. Example: /setc?s=yourpassword');
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
        </body>
        </html>
    `);
});

module.exports = router;
