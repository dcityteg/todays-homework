const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

// Create required tables
const checkAndCreateTables = async () => {
    // 创建作业表，并添加 updated_at 字段
    const createHomeworkTableQuery = `
        CREATE TABLE IF NOT EXISTS homework (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL CHECK (length(content) > 0),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    // 创建密码表
    const createPasswordTableQuery = `
        CREATE TABLE IF NOT EXISTS password (
            id SERIAL PRIMARY KEY,
            hash TEXT NOT NULL
        );
    `;
    
    try {
        // 创建作业表和密码表
        await pool.query(createHomeworkTableQuery);
        await pool.query(createPasswordTableQuery);

        // 确保密码表至少有一条记录
        const result = await pool.query('SELECT * FROM password');
        if (result.rows.length === 0) {
            const defaultPassword = 'defaultpassword';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await pool.query('INSERT INTO password (hash) VALUES ($1)', [hashedPassword]);
        }
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

// 获取密码的哈希值
const getPasswordHash = async () => {
    const result = await pool.query('SELECT hash FROM password LIMIT 1');
    return result.rows[0].hash;
};

// 更新密码
const updatePassword = async (newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE password SET hash = $1 WHERE id = 1', [hashedPassword]);
};

module.exports = { pool, checkAndCreateTables, getPasswordHash, updatePassword };
