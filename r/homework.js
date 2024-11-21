const express = require('express');
const { marked } = require('marked');
const { pool } = require('./db');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const router = express.Router();

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// Homework Route
router.get('/', async (req, res) => {
    try {
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const renderedHomework = DOMPurifyInstance.sanitize(marked(homework));

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>今日作业</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                    img { max-width: 100%; height: auto; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>今日作业</h1>
                <div>${renderedHomework || '<p>暂未上传作业</p>'}</div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
