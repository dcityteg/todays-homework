const express = require('express');
const { updatePassword } = require('./db');
const router = express.Router();

// Change Password Route
router.post('/', async (req, res) => {
    const newPassword = req.body.newPassword;
    if (!newPassword) return res.status(400).send('Password cannot be empty');
    try {
        await updatePassword(newPassword);
        res.send('Password changed successfully! <a href="/setc">Back to settings</a>');
    } catch (err) {
        res.status(500).send('Error changing password');
    }
});

module.exports = router;
