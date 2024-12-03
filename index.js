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

app.use('/', homeworkRoute);
app.use('/setc', setcRoute);
app.use('/setc/create-user', setcRoute);
app.use('/set-password', setPasswordRoute);

// Database table setup
const { checkAndCreateTables } = require('./r/db');
checkAndCreateTables();

module.exports = app;
