const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();

module.exports = (pool) => {
    // 更新密码
    router.post('/set-password', async (req, res) => {
        const newPassword = req.body.newPassword;
        if (!newPassword) return res.status(400).send('密码不能为空');

        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE password SET hash = $1 WHERE id = 1', [hashedPassword]);
            res.send('密码已更改成功！<a href="/setc">返回设置页面</a>');
        } catch (err) {
            res.status(500).send('更改密码时出错');
        }
    });

    return router;
};
