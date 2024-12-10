const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, getUserRole, getUserPassword, updatePassword, validateUser } = require('./db');
const pool = require('./db').pool;
const upload = require('./multer');  // 确保 multer 被正确配置
const router = express.Router();

// 管理员仪表盘路由
router.get('/admin-dashboard', async (req, res) => {
    const { user, password } = req.query;

    // 如果没有提供用户名或密码，提示用户输入
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
                <form method="GET" action="/setc/admin-dashboard">
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

        // 确保是管理员角色
        if (role !== 'admin') {
            return res.status(403).send('无效的管理员权限。');
        }

        // 获取管理员密码哈希并验证
        const storedHash = await getPasswordHash(user);  // 获取管理员密码哈希
        const isValid = await bcrypt.compare(password, storedHash);
        if (!isValid) {
            return res.status(403).send('无效的管理员密码。');
        }

        // 查询作业内容和最后更新时间
        const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
        let homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

        // 格式化时间（中国时区）
        const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置作业';

        return res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理员仪表盘</title>
            </head>
            <body>
                <h1>管理员仪表盘</h1>
                <form method="POST" action="/setc/admin-dashboard" enctype="multipart/form-data">
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
        console.error('错误:', error);
        res.status(500).send('服务器内部错误');
    }
});

// 处理管理员仪表盘的 POST 请求
router.post('/admin-dashboard', async (req, res) => {
    const { homework } = req.body;

    // 检查提交的作业内容
    if (!homework) {
        return res.status(400).send('作业内容不能为空');
    }

    try {
        // 更新作业内容到数据库
        const result = await pool.query('UPDATE homework SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [homework, 1]);
        const updatedHomework = result.rows[0];

        res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理员仪表盘</title>
            </head>
            <body>
                <h1>作业更新成功</h1>
                <h2>新作业内容:</h2>
                <p>${updatedHomework.content}</p>
                <h3>最后更改时间:</h3>
                <p>${new Date(updatedHomework.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('错误:', error);
        res.status(500).send('更新作业时发生错误');
    }
});

// 普通用户仪表盘路由
router.get('/user-dashboard', async (req, res) => {
    const { user, password } = req.query;

    // 如果没有提供用户名或密码，提示用户输入
    if (!user || !password) {
        return res.send(`
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>普通用户登录</title>
            </head>
            <body>
                <h1>请输入用户名和密码</h1>
                <form method="GET" action="/setc/user-dashboard">
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

    // 验证密码是否与硬编码的用户密码匹配
    if (password !== '123abc') {
        return res.status(403).send('无效的用户密码。');
    }

    try {
        // 查询作业内容和最后更新时间
        const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
        let homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

        // 格式化时间（中国时区）
        const formattedUpdatedAt = updatedAt ? new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未设置作业';

        return res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>普通用户仪表盘</title>
            </head>
            <body>
                <h1>普通用户仪表盘</h1>
                <form method="POST" action="/setc/user-dashboard" enctype="multipart/form-data">
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
        console.error('错误:', error);
        res.status(500).send('服务器内部错误');
    }
});

// 处理普通用户仪表盘的 POST 请求
router.post('/user-dashboard', async (req, res) => {
    const { homework } = req.body;

    // 检查提交的作业内容
    if (!homework) {
        return res.status(400).send('作业内容不能为空');
    }

    try {
        // 更新作业内容到数据库
        const result = await pool.query('UPDATE homework SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [homework, 1]);
        const updatedHomework = result.rows[0];

        res.send(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>普通用户仪表盘</title>
            </head>
            <body>
                <h1>作业更新成功</h1>
                <h2>新作业内容:</h2>
                <p>${updatedHomework.content}</p>
                <h3>最后更改时间:</h3>
                <p>${new Date(updatedHomework.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('错误:', error);
        res.status(500).send('更新作业时发生错误');
    }
});

module.exports = router;
