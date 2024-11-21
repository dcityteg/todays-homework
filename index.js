const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

// 路由文件
const setcRoute = require('./r/setc');
const homeworkRoute = require('./r/homework');  // 导入 homework.js
const setPasswordRoute = require('./r/set-password');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 设定静态文件路径
app.use(express.static(path.join(__dirname, 'msrc'))); // 静态文件目录为 'msrc'

// 主页加载 msrc/index.html 文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'msrc', 'index.html'));
});

// 路由配置
app.use('/setc', setcRoute);
app.use('/homework', homeworkRoute); // 使用 homework.js 来处理 /homework 路由
app.use('/set-password', setPasswordRoute);

// 启动服务
module.exports = app;
