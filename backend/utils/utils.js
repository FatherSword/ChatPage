const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const config = require('../config'); // 假设你的配置文件是config.js
const Users = require('../models/users'); // 假设你的用户模型文件是models/users.js

const SESSION_SECRET = config.WEBUI_SECRET_KEY;
const ALGORITHM = "HS256";

const ERROR_MESSAGES = {
    INVALID_TOKEN: "Invalid token",
    UNAUTHORIZED: "Unauthorized",
    ACCESS_PROHIBITED: "Access prohibited"
};

function verifyPassword(plainPassword, hashedPassword) {
    return hashedPassword ? bcrypt.compareSync(plainPassword, hashedPassword) : null;
}

function getPasswordHash(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync());
}

function createToken(data, expiresDelta = null) {
    const payload = {...data};
    if (expiresDelta) {
        const expire = new Date(Date.now() + expiresDelta * 1000);
        payload.exp = expire.getTime() / 1000;
    }
    return jwt.sign(payload, SESSION_SECRET, {algorithm: ALGORITHM});
}

function decodeToken(token) {
    try {
        return jwt.verify(token, SESSION_SECRET, {algorithms: [ALGORITHM]});
    } catch (e) {
        return null;
    }
}

function extractTokenFromAuthHeader(authHeader) {
    return authHeader.split('Bearer ')[1];
}

function createApiKey() {
    const key = uuid.v4().replace(/-/g, '');
    return `sk-${key}`;
}

async function getCurrentUser(authHeader) {
    const authCredentials = extractTokenFromAuthHeader(authHeader);

    // Authentication based on API key
    if (authCredentials.startsWith("sk-")) {
        return await getCurrentUserByApiKey(authCredentials);
    }

    // Decoding Token
    const data = decodeToken(authCredentials);

    if (data !== null && data.id) {
        const user = await Users.getUserById(data.id);
        if (user === null) {
            throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
        }
        return user;
    } else {
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
}

async function getCurrentUserByApiKey(apiKey) {
    const user = await Users.getUserByApiKey(apiKey);
    if (user === null) {
        throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
    } else {
        await Users.updateUserLastActiveById(user.id);
    }
    return user;
}

async function getVerifiedUser(req, res, next) {
    try {
        const user = await getCurrentUser(req.headers.authorization);
        if (!["user", "admin", "walletUser"].includes(user.role)) {
            throw new Error(ERROR_MESSAGES.ACCESS_PROHIBITED);
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({detail: error.message});
    }
}

async function getAdminUser(req, res, next) {
    try {
        const user = await getCurrentUser(req.headers.authorization);
        if (user.role !== "admin") {
            throw new Error(ERROR_MESSAGES.ACCESS_PROHIBITED);
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({detail: error.message});
    }
}

module.exports = {
    verifyPassword,
    getPasswordHash,
    createToken,
    decodeToken,
    createApiKey,
    getCurrentUser,
    getVerifiedUser,
    getAdminUser
};
