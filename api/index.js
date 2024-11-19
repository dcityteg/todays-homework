const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { marked } = require('marked');

const app = express();

let homework = ''; // 存储作业内容（Markdown 格式）

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// 配置 src 文件夹为静态资源目录
app.use(express.static(path.join(__dirname, '../src')));

// 根路径 `/` 显示今日作业
app.get('/', (req, res) => {
    const renderedHomework = marked(homework); // 将 Markdown 转换为 HTML
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Today's Homework</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
                pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            <h1>今日作业</h1>
            <div>${renderedHomework || '<p>暂无作业内容</p>'}</div>
            <br>
        </body>
        </html>
    `);
});

// `/setc` 路由 - 设置作业
app.get('/setc', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Set Homework</title>
        </head>
        <body>
            <h1>设置今日作业</h1>
            <form method="POST" action="/setc">
                <textarea name="homework" rows="10" cols="50" placeholder="输入Markdown格式的作业内容"></textarea>
                <br>
                <button type="submit">提交</button>
            </form>
        </body>
        </html>
    `);
});

// 接收作业内容
app.post('/setc', (req, res) => {
    homework = req.body.homework || '（无内容）';
    res.send(`
        <h1>作业已更新！</h1>
        <p>点击 <a href="/">这里</a> 查看今日作业。</p>
    `);
});

module.exports = app;
