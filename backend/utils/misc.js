const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

function getGravatarUrl(email) {
    // 去除前后空格并将邮箱地址转换为小写
    const address = email.trim().toLowerCase();

    // 创建SHA256哈希对象
    const hashHex = crypto.createHash('sha256').update(address).digest('hex');

    // 获取实际图像URL
    console.log(`https://www.gravatar.com/avatar/${hashHex}?d=mp`);
    return `https://www.gravatar.com/avatar/${hashHex}?d=mp`;
}

function calculateSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

function calculateSha256String(string) {
    // 创建一个新的SHA-256哈希对象
    const sha256Hash = crypto.createHash('sha256');
    // 使用输入字符串的字节更新哈希对象
    sha256Hash.update(string, 'utf8');
    // 获取哈希的十六进制表示
    const hashedString = sha256Hash.digest('hex');
    return hashedString;
}

function validateEmailFormat(email) {
    if (email.endsWith('@localhost')) {
        return true;
    }

    const regex = /^[^@]+@[^@]+\.[^@]+$/;
    return regex.test(email);
}

function sanitizeFilename(fileName) {
    // 将文件名转换为小写
    let lowerCaseFileName = fileName.toLowerCase();

    // 使用正则表达式去除特殊字符
    let sanitizedFileName = lowerCaseFileName.replace(/[^\w\s]/g, '');

    // 将空格替换为连字符
    let finalFileName = sanitizedFileName.replace(/\s+/g, '-');

    return finalFileName;
}

function extractFoldersAfterDataDocs(filePath) {
    // 将路径转换为Path对象
    const parts = path.normalize(filePath).split(path.sep);

    // 找到'/data/docs'在路径中的索引
    try {
        const indexDataDocs = parts.indexOf('data') + 1;
        const indexDocs = parts.indexOf('docs', indexDataDocs) + 1;

        // 排除文件名并累积文件夹名称
        const tags = [];
        const folders = parts.slice(indexDocs, -1);
        folders.forEach((part, idx) => {
            tags.push(folders.slice(0, idx + 1).join(path.sep));
        });

        return tags;
    } catch (error) {
        return [];
    }
}

function parseDuration(duration) {
    if (duration === '-1' || duration === '0') {
        return null;
    }

    // 正则表达式查找数字和单位对
    const pattern = /(-?\d+(\.\d+)?)(ms|s|m|h|d|w)/g;
    const matches = [...duration.matchAll(pattern)];

    if (matches.length === 0) {
        throw new Error('Invalid duration string');
    }

    let totalDuration = new Map();

    matches.forEach((match) => {
        const number = parseFloat(match[1]);
        const unit = match[3];
        if (unit === 'ms') {
            totalDuration.set('milliseconds', (totalDuration.get('milliseconds') || 0) + number);
        } else if (unit === 's') {
            totalDuration.set('seconds', (totalDuration.get('seconds') || 0) + number);
        } else if (unit === 'm') {
            totalDuration.set('minutes', (totalDuration.get('minutes') || 0) + number);
        } else if (unit === 'h') {
            totalDuration.set('hours', (totalDuration.get('hours') || 0) + number);
        } else if (unit === 'd') {
            totalDuration.set('days', (totalDuration.get('days') || 0) + number);
        } else if (unit === 'w') {
            totalDuration.set('weeks', (totalDuration.get('weeks') || 0) + number);
        }
    });

    return new Date(0, 0, 0, 0, 0, 0, 0).setMilliseconds(
        (totalDuration.get('weeks') || 0) * 604800000 +
        (totalDuration.get('days') || 0) * 86400000 +
        (totalDuration.get('hours') || 0) * 3600000 +
        (totalDuration.get('minutes') || 0) * 60000 +
        (totalDuration.get('seconds') || 0) * 1000 +
        (totalDuration.get('milliseconds') || 0)
    ) - 0;
}
