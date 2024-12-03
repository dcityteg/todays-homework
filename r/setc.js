const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, getUserRole } = require('./db');
const pool = require('./db').pool;
const upload = require('./multer');  // 导入 multer 配置
const router = express.Router();

router.get('/', async (req, res) => {
    const { user, password } = req.query;

    // 校验用户名和密码
    if (!user || !password) {
        return res.status(403).send('Missing user or password. Example: /setc?user=admin&password=yourpassword');
    }

    // 获取用户角色
    const role = await getUserRole(user);
    
    // 管理员验证
    const isAdmin = user === 'admin' && password === '114514';
    if (!isAdmin && role !== 'admin') {
        return res.status(403).send('Access denied. Only admin can manage users.');
    }

    // 验证密码
    const storedHash = await getPasswordHash();
    const isValidPassword = await bcrypt.compare(password, storedHash);
    if (!isValidPassword) {
        return res.status(403).send('Invalid password.');
    }

    // 查询作业内容和最后更改时间
    const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
    let homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
    const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

    // 格式化时间（根据中国时区）
    const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置作业';

    res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>设置展示内容</title>
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
            <!-- AI Assistant Script Integration -->
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
            <p>${formattedUpdatedAt}</p>
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
