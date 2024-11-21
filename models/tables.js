const { pool } = require('./db');
const bcrypt = require('bcrypt');

const checkAndCreateTables = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS homework (id SERIAL PRIMARY KEY, content TEXT NOT NULL CHECK (length(content) > 0));`,
        `CREATE TABLE IF NOT EXISTS password (id SERIAL PRIMARY KEY, hash TEXT NOT NULL);`,
    ];

    try {
        for (const query of queries) {
            await pool.query(query);
        }

        const result = await pool.query('SELECT * FROM password');
        if (result.rows.length === 0) {
            const defaultPassword = 'defaultpassword';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await pool.query('INSERT INTO password (hash) VALUES ($1)', [hashedPassword]);
            console.log(`默认密码设置为: ${defaultPassword}`);
        }
    } catch (err) {
        console.error('创建表格时出错:', err);
    }
};

module.exports = { checkAndCreateTables };
