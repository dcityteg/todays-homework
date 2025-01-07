// /r/setc.js
const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, getUserRole, updatePassword } = require('./db');
const pool = require('./db').pool;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const upload = require('./multer');  // 导入 multer 配置
=======
=======
>>>>>>> parent of 03d290c (2.1.0)
=======
>>>>>>> parent of 03d290c (2.1.0)
const upload = require('./multer');
const userRoute = require('./user');  // 导入 user 路由
>>>>>>> parent of 03d290c (2.1.0)
const router = express.Router();

router.get('/', async (req, res) => {
    const { user, password } = req.query;

    // 如果没有提供用户名和密码，要求输入
    if (!user || !password) {
        return res.send(`
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理员登录</title>
            </head>
            <body>
                <h1>请输入用户名和密码</h1>
                <form method="GET" action="/setc">
                    <label for="user">用户名:</label>
                    <input type="text" id="user" name="user" required /><br><br>
                    <label for="password">密码:</label>
                    <input type="password" id="password" name="password" required /><br><br>
                    <button type="submit">提交</button>
                </form>
            </body>
            </html>
        `);
    }

    // 验证用户名和密码
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

    // 如果是管理员，显示用户管理功能
    if (isAdmin) {
        const users = await pool.query('SELECT id, username, role FROM users');

        res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理员设置</title>
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
                <h2>用户管理</h2>
                <h3>用户列表：</h3>
                <ul>
                    ${users.rows.map(user => `
                        <li>${user.username} - 角色: ${user.role} <a href="/setc/change-role?user=${user.username}">修改角色</a></li>
                    `).join('')}
                </ul>
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
    }

    // 普通用户只能修改作业内容
    res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>普通用户设置</title>
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
            <h3>最后更改时间:</h3>
            <p>${formattedUpdatedAt}</p>
                  <script src="https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.0.0-beta.4/libs/cn/index.js"></script>
            
            <!-- AI Assistant Script Integration -->
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
        </body>
        </html>
    `);
});

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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

=======
>>>>>>> parent of 03d290c (2.1.0)
=======
>>>>>>> parent of 03d290c (2.1.0)
=======
>>>>>>> parent of 03d290c (2.1.0)
module.exports = router;
