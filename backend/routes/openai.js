const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const { AppConfig, SRC_LOG_LEVELS, ENABLE_OPENAI_API, OPENAI_API_BASE_URLS, OPENAI_API_KEYS, CACHE_DIR, ENABLE_MODEL_FILTER, MODEL_FILTER_LIST } = require('./config');
const { decodeToken, getCurrentUser, getVerifiedUser, getAdminUser } = require('./utils/utils');
const { ERROR_MESSAGES } = require('./constants');

const log = require('winston').createLogger({
    level: SRC_LOG_LEVELS.OPENAI,
    format: require('winston').format.json(),
    transports: [
        new require('winston').transports.Console()
    ]
});

let config = new AppConfig();
config.ENABLE_OPENAI_API = ENABLE_OPENAI_API;
config.OPENAI_API_BASE_URLS = OPENAI_API_BASE_URLS;
config.OPENAI_API_KEYS = OPENAI_API_KEYS;
config.ENABLE_MODEL_FILTER = ENABLE_MODEL_FILTER;
config.MODEL_FILTER_LIST = MODEL_FILTER_LIST;

let models = {};

router.use(async (req, res, next) => {
    if (Object.keys(models).length === 0) {
        await getAllModels();
    }
    next();
});

router.get('/config', getAdminUser, async (req, res) => {
    res.json({ ENABLE_OPENAI_API: config.ENABLE_OPENAI_API });
});

router.post('/config/update', getAdminUser, async (req, res) => {
    const { enable_openai_api } = req.body;
    config.ENABLE_OPENAI_API = enable_openai_api;
    res.json({ ENABLE_OPENAI_API: config.ENABLE_OPENAI_API });
});

router.get('/urls', getAdminUser, async (req, res) => {
    res.json({ OPENAI_API_BASE_URLS: config.OPENAI_API_BASE_URLS });
});

router.post('/urls/update', getAdminUser, async (req, res) => {
    const { urls } = req.body;
    config.OPENAI_API_BASE_URLS = urls;
    await getAllModels();
    res.json({ OPENAI_API_BASE_URLS: config.OPENAI_API_BASE_URLS });
});

router.get('/keys', getAdminUser, async (req, res) => {
    res.json({ OPENAI_API_KEYS: config.OPENAI_API_KEYS });
});

router.post('/keys/update', getAdminUser, async (req, res) => {
    const { keys } = req.body;
    config.OPENAI_API_KEYS = keys;
    res.json({ OPENAI_API_KEYS: config.OPENAI_API_KEYS });
});

router.post('/audio/speech', getVerifiedUser, async (req, res) => {
    const body = req.body;
    const name = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

    const SPEECH_CACHE_DIR = path.join(CACHE_DIR, './audio/speech/');
    await mkdirAsync(SPEECH_CACHE_DIR, { recursive: true });
    const filePath = path.join(SPEECH_CACHE_DIR, `${name}.mp3`);
    const fileBodyPath = path.join(SPEECH_CACHE_DIR, `${name}.json`);

    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    const idx = config.OPENAI_API_BASE_URLS.indexOf("https://api.openai.com/v1");
    if (idx === -1) {
        return res.status(401).json({ detail: ERROR_MESSAGES.OPENAI_NOT_FOUND });
    }

    const headers = {
        'Authorization': `Bearer ${config.OPENAI_API_KEYS[idx]}`,
        'Content-Type': 'application/json'
    };

    if (config.OPENAI_API_BASE_URLS[idx].includes("openrouter.ai")) {
        headers['HTTP-Referer'] = "https://openwebui.com/";
        headers['X-Title'] = "DeGPT";
    }

    try {
        const response = await axios.post(`${config.OPENAI_API_BASE_URLS[idx]}audio/speech`, body, { headers, responseType: 'stream' });
        response.data.pipe(fs.createWriteStream(filePath));

        await writeFileAsync(fileBodyPath, JSON.stringify(body));
        res.sendFile(filePath);
    } catch (error) {
        log.error(error);
        let errorDetail = "DeGPT: Server Connection Error";
        if (error.response) {
            if (error.response.data.error) {
                errorDetail = `External: ${error.response.data.error}`;
            }
            res.status(error.response.status).json({ detail: errorDetail });
        } else {
            res.status(500).json({ detail: `External: ${error.message}` });
        }
    }
});

async function fetchUrl(url, key) {
    try {
        if (key !== "") {
            const headers = { 'Authorization': `Bearer ${key}` };
            const response = await axios.get(url, { headers });
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        log.error(`Connection error: ${error.message}`);
        return null;
    }
}

function mergeModelsLists(modelLists) {
    log.info(`merge_models_lists ${JSON.stringify(modelLists)}`);
    let mergedList = [];

    for (let idx = 0; idx < modelLists.length; idx++) {
        const models = modelLists[idx];
        if (models && !models.error && (!models.includes("api.openai.com") || models.some(model => model.id.includes("gpt")))) {
            mergedList = mergedList.concat(models.map(model => ({ ...model, urlIdx: idx })));
        }
    }

    return mergedList;
}

async function getAllModels() {
    log.info('get_all_models()');

    if (config.OPENAI_API_KEYS.length === 1 && config.OPENAI_API_KEYS[0] === "" || !config.ENABLE_OPENAI_API) {
        models = { data: [] };
    } else {
        const tasks = config.OPENAI_API_BASE_URLS.map((url, idx) => fetchUrl(`${url}/models`, config.OPENAI_API_KEYS[idx]));
        const responses = await Promise.all(tasks);
        log.info(`get_all_models:responses() ${JSON.stringify(responses)}`);

        models = {
            data: mergeModelsLists(responses.map(response => response && response.data ? response.data : (Array.isArray(response) ? response : null)))
        };

        log.info(`models: ${JSON.stringify(models)}`);
        models = Object.fromEntries(models.data.map(model => [model.id, model]));
    }

    return models;
}

router.get('/models', getCurrentUser, async (req, res) => {
    const urlIdx = req.query.url_idx;
    if (!urlIdx) {
        models = await getAllModels();
        if (config.ENABLE_MODEL_FILTER && req.user.role === "user") {
            models.data = models.data.filter(model => config.MODEL_FILTER_LIST.includes(model.id));
        }
        res.json(models);
    } else {
        const url = config.OPENAI_API_BASE_URLS[urlIdx];
        try {
            const response = await axios.get(`${url}/models`);
            let responseData = response.data;
            if (url.includes("api.openai.com")) {
                responseData.data = responseData.data.filter(model => model.id.includes("gpt"));
            }
            res.json(responseData);
        } catch (error) {
            log.error(error);
            let errorDetail = "DeGPT: Server Connection Error";
            if (error.response && error.response.data && error.response.data.error) {
                errorDetail = `External: ${error.response.data.error}`;
            }
            res.status(error.response ? error.response.status : 500).json({ detail: errorDetail });
        }
    }
});

router.all('/:path', getVerifiedUser, async (req, res) => {
    let idx = 0;
    let body = req.body;

    if (body.model) {
        idx = models[body.model].urlIdx;
        if (body.model === "gpt-4-vision-preview" && !body.max_tokens) {
            body.max_tokens = 4000;
            log.debug("Modified body:", body);
        }
        if (body.num_ctx) {
            delete body.num_ctx;
            log.debug("Modified body after removing num_ctx:", body);
        }
    }

    const url = config.OPENAI_API_BASE_URLS[idx];
    const key = config.OPENAI_API_KEYS[idx];
    const targetUrl = `${url}/${req.params.path}`;

    if (key === "") {
        return res.status(401).json({ detail: ERROR_MESSAGES.API_KEY_NOT_FOUND });
    }

    const headers = {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: body,
            headers: headers,
            responseType: req.get('Content-Type') === 'text/event-stream' ? 'stream' : 'json'
        });

        if (response.data instanceof require('stream').Readable) {
            response.data.pipe(res);
        } else {
            res.json(response.data);
        }
    } catch (error) {
        log.error(error);
        let errorDetail = "DeGPT: Server Connection Error";
        if (error.response && error.response.data && error.response.data.error) {
            errorDetail = `External: ${error.response.data.error.message || error.response.data.error}`;
        }
        res.status(error.response ? error.response.status : 500).json({ detail: errorDetail });
    }
});

module.exports = router;
