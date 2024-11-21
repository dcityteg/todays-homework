const multer = require('multer');

// 使用内存存储方式配置 multer
const storage = multer.memoryStorage();

// 限制上传文件的大小和数量
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 最大文件大小 5MB
        files: 3,                 // 最多允许上传 3 个文件
    },
    fileFilter: (req, file, cb) => {
        // 限制文件类型，仅允许图片格式
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('仅支持上传图片文件'));
        }
        cb(null, true);
    },
});

// 导出 upload 实例
module.exports = upload;
