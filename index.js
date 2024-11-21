const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');

const app = express();
const homeworkRoutes = require('routes/homework');
const passwordRoutes = require('routes/password');

// 初始化 PostgreSQL 连接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

// 初始化 DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// 全局中间件
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 路由
app.use('/homework', homeworkRoutes(pool, DOMPurifyInstance));  // 将作业相关路由放在 /homework 下
app.use('/password', passwordRoutes(pool));  // 将密码相关路由放在 /password 下

// 优雅关闭数据库连接
process.on('SIGINT', async () => {
    await pool.end();
    process.exit();
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
