const { pool } = require('../models/db');
const { DOMPurifyInstance } = require('../utils/sanitize');
const { marked } = require('marked');

// 显示作业内容
const showHomework = async (req, res) => {
    try {
        const homeworkResult = await pool.query('SELECT content FROM homework WHERE id = $1', [1]);
        const homework = homeworkResult.rows.length > 0 ? homeworkResult.rows[0].content : '';
        const renderedHomework = DOMPurifyInstance.sanitize(marked(homework));

        res.sendFile(path.join(__dirname, '../views/index.html'), {
            renderedHomework: renderedHomework || '<p>暂无作业内容</p>',
        });
    } catch (err) {
        res.status(500).send('服务器内部错误');
    }
};

// 保存作业内容
const setHomework = async (req, res) => {
    const homework = req.body.homework || '（无内容）';
    const images = req.files;

    try {
        let updatedHomework = homework;
        images.forEach((image) => {
            const imageMarkdown = `![image](data:image/png;base64,${image.buffer.toString('base64')})`;
            updatedHomework = updatedHomework.replace(/\[image\]/, imageMarkdown);
        });

        await pool.query(
            `INSERT INTO homework (id, content) VALUES ($1, $2)
             ON CONFLICT (id) DO UPDATE SET content = $2;`,
            [1, updatedHomework]
        );

        res.redirect('/');
    } catch (err) {
        res.status(500).send('保存作业内容或图片时出错');
    }
};

module.exports = { showHomework, setHomework };
