const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const upload = require('./multer');  // 确保 multer 被正确配置
const router = express.Router();

// 校验码生成函数
async function generateVerificationCode(no) {
    const currentDate = new Date();
    let minutes = currentDate.getMinutes();
    minutes = Math.floor(minutes / 10) * 10;
    currentDate.setMinutes(minutes);
    currentDate.setSeconds(0);
    currentDate.setMilliseconds(0);

    let verificationCode = (currentDate.getTime() / 1000 + no) % 10000;
    verificationCode = verificationCode.toString().padStart(4, '0');

    // 哈希校验码
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    return { verificationCode, hashedCode };
}

// 设置登录cookie
function setLoginCookie(res, user) {
    res.cookie('user', user, { maxAge: 3600000, httpOnly: true });
}

// 清除登录cookie
function clearLoginCookie(res) {
    res.clearCookie('user');
}

// /setc/ver 路由：生成并展示校验码的哈希值
router.get('/ver', async (req, res) => {
    const { no } = req.query;

    if (!no || isNaN(no) || no < 1 || no > 100) {
        return res.status(400).send('无效的no参数，必须是1到100之间的数字');
    }

    // 生成校验码及其哈希值
    const { hashedCode } = await generateVerificationCode(Number(no));

    res.send(`
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>当前校验码的哈希值</title>
        </head>
        <body>
            <h1>当前校验码的哈希值</h1>
            <p>no参数: ${no}</p>
            <p>校验码的哈希值: ${hashedCode}</p>
        </body>
        </html>
    `);
});

// 管理员仪表盘路由
router.get('/admin-dashboard', async (req, res) => {
    const { no, code } = req.query;

    // 如果没有提供校验码哈希值或no参数，提示用户输入
    if (!no || !code) {
        return res.send(`
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>管理员登录</title>
            </head>
            <body>
                <h1>请输入校验码哈希值</h1>
                <form method="GET" action="/setc/admin-dashboard">
                    <label for="no">校验码的no:</label>
                    <input type="number" id="no" name="no" required min="1" max="100" /><br><br>
                    <label for="code">校验码的哈希值:</label>
                    <input type="text" id="code" name="code" required /><br><br>
                    <button type="submit">提交</button>
                </form>
            </body>
            </html>
        `);
    }

    try {
        // 生成校验码的哈希值
        const { hashedCode } = await generateVerificationCode(Number(no));

        // 比较输入的哈希值
        if (code !== hashedCode) {
            return res.status(403).send('无效的校验码哈希值。');
        }

        // 登录成功，设置cookie
        setLoginCookie(res, 'admin');  // 假设为管理员用户，直接设置登录cookie

        // 查询作业内容和最后更新时间
        const homeworkResult = await pool.query('SELECT content, updated_at FROM homework WHERE id = $1', [1]);
        let homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const updatedAt = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].updated_at : null;

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

// 退出登录
router.get('/logout', (req, res) => {
    clearLoginCookie(res);
    res.redirect('/setc/admin-dashboard');
});

// 处理管理员仪表盘的 POST 请求
router.post('/admin-dashboard', upload.array('images'), async (req, res) => {
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

module.exports = router;
