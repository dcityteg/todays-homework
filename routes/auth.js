const express = require('express');
const { getSetHomeworkPage, updatePassword } = require('../controllers/auth');

const router = express.Router();

router.get('/setc', getSetHomeworkPage);
router.post('/set-password', updatePassword);

module.exports = router;
