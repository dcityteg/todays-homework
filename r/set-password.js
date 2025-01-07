const express = require('express');
const { updatePassword } = require('./db');
const router = express.Router();

// Change Password Route
router.post('/', async (req, res) => {
    const newPassword = req.body.newPassword;
    if (!newPassword) return res.status(400).send('Password cannot be empty');
    try {
        await updatePassword(newPassword);
        //返回修改密码后的控制台（/setc?s=xxx）
        res.send(`密码已修改！<a href="/setc?s=${newPassword}">返回控制台</a>`);
    } catch (err) {
        res.status(500).send('Error changing password');
    }
});

module.exports = router;
