const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, getUserRole, getUserPassword } = require('./db');
const pool = require('./db').pool;
const upload = require('./multer'); // 需要确保 multer 被正确配置
const userRoute = require('./user');  // 导入 user 路由
const router = express.Router();

// 使用 user 路由来处理用户管理
router.use('/user', userRoute);

// 管理员页面
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

    try {
        // 获取用户角色
        const role = await getUserRole(user);

        // 获取管理员密码哈希
        const storedAdminHash = await getPasswordHash();

        // 验证管理员密码
        if (role === 'admin') {
            const isAdminValid = await bcrypt.compare(password, storedAdminHash);
            if (!isAdminValid) {
                return res.status(403).send('无效的管理员密码。');
            }
        } else {
            // 获取用户的密码哈希
            const storedUserHash = await getUserPassword(user);
            const isUserValid = await bcrypt.compare(password, storedUserHash);
            if (!isUserValid) {
                return res.status(403).send('无效的用户密码。');
            }
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
        if (role === 'admin') {
            return res.send(`
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
                                <a href="/setc/user/delete-user?username=${user.username}">删除</a>
                            </li>
                        `).join('')}
                    </ul>

                    <h3>新建用户</h3>
                    <form method="POST" action="/setc/user/create-user">
                        <label for="newUsername">用户名:</label>
                        <input type="text" id="newUsername" name="username" required />
                        <br><br>
                        <label for="newPassword">密码:</label>
                        <input type="password" id="newPassword" name="password" required />
                        <br><br>
                        <label for="newRole">角色:</label>
                        <select name="role" id="newRole">
                            <option value="user">普通用户</option>
                            <option value="admin">管理员</option>
                        </select>
                        <br><br>
                        <label for="password">请输入管理员密码:</label>
                        <input type="password" name="adminPassword" required />
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
        return res.send(`
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
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('服务器内部错误');
    }
});

// 处理 POST 请求，更新作业内容
router.post('/', upload.array('images'), async (req, res) => {
    const { homework } = req.body;

    try {
        // 保存作业内容
        await pool.query('UPDATE homework SET content = $1 WHERE id = $2', [homework, 1]);
        res.send('作业内容已成功更新！');
    } catch (error) {
        console.error('更新作业时出错:', error);
        res.status(500).send('服务器错误');
    }
});

module.exports = router;
