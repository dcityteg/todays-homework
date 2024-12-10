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

// 创建密码表的 SQL 查询
const createPasswordTableQuery = `
    CREATE TABLE IF NOT EXISTS password (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL
    );
`;

// 创建用户表的 SQL 查询
const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,  // 存储用户的密码哈希
        role TEXT NOT NULL DEFAULT 'user'  // 'admin' 或 'user'
    );
`;

const checkAndCreateTables = async () => {
    try {
        // 创建作业表、密码表和用户表
        await pool.query(createHomeworkTableQuery);
        await pool.query(createPasswordTableQuery);
        await pool.query(createUsersTableQuery);

        // 确保密码表至少有一条记录
        await ensurePasswordRecordExists();

        // 确保用户表有 admin 账户
        await ensureAdminUserExists();

    } catch (err) {
        console.error('Error creating tables or adding missing columns:', err);
    }
};

// 确保密码表至少有一条记录
const ensurePasswordRecordExists = async () => {
    const result = await pool.query('SELECT * FROM password');
    if (result.rows.length === 0) {
        const defaultPassword = process.env.DEFAULT_PASSWORD || 'defaultpassword';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        await pool.query('INSERT INTO password (hash) VALUES ($1)', [hashedPassword]);
    }
};

// 确保用户表有 admin 账户
const ensureAdminUserExists = async () => {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (userCheck.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('114514', 10);
        await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['admin', hashedPassword, 'admin']);
    }
};

// 获取用户密码哈希
const getUserPassword = async (username) => {
    try {
        const result = await pool.query('SELECT password FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            return result.rows[0].password;  // 返回用户的密码哈希
        } else {
            throw new Error(`User '${username}' not found`);  // 确保找不到用户时抛出错误
        }
    } catch (err) {
        console.error('Error retrieving user password:', err);
        throw err;
    }
};

// 获取用户角色
const getUserRole = async (username) => {
    try {
        const result = await pool.query('SELECT role FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            return result.rows[0].role;
        } else {
            throw new Error(`User '${username}' not found`);
        }
    } catch (err) {
        console.error('Error retrieving user role:', err);
        throw err;
    }
};

// 更新密码
const updatePassword = async (newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE password SET hash = $1 WHERE id = 1', [hashedPassword]);
};

// 新建用户
const createUser = async (username, password, role) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *', [username, hashedPassword, role]);
    return result.rows[0];
};

// 删除用户
const deleteUser = async (username) => {
    await pool.query('DELETE FROM users WHERE username = $1', [username]);
};

// 用户验证函数
const validateUser = async (username, password) => {
    try {
        // 获取用户的密码哈希
        const storedHash = await getUserPassword(username);
        // 使用 bcrypt.compare 验证密码
        const isValid = await bcrypt.compare(password, storedHash);

        if (!isValid) {
            throw new Error('Invalid password');
        }

        return true;  // 密码验证成功
    } catch (error) {
        console.error('User validation failed:', error);
        throw new Error('Login failed');
    }
};

module.exports = { 
    pool, 
    checkAndCreateTables, 
    getPasswordHash, 
    updatePassword, 
    createUser, 
    deleteUser, 
    getUserRole, 
    getUserPassword,
    validateUser  // 导出 validateUser 函数
};
