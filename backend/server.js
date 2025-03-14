const express = require('express');
const cors = require('cors');
const ollamaRoutes = require('./routes/ollama');
const app = express();
const config = require('./config');
const openaiRoutes = require('./routes/openai')
const { AppConfig } = config;

app.use(cors({
    origin: "*",
    credentials: true,
    methods: "*",
    allowedHeaders: "*"
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.state = {
    config: new AppConfig(),
};

app.state.config.ENABLE_MODEL_FILTER = config.ENABLE_MODEL_FILTER;
app.state.config.MODEL_FILTER_LIST = config.MODEL_FILTER_LIST;
app.state.config.OLLAMA_BASE_URLS = config.OLLAMA_BASE_URLS;
app.state.MODELS = {};

app.use('/api/v1/ollama', ollamaRoutes);
app.use('api/v1/chats', openaiRoutes);

app.listen(8080, () => {
    console.log('Server is running on http://localhost:3000');
});
