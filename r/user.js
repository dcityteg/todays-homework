// /r/user.js
const express = require('express');
const bcrypt = require('bcrypt');
const { getPasswordHash, createUser, deleteUser } = require('./db');
const router = express.Router();

// 处理新建用户
router.post('/create-user', async (req, res) => {
    const { username, password, role, adminPassword } = req.body;

    try {
        // 管理员密码验证
        const storedHash = await getPasswordHash();
        const isValidPassword = await bcrypt.compare(adminPassword, storedHash);
        if (!isValidPassword) {
            return res.status(403).send('无效的管理员密码。');
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建新用户
        const newUser = await createUser(username, hashedPassword, role);
        res.redirect('/setc');  // 重定向到管理员设置页面
    } catch (err) {
        console.error(err);
        res.status(500).send('创建用户时出错');
    }
});

// 处理删除用户
router.get('/delete-user', async (req, res) => {
    const { username } = req.query;

    try {
        // 不能删除管理员账户
        if (username === 'admin') {
            return res.status(400).send('无法删除管理员账户。');
        }

        await deleteUser(username);
        res.redirect('/setc');  // 删除成功后重定向到管理员设置页面
    } catch (err) {
        res.status(500).send('删除用户时出错');
    }
});

module.exports = router;
