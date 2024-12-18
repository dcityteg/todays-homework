const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,  // 可根据需求调整
    idleTimeoutMillis: 30000,
});

// 创建作业表的 SQL 查询
const createHomeworkTableQuery = `
    CREATE TABLE IF NOT EXISTS homework (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL CHECK (length(content) > 0),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const checkAndCreateTables = async () => {
    try {
        // 创建作业表、密码表和用户表
        await pool.query(createHomeworkTableQuery);

    } catch (err) {
        console.error('Error creating tables or adding missing columns:', err);
    }
};

module.exports = { 
    pool, 
    checkAndCreateTables, 
};
