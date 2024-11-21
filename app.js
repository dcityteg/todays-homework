const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { checkAndCreateTables } = require('./models/tables');
const homeworkRoutes = require('./routes/homework');
const authRoutes = require('./routes/auth');

const app = express();

// 中间件
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 路由
app.use('/', homeworkRoutes);
app.use('/', authRoutes);

// 初始化数据库表
checkAndCreateTables();

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务器运行在 http://localhost:${PORT}`));
