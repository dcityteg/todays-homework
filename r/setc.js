const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, getUserRole, updatePassword, createUser, deleteUser } = require('./db');
const pool = require('./db').pool;
const upload = require('./multer');
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

    // 获取所有用户
    const users = await pool.query('SELECT id, username, role FROM users');

    // 如果是管理员，显示用户管理功能
    if (isAdmin) {
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
                        <li>${user.username} - 角色: ${user.role} 
                            <a href="/setc/delete-user?username=${user.username}">删除</a>
                        </li>
                    `).join('')}
                </ul>

                <h3>新建用户</h3>
                <form method="POST" action="/setc/create-user">
                    <label for="newUsername">用户名:</label>
                    <input type="text" id="newUsername" name="username" required />
                    <br><br>
                    <label for="newRole">角色:</label>
                    <select name="role" id="newRole">
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                    </select>
                    <br><br>
                    <label for="password">请输入管理员密码:</label>
                    <input type="password" name="password" required />
                    <br><br>
                    <button type="submit">创建用户</button>
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
        </body>
        </html>
    `);
});

// 处理新建用户
router.post('/create-user', async (req, res) => {
    const { username, role, password } = req.body;

    try {
        // 管理员密码验证
        const storedHash = await getPasswordHash();
        const isValidPassword = await bcrypt.compare(password, storedHash);
        if (!isValidPassword) {
            return res.status(403).send('Invalid administrator password.');
        }

        // 创建新用户
        const newUser = await createUser(username, role);
        res.redirect('/setc');  // 重定向到管理员设置页面
    } catch (err) {
        res.status(500).send('创建用户时出错');
    }
});

// 处理删除用户
router.get('/delete-user', async (req, res) => {
    const { username } = req.query;

    try {
        // 不能删除管理员账户
        if (username === 'admin') {
            return res.status(400).send('Cannot delete admin user.');
        }

        await deleteUser(username);
        res.redirect('/setc');  // 删除成功后重定向到管理员设置页面
    } catch (err) {
        res.status(500).send('删除用户时出错');
    }
});

module.exports = router;
