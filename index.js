const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');  // Import cookie-parser
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');
const { marked } = require('marked');

// App and Middleware setup
const app = express();

// Use cookie-parser to manage cookies
app.use(cookieParser());  // Make sure to use cookie-parser before bodyParser

// Middleware for parsing request bodies
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
const userRoute = require('./r/user');  // Import the user route

// Dashboard routes for admin and user
app.use('/', homeworkRoute);
app.use('/setc', setcRoute);
app.use('/setc/user', userRoute);  // Mount user management route to /setc/user
app.use('/set-password', setPasswordRoute);

// Admin and user dashboard routes
app.use('/setc/admin-dashboard', setcRoute);  // Add admin dashboard route
app.use('/setc/user-dashboard', setcRoute);  // Add user dashboard route
app.use('/setc/ver', setcRoute);  

// Database table setup
const { checkAndCreateTables } = require('./r/db');
checkAndCreateTables();

// Export the app for use in other parts of the application
module.exports = app;
