const express = require('express');
const axios = require('axios');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { get_admin_user, get_current_user, get_verified_user } = require('../utils/utils');
const { ERROR_MESSAGES } = require('../constants');
const { calculate_sha256 } = require('../utils/misc');

const REQUEST_POOL = [];

const fetchUrl = async (url) => {
    try {
        const response = await axios.get(url, { timeout: 5000 });
        return response.data;
    } catch (error) {
        console.error(`Connection error: ${error.message}`);
        return null;
    }
};

const mergeModelsLists = (modelLists) => {
    const mergedModels = {};

    modelLists.forEach((modelList, idx) => {
        if (modelList !== null) {
            modelList.forEach(model => {
                const digest = model.digest;
                if (!mergedModels[digest]) {
                    model.urls = [idx];
                    mergedModels[digest] = model;
                } else {
                    mergedModels[digest].urls.push(idx);
                }
            });
        }
    });

    return Object.values(mergedModels);
};

const getAllModels = async () => {
    console.info('get_all_models()');
    const tasks = app.state.config.OLLAMA_BASE_URLS.map(url => fetchUrl(`${url}/api/tags`));
    const responses = await Promise.all(tasks);

    const models = {
        models: mergeModelsLists(
            responses.map(response => response?.models || null)
        )
    };

    app.state.MODELS = Object.fromEntries(models.models.map(model => [model.model, model]));

    return models;
};

router.use(async (req, res, next) => {
    if (Object.keys(app.state.MODELS).length === 0) {
        await getAllModels();
    }
    next();
});

router.get('/', (req, res) => {
    res.json({ status: true });
});

router.get('/urls', get_admin_user, (req, res) => {
    res.json({ OLLAMA_BASE_URLS: app.state.config.OLLAMA_BASE_URLS });
});

router.post('/urls/update', get_admin_user, async (req, res) => {
    const { urls } = req.body;
    app.state.config.OLLAMA_BASE_URLS = urls;
    console.info(`app.state.config.OLLAMA_BASE_URLS: ${app.state.config.OLLAMA_BASE_URLS}`);
    res.json({ OLLAMA_BASE_URLS: app.state.config.OLLAMA_BASE_URLS });
});

router.get('/cancel/:request_id', get_current_user, (req, res) => {
    const { request_id } = req.params;
    if (req.user) {
        const index = REQUEST_POOL.indexOf(request_id);
        if (index !== -1) {
            REQUEST_POOL.splice(index, 1);
        }
        res.json(true);
    } else {
        res.status(401).json({ detail: ERROR_MESSAGES.ACCESS_PROHIBITED });
    }
});

// Other routes will be added here

module.exports = router;
