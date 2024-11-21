const { pool } = require('../models/db');
const bcrypt = require('bcrypt');

// 获取设置作业页面
const getSetHomeworkPage = async (req, res) => {
    const { s: suppliedPassword } = req.query;
    const result = await pool.query('SELECT hash FROM password LIMIT 1');
    const storedHash = result.rows[0].hash;

    if (!suppliedPassword || !(await bcrypt.compare(suppliedPassword, storedHash))) {
        return res.status(403).send('密码错误或未提供，请在URL中添加正确的密码参数。');
    }

    res.sendFile(path.join(__dirname, '../views/setc.html'));
};

// 更新密码
const updatePassword = async (req, res) => {
    const newPassword = req.body.newPassword;
    if (!newPassword) return res.status(400).send('密码不能为空');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE password SET hash = $1 WHERE id = 1', [hashedPassword]);
    res.send('密码已更改成功！<a href="/setc">返回设置页面</a>');
};

module.exports = { getSetHomeworkPage, updatePassword };
