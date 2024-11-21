const express = require('express');
const { showHomework, setHomework } = require('../controllers/homework');
const { upload } = require('../utils/upload');

const router = express.Router();

router.get('/', showHomework);
router.post('/setc', upload.array('images', 3), setHomework);

module.exports = router;
