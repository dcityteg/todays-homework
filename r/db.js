const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

// 创建所需的表，并添加 missing 列
const checkAndCreateTables = async () => {
    // 创建作业表的 SQL 查询
    const createHomeworkTableQuery = `
        CREATE TABLE IF NOT EXISTS homework (
            id SERIAL PRIMARY KEY,
            content TEXT NOT NULL CHECK (length(content) > 0),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    // 创建密码表的 SQL 查询
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
            const defaultPassword = process.env.DEFAULT_PASSWORD || 'defaultpassword';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await pool.query('INSERT INTO password (hash) VALUES ($1)', [hashedPassword]);
        }

        // 检查 homework 表是否存在 updated_at 列
        const checkUpdatedAtColumnQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'homework' AND column_name = 'updated_at';
        `;

        const columnCheckResult = await pool.query(checkUpdatedAtColumnQuery);

        // 如果 updated_at 列不存在，则添加它
        if (columnCheckResult.rows.length === 0) {
            const addUpdatedAtColumnQuery = `
                ALTER TABLE homework
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            `;
            await pool.query(addUpdatedAtColumnQuery);
            console.log('Added missing "updated_at" column to homework table.');
        } else {
            console.log('Column "updated_at" already exists in homework table.');
        }

    } catch (err) {
        console.error('Error creating tables or adding missing columns:', err);
    }
};

module.exports = { pool, checkAndCreateTables };
