const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');
const { marked } = require('marked');

// App and Middleware setup
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Database and file upload setup
const pool = require('./r/db');
const upload = require('./r/multer');
const DOMPurifyInstance = DOMPurify(new JSDOM('').window);

// Routes
const setcRoute = require('./r/setc');
const homeworkRoute = require('./r/homework');
const setPasswordRoute = require('./r/set-password');
const userRoute = require('./r/user');  // 导入 user 路由

// 这里设置了管理员和普通用户的仪表盘路由
app.use('/', homeworkRoute);
app.use('/setc', setcRoute);
app.use('/setc/user', userRoute);  // 将用户管理路由挂载到 /setc/user
app.use('/set-password', setPasswordRoute);

// 管理员和普通用户的仪表盘路径
app.use('/setc/admin-dashboard', setcRoute);  // 添加管理员仪表盘路径
app.use('/setc/user-dashboard', setcRoute);  // 添加普通用户仪表盘路径

// Database table setup
const { checkAndCreateTables } = require('./r/db');
checkAndCreateTables();

module.exports = app;
