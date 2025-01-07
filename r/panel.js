const express = require('express');
const crypto = require('crypto');
const { pool } = require('./db');
const upload = require('./multer');  // 确保 multer 被正确配置
const cookieParser = require('cookie-parser'); // 用于解析 cookies
const router = express.Router();

// 使用 cookieParser 中间件
router.use(cookieParser());

// 校验码生成函数
function generateVerificationCode(no) {
    const currentDate = new Date();
    let minutes = currentDate.getMinutes();
    minutes = Math.floor(minutes / 10) * 10;
    currentDate.setMinutes(minutes);
    currentDate.setSeconds(0);
    currentDate.setMilliseconds(0);

    let verificationCode = (currentDate.getTime() / 1000 + no) % 10000;
    verificationCode = verificationCode.toString().padStart(4, '0');

    // 使用 SHA-1 加密校验码
    const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(verificationCode);
    const hashedCode = sha1Hash.digest('hex');

    // 截取前16位
    const truncatedHashedCode = hashedCode.substring(0, 16);

    return { verificationCode, hashedCode: truncatedHashedCode };
}

// 设置登录cookie
function setLoginCookie(res, user) {
    res.cookie('user', user, { maxAge: 3600000, httpOnly: true });
}

// 清除登录cookie
function clearLoginCookie(res) {
    res.clearCookie('user');
}

// 新增 /vtxt 路由：返回一个包含动态参数的链接
router.get('/vtxt', (req, res) => {
    const { no } = req.query;

    // 检查 no 参数
    if (!no || isNaN(no) || no < 1 || no > 100) {
        return res.status(400).send('无效的no参数，必须是1到100之间的数字');
    }

    // 使用 no 参数生成对应的校验码哈希值
    const { hashedCode } = generateVerificationCode(Number(no));

    // 构造返回的 URL
    const link = `https://todo.xodi.top/pannel?no=${no}&code=${hashedCode}`;

    res.send(`
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>生成链接</title>
        </head>
        <body>
            <h1>生成的链接:</h1>
            <p>点击下方链接访问管理员仪表盘：</p>
            <a href="${link}" target="_blank">${link}</a>
        </body>
        </html>
    `);
});

// 管理员仪表盘路由，添加登录验证
router.get('/', async (req, res) => {
    const { no, code } = req.query;
    const user = req.cookies.user;

    // 如果没有登录(cookie不存在)，展示输入框
    if (!user) {
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
                    <form method="GET" action="/pannel">
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

        // 如果有 no 和 code 参数，验证哈希值
        const { hashedCode } = generateVerificationCode(Number(no));

        // 截取输入的哈希值的前16位
        const truncatedInputCode = code.substring(0, 16);

        // 比较截取后的哈希值
        if (truncatedInputCode !== hashedCode) {
            return res.status(403).send('无效的校验码哈希值');
        }

        // 校验成功，设置登录cookie
        setLoginCookie(res, 'admin');  // 假设为管理员用户，直接设置登录cookie
    } 

    // 如果已经登录，直接进入控制台，查询作业内容和最后更新时间
    try {
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
                <form method="POST" action="/pannel" enctype="multipart/form-data">
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
    res.redirect('/pannel');
});

// 处理管理员仪表盘的 POST 请求
router.post('/', upload.array('images'), async (req, res) => {
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
