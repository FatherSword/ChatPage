require('dotenv').config({ path: '../.env' });
const logging = require('log4js');
const fs = require('fs');
const path = require('path');
const markdown = require('marked');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const YAML = require('yaml');
const crypto = require('crypto');
const ERROR_MESSAGES = require('./constant');

// Configure logging
logging.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const log = logging.getLogger('CONFIG');

const log_levels = ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"];
let GLOBAL_LOG_LEVEL = (process.env.GLOBAL_LOG_LEVEL || "").toUpperCase();

if (log_levels.includes(GLOBAL_LOG_LEVEL)) {
    log.level = GLOBAL_LOG_LEVEL; // 修改这里
} else {
    GLOBAL_LOG_LEVEL = "INFO";
}

log.info(`GLOBAL_LOG_LEVEL: ${GLOBAL_LOG_LEVEL}`);

const log_sources = [
    "AUDIO",
    "COMFYUI",
    "CONFIG",
    "DB",
    "IMAGES",
    "LITELLM",
    "MAIN",
    "MODELS",
    "OLLAMA",
    "OPENAI",
    "RAG",
    "WEBHOOK",
    "VIP",
    "faceCompare"
];

const SRC_LOG_LEVELS = {};

log_sources.forEach(source => {
    const log_env_var = source + "_LOG_LEVEL";
    SRC_LOG_LEVELS[source] = (process.env[log_env_var] || "").toUpperCase();
    if (!log_levels.includes(SRC_LOG_LEVELS[source])) {
        SRC_LOG_LEVELS[source] = GLOBAL_LOG_LEVEL;
    }
    log.info(`${log_env_var}: ${SRC_LOG_LEVELS[source]}`);
});

log.level = SRC_LOG_LEVELS['CONFIG']; // 修改这里

const WEBUI_NAME = process.env.WEBUI_NAME || "DeGPT";
if (WEBUI_NAME !== "DeGPT") {
    WEBUI_NAME += " (DeGPT)";
}

const WEBUI_URL = process.env.WEBUI_URL || "http://localhost:3000";

const WEBUI_FAVICON_URL = "https://openwebui.com/favicon.png";

// Load package.json
let PACKAGE_DATA = { version: "0.0.0" };
try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJsonStr = fs.readFileSync(packageJsonPath, 'utf8');
    PACKAGE_DATA = JSON.parse(packageJsonStr);
} catch (e) {
    log.error("Error reading package.json:", e);
}

const VERSION = PACKAGE_DATA.version;

// Function to parse each section
function parseSection(section) {
    const items = [];
    const lis = section.getElementsByTagName('li');
    for (let i = 0; i < lis.length; i++) {
        const li = lis[i];
        const rawHtml = li.outerHTML;
        const text = li.textContent.trim();
        const parts = text.split(': ', 1);
        const title = parts.length > 1 ? parts[0].trim() : "";
        const content = parts.length > 1 ? parts[1].trim() : text;

        items.push({ title, content, raw: rawHtml });
    }
    return items;
}

// Load CHANGELOG.md
let changelogContent = '';
try {
    const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
    changelogContent = fs.readFileSync(changelogPath, 'utf8');
} catch (e) {
    log.error("Error reading CHANGELOG.md:", e);
}

// Convert markdown content to HTML
const htmlContent = markdown.parse(changelogContent);

// Parse the HTML content
const dom = new JSDOM(htmlContent);
const soup = dom.window.document;

// Initialize JSON structure
const changelogJson = {};

// Iterate over each version
const versions = soup.getElementsByTagName('h2');
for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const versionNumber = version.textContent.trim().split(' - ')[0].slice(1, -1); // Remove brackets
    const date = version.textContent.trim().split(' - ')[1];

    const versionData = { date };

    // Find the next sibling that is a h3 tag (section title)
    let current = version.nextElementSibling;

    while (current && current.tagName !== 'H2') {
        if (current.tagName === 'H3') {
            const sectionTitle = current.textContent.toLowerCase(); // e.g., "added", "fixed"
            const sectionItems = parseSection(current.nextElementSibling);
            versionData[sectionTitle] = sectionItems;
        }
        // Move to the next element
        current = current.nextElementSibling;
    }

    changelogJson[versionNumber] = versionData;
}

const CHANGELOG = changelogJson;

const WEBUI_VERSION = process.env.WEBUI_VERSION || "v1.0.0-alpha.100";

const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "./data");
const FRONTEND_BUILD_DIR = path.resolve(__dirname, process.env.FRONTEND_BUILD_DIR || "../build");

let configData = {};
try {
    const configPath = path.join(DATA_DIR, 'config.json');
    configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    log.error("Error reading config.json:", e);
}

function saveConfig() {
    try {
        const configPath = path.join(DATA_DIR, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(configData, null, '\t'), 'utf8');
    } catch (e) {
        log.error("Error saving config.json:", e);
    }
}

function getConfigValue(configPath) {
    const pathParts = configPath.split('.');
    let curConfig = configData;
    for (const key of pathParts) {
        if (curConfig.hasOwnProperty(key)) {
            curConfig = curConfig[key];
        } else {
            return null;
        }
    }
    return curConfig;
}

class PersistentConfig {
    constructor(envName, configPath, envValue) {
        this.envName = envName;
        this.configPath = configPath;
        this.envValue = envValue;
        this.configValue = getConfigValue(configPath);
        if (this.configValue !== null) {
            log.info(`'${envName}' loaded from config.json`);
            this.value = this.configValue;
        } else {
            this.value = envValue;
        }
    }

    toString() {
        return String(this.value);
    }

    save() {
        if (this.envValue === this.value && this.configValue === this.value) { // 修改这里
            return;
        }
        log.info(`Saving '${this.envName}' to config.json`);
        const pathParts = this.configPath.split('.');
        let config = configData;
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!config.hasOwnProperty(pathParts[i])) {
                config[pathParts[i]] = {};
            }
            config = config[pathParts[i]];
        }
        config[pathParts[pathParts.length - 1]] = this.value;
        saveConfig();
        this.configValue = this.value;
    }
}

class AppConfig {
    constructor() {
        this._state = {};
    }

    set(key, value) {
        if (value instanceof PersistentConfig) {
            this._state[key] = value;
        } else {
            this._state[key].value = value;
            this._state[key].save();
        }
    }

    get(key) {
        return this._state[key].value;
    }
}

const WEBUI_AUTH = (process.env.WEBUI_AUTH || "true").toLowerCase() === "true";
const WEBUI_AUTH_TRUSTED_EMAIL_HEADER = process.env.WEBUI_AUTH_TRUSTED_EMAIL_HEADER;

const JWT_EXPIRES_IN = new PersistentConfig(
    "JWT_EXPIRES_IN", "auth.jwt_expiry", process.env.JWT_EXPIRES_IN || "7d"
);

const STATIC_DIR = path.resolve(__dirname, process.env.STATIC_DIR || "./static");

const frontendFavicon = path.join(FRONTEND_BUILD_DIR, 'favicon.png');
const staticFavicon = path.join(STATIC_DIR, 'favicon.png');

if (fs.existsSync(frontendFavicon)) {
    fs.copyFileSync(frontendFavicon, staticFavicon);
} else {
    log.warn(`Frontend favicon not found at ${frontendFavicon}`);
}

const CUSTOM_NAME = process.env.CUSTOM_NAME;

async function tempfunc(){
if (CUSTOM_NAME) {
    try {
        const response = await axios.get(`https://api.openwebui.com/api/v1/custom/${CUSTOM_NAME}`);
        const data = response.data;
        if (response.status === 200) {
            if (data.logo) {
                const url = data.logo.startsWith('/') ? `https://api.openwebui.com${data.logo}` : data.logo;

                const logoResponse = await axios.get(url, { responseType: 'stream' });
                logoResponse.data.pipe(fs.createWriteStream(staticFavicon));
            }

            WEBUI_NAME = data.name;
        }
    } catch (e) {
        log.error("Error fetching custom data:", e);
    }
}
}
tempfunc();

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CACHE_DIR = path.join(DATA_DIR, 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const DOCS_DIR = process.env.DOCS_DIR || path.join(DATA_DIR, 'docs');
fs.mkdirSync(DOCS_DIR, { recursive: true });

const LITELLM_CONFIG_PATH = path.join(DATA_DIR, 'litellm/config.yaml');

if (!fs.existsSync(LITELLM_CONFIG_PATH)) {
    log.info("Config file doesn't exist. Creating...");
    const configData = {
        general_settings: {},
        litellm_settings: {},
        model_list: [],
        router_settings: {},
    };

    fs.writeFileSync(LITELLM_CONFIG_PATH, YAML.stringify(configData, { indent: 2 }), 'utf8');
    log.info("Config file created successfully.");
}

let OLLAMA_API_BASE_URL = process.env.OLLAMA_API_BASE_URL || "http://localhost:11434/api";
let OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "";
const K8S_FLAG = process.env.K8S_FLAG || "";
const USE_OLLAMA_DOCKER = (process.env.USE_OLLAMA_DOCKER || "false").toLowerCase() === "true";

if (OLLAMA_BASE_URL === "" && OLLAMA_API_BASE_URL !== "") {
    OLLAMA_BASE_URL = OLLAMA_API_BASE_URL.endsWith("/api") ? OLLAMA_API_BASE_URL.slice(0, -4) : OLLAMA_API_BASE_URL;
}

if (process.env.ENV === "prod") {
    if (OLLAMA_BASE_URL === "/ollama" && !K8S_FLAG) {
        OLLAMA_BASE_URL = USE_OLLAMA_DOCKER ? "http://localhost:11434" : "http://host.docker.internal:11434";
    } else if (K8S_FLAG) {
        OLLAMA_BASE_URL = "http://ollama-service.open-webui.svc.cluster.local:11434";
    }
}

let OLLAMA_BASE_URLS = process.env.OLLAMA_BASE_URLS || OLLAMA_BASE_URL;
OLLAMA_BASE_URLS = OLLAMA_BASE_URLS.split(';').map(url => url.trim());

const OLLAMA_BASE_URLS_CONFIG = new PersistentConfig(
    "OLLAMA_BASE_URLS", "ollama.base_urls", OLLAMA_BASE_URLS
);

const ENABLE_OPENAI_API = new PersistentConfig(
    "ENABLE_OPENAI_API",
    "openai.enable",
    (process.env.ENABLE_OPENAI_API || "True").toLowerCase() === "true"
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";

const OPENAI_API_KEYS_ENV = process.env.OPENAI_API_KEYS || OPENAI_API_KEY;
const OPENAI_API_KEYS = OPENAI_API_KEYS_ENV.split(';').map(key => key.trim());

const OPENAI_API_KEYS_CONFIG = new PersistentConfig(
    "OPENAI_API_KEYS", "openai.api_keys", OPENAI_API_KEYS
);

const OPENAI_API_BASE_URLS_ENV = process.env.OPENAI_API_BASE_URLS || OPENAI_API_BASE_URL;
const OPENAI_API_BASE_URLS = OPENAI_API_BASE_URLS_ENV.split(';').map(url => url.trim() || "https://api.openai.com/v1");

const OPENAI_API_BASE_URLS_CONFIG = new PersistentConfig(
    "OPENAI_API_BASE_URLS", "openai.api_base_urls", OPENAI_API_BASE_URLS
);

const OPENAI_API_KEY_CONFIG = OPENAI_API_KEYS_CONFIG.value[OPENAI_API_BASE_URLS_CONFIG.value.indexOf("https://api.openai.com/v1")] || "";

const ENABLE_SIGNUP = new PersistentConfig(
    "ENABLE_SIGNUP",
    "ui.enable_signup",
    WEBUI_AUTH && (process.env.ENABLE_SIGNUP || "True").toLowerCase() === "true"
);

const DEFAULT_MODELS = new PersistentConfig(
    "DEFAULT_MODELS", "ui.default_models", process.env.DEFAULT_MODELS || null
);

const DEFAULT_PROMPT_SUGGESTIONS = new PersistentConfig(
    "DEFAULT_PROMPT_SUGGESTIONS",
    "ui.prompt_suggestions",
    [
        {
            title: ["Help me study", "vocabulary for a college entrance exam"],
            content: "Help me study vocabulary: write a sentence for me to fill in the blank, and I'll try to pick the correct option.",
        },
        {
            title: ["Give me ideas", "for what to do with my kids' art"],
            content: "What are 5 creative things I could do with my kids' art? I don't want to throw them away, but it's also so much clutter.",
        },
        {
            title: ["Tell me a fun fact", "about the Roman Empire"],
            content: "Tell me a random fun fact about the Roman Empire",
        },
        {
            title: ["Show me a code snippet", "of a website's sticky header"],
            content: "Show me a code snippet of a website's sticky header in CSS and JavaScript.",
        },
        {
            title: ["Explain options trading", "if I'm familiar with buying and selling stocks"],
            content: "Explain options trading in simple terms if I'm familiar with buying and selling stocks.",
        },
        {
            title: ["Overcome procrastination", "give me tips"],
            content: "Could you start by asking me about instances when I procrastinate the most and then give me some suggestions to overcome it?",
        },
    ]
);

const DEFAULT_USER_ROLE = new PersistentConfig(
    "DEFAULT_USER_ROLE",
    "ui.default_user_role",
    process.env.DEFAULT_USER_ROLE || "pending"
);

const USER_PERMISSIONS_CHAT_DELETION = (process.env.USER_PERMISSIONS_CHAT_DELETION || "true").toLowerCase() === "true";

const USER_PERMISSIONS = new PersistentConfig(
    "USER_PERMISSIONS",
    "ui.user_permissions",
    { chat: { deletion: USER_PERMISSIONS_CHAT_DELETION } }
);

const ENABLE_MODEL_FILTER = new PersistentConfig(
    "ENABLE_MODEL_FILTER",
    "model_filter.enable",
    (process.env.ENABLE_MODEL_FILTER || "false").toLowerCase() === "true"
);

const MODEL_FILTER_LIST_ENV = process.env.MODEL_FILTER_LIST || "";
const MODEL_FILTER_LIST = MODEL_FILTER_LIST_ENV.split(';').map(model => model.trim());

const MODEL_FILTER_LIST_CONFIG = new PersistentConfig(
    "MODEL_FILTER_LIST",
    "model_filter.list",
    MODEL_FILTER_LIST
);

const WEBHOOK_URL = new PersistentConfig(
    "WEBHOOK_URL", "webhook_url", process.env.WEBHOOK_URL || ""
);

const ENABLE_ADMIN_EXPORT = (process.env.ENABLE_ADMIN_EXPORT || "true").toLowerCase() === "true";

const WEBUI_SECRET_KEY = process.env.WEBUI_SECRET_KEY || process.env.WEBUI_JWT_SECRET_KEY || "t0p-s3cr3t";

if (WEBUI_AUTH && WEBUI_SECRET_KEY === "") {
    throw new Error(ERROR_MESSAGES.ENV_VAR_NOT_FOUND);
}

const CHROMA_DATA_PATH = path.join(DATA_DIR, 'vector_db');
const CHROMA_TENANT = process.env.CHROMA_TENANT || "default";
const CHROMA_DATABASE = process.env.CHROMA_DATABASE || "default";
const CHROMA_HTTP_HOST = process.env.CHROMA_HTTP_HOST || "";
const CHROMA_HTTP_PORT = parseInt(process.env.CHROMA_HTTP_PORT || "8000", 10);
const CHROMA_HTTP_HEADERS_ENV = process.env.CHROMA_HTTP_HEADERS || "";

const CHROMA_HTTP_HEADERS = CHROMA_HTTP_HEADERS_ENV ? Object.fromEntries(CHROMA_HTTP_HEADERS_ENV.split(',').map(pair => pair.split('='))) : null;
const CHROMA_HTTP_SSL = (process.env.CHROMA_HTTP_SSL || "false").toLowerCase() === "true";

const RAG_TOP_K = new PersistentConfig(
    "RAG_TOP_K", "rag.top_k", parseInt(process.env.RAG_TOP_K || "5", 10)
);

const RAG_RELEVANCE_THRESHOLD = new PersistentConfig(
    "RAG_RELEVANCE_THRESHOLD",
    "rag.relevance_threshold",
    parseFloat(process.env.RAG_RELEVANCE_THRESHOLD || "0.0")
);

const ENABLE_RAG_HYBRID_SEARCH = new PersistentConfig(
    "ENABLE_RAG_HYBRID_SEARCH",
    "rag.enable_hybrid_search",
    (process.env.ENABLE_RAG_HYBRID_SEARCH || "").toLowerCase() === "true"
);

const ENABLE_RAG_WEB_LOADER_SSL_VERIFICATION = new PersistentConfig(
    "ENABLE_RAG_WEB_LOADER_SSL_VERIFICATION",
    "rag.enable_web_loader_ssl_verification",
    (process.env.ENABLE_RAG_WEB_LOADER_SSL_VERIFICATION || "true").toLowerCase() === "true"
);

const RAG_EMBEDDING_ENGINE = new PersistentConfig(
    "RAG_EMBEDDING_ENGINE",
    "rag.embedding_engine",
    process.env.RAG_EMBEDDING_ENGINE || ""
);

const PDF_EXTRACT_IMAGES = new PersistentConfig(
    "PDF_EXTRACT_IMAGES",
    "rag.pdf_extract_images",
    (process.env.PDF_EXTRACT_IMAGES || "false").toLowerCase() === "true"
);

const RAG_EMBEDDING_MODEL = new PersistentConfig(
    "RAG_EMBEDDING_MODEL",
    "rag.embedding_model",
    process.env.RAG_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2"
);
log.info(`Embedding model set: ${RAG_EMBEDDING_MODEL.value}`);

const RAG_EMBEDDING_MODEL_AUTO_UPDATE = (process.env.RAG_EMBEDDING_MODEL_AUTO_UPDATE || "").toLowerCase() === "true";
const RAG_EMBEDDING_MODEL_TRUST_REMOTE_CODE = (process.env.RAG_EMBEDDING_MODEL_TRUST_REMOTE_CODE || "").toLowerCase() === "true";

const RAG_RERANKING_MODEL = new PersistentConfig(
    "RAG_RERANKING_MODEL",
    "rag.reranking_model",
    process.env.RAG_RERANKING_MODEL || ""
);
if (RAG_RERANKING_MODEL.value !== "") {
    log.info(`Reranking model set: ${RAG_RERANKING_MODEL.value}`);
}

const RAG_RERANKING_MODEL_AUTO_UPDATE = (process.env.RAG_RERANKING_MODEL_AUTO_UPDATE || "").toLowerCase() === "true";
const RAG_RERANKING_MODEL_TRUST_REMOTE_CODE = (process.env.RAG_RERANKING_MODEL_TRUST_REMOTE_CODE || "").toLowerCase() === "true";

const USE_CUDA_DOCKER = (process.env.USE_CUDA_DOCKER || "false").toLowerCase() === "true";
const DEVICE_TYPE = USE_CUDA_DOCKER ? "cuda" : "cpu";

const CHUNK_SIZE = new PersistentConfig(
    "CHUNK_SIZE", "rag.chunk_size", parseInt(process.env.CHUNK_SIZE || "1500", 10)
);

const CHUNK_OVERLAP = new PersistentConfig(
    "CHUNK_OVERLAP",
    "rag.chunk_overlap",
    parseInt(process.env.CHUNK_OVERLAP || "100", 10)
);

const DEFAULT_RAG_TEMPLATE = `Use the following context as your learned knowledge, inside <context></context> XML tags.
<context>
    [context]
</context>

When answer to user:
- If you don't know, just say that you don't know.
- If you don't know when you are not sure, ask for clarification.
Avoid mentioning that you obtained the information from the context.
And answer according to the language of the user's question.

Given the context information, answer the query.
Query: [query]`;

const RAG_TEMPLATE = new PersistentConfig(
    "RAG_TEMPLATE",
    "rag.template",
    process.env.RAG_TEMPLATE || DEFAULT_RAG_TEMPLATE
);

const RAG_OPENAI_API_BASE_URL_ENV = process.env.RAG_OPENAI_API_BASE_URL || OPENAI_API_BASE_URL;
const RAG_OPENAI_API_BASE_URL = new PersistentConfig(
    "RAG_OPENAI_API_BASE_URL",
    "rag.openai_api_base_url",
    RAG_OPENAI_API_BASE_URL_ENV
);

const RAG_OPENAI_API_KEY_ENV = process.env.RAG_OPENAI_API_KEY || OPENAI_API_KEY;
const RAG_OPENAI_API_KEY = new PersistentConfig(
    "RAG_OPENAI_API_KEY",
    "rag.openai_api_key",
    RAG_OPENAI_API_KEY_ENV
);

const ENABLE_RAG_LOCAL_WEB_FETCH = (process.env.ENABLE_RAG_LOCAL_WEB_FETCH || "false").toLowerCase() === "true";

const YOUTUBE_LOADER_LANGUAGE_ENV = process.env.YOUTUBE_LOADER_LANGUAGE || "en";
const YOUTUBE_LOADER_LANGUAGE = new PersistentConfig(
    "YOUTUBE_LOADER_LANGUAGE",
    "rag.youtube_loader_language",
    YOUTUBE_LOADER_LANGUAGE_ENV.split(',')
);

const WHISPER_MODEL = process.env.WHISPER_MODEL || "base";
const WHISPER_MODEL_DIR = process.env.WHISPER_MODEL_DIR || path.join(CACHE_DIR, 'whisper/models');
const WHISPER_MODEL_AUTO_UPDATE = (process.env.WHISPER_MODEL_AUTO_UPDATE || "").toLowerCase() === "true";

const IMAGE_GENERATION_ENGINE = new PersistentConfig(
    "IMAGE_GENERATION_ENGINE",
    "image_generation.engine",
    process.env.IMAGE_GENERATION_ENGINE || ""
);

const ENABLE_IMAGE_GENERATION = new PersistentConfig(
    "ENABLE_IMAGE_GENERATION",
    "image_generation.enable",
    (process.env.ENABLE_IMAGE_GENERATION || "").toLowerCase() === "true"
);

const AUTOMATIC1111_BASE_URL = new PersistentConfig(
    "AUTOMATIC1111_BASE_URL",
    "image_generation.automatic1111.base_url",
    process.env.AUTOMATIC1111_BASE_URL || ""
);

const COMFYUI_BASE_URL = new PersistentConfig(
    "COMFYUI_BASE_URL",
    "image_generation.comfyui.base_url",
    process.env.COMFYUI_BASE_URL || ""
);

const IMAGES_OPENAI_API_BASE_URL_ENV = process.env.IMAGES_OPENAI_API_BASE_URL || OPENAI_API_BASE_URL;
const IMAGES_OPENAI_API_BASE_URL = new PersistentConfig(
    "IMAGES_OPENAI_API_BASE_URL",
    "image_generation.openai.api_base_url",
    IMAGES_OPENAI_API_BASE_URL_ENV
);

const IMAGES_OPENAI_API_KEY_ENV = process.env.IMAGES_OPENAI_API_KEY || OPENAI_API_KEY;
const IMAGES_OPENAI_API_KEY = new PersistentConfig(
    "IMAGES_OPENAI_API_KEY",
    "image_generation.openai.api_key",
    IMAGES_OPENAI_API_KEY_ENV
);

const IMAGE_SIZE = new PersistentConfig(
    "IMAGE_SIZE", "image_generation.size", process.env.IMAGE_SIZE || "512x512"
);

const IMAGE_STEPS = new PersistentConfig(
    "IMAGE_STEPS", "image_generation.steps", parseInt(process.env.IMAGE_STEPS || "50", 10)
);

const IMAGE_GENERATION_MODEL = new PersistentConfig(
    "IMAGE_GENERATION_MODEL",
    "image_generation.model",
    process.env.IMAGE_GENERATION_MODEL || ""
);

const AUDIO_OPENAI_API_BASE_URL_ENV = process.env.AUDIO_OPENAI_API_BASE_URL || OPENAI_API_BASE_URL;
const AUDIO_OPENAI_API_BASE_URL = new PersistentConfig(
    "AUDIO_OPENAI_API_BASE_URL",
    "audio.openai.api_base_url",
    AUDIO_OPENAI_API_BASE_URL_ENV
);

const AUDIO_OPENAI_API_KEY_ENV = process.env.AUDIO_OPENAI_API_KEY || OPENAI_API_KEY;
const AUDIO_OPENAI_API_KEY = new PersistentConfig(
    "AUDIO_OPENAI_API_KEY",
    "audio.openai.api_key",
    AUDIO_OPENAI_API_KEY_ENV
);

const AUDIO_OPENAI_API_MODEL_ENV = process.env.AUDIO_OPENAI_API_MODEL || "tts-1";
const AUDIO_OPENAI_API_MODEL = new PersistentConfig(
    "AUDIO_OPENAI_API_MODEL",
    "audio.openai.api_model",
    AUDIO_OPENAI_API_MODEL_ENV
);

const AUDIO_OPENAI_API_VOICE_ENV = process.env.AUDIO_OPENAI_API_VOICE || "alloy";
const AUDIO_OPENAI_API_VOICE = new PersistentConfig(
    "AUDIO_OPENAI_API_VOICE",
    "audio.openai.api_voice",
    AUDIO_OPENAI_API_VOICE_ENV
);

const ENABLE_LITELLM = (process.env.ENABLE_LITELLM || "true").toLowerCase() === "true";

const LITELLM_PROXY_PORT = parseInt(process.env.LITELLM_PROXY_PORT || "14365", 10);
if (LITELLM_PROXY_PORT < 0 || LITELLM_PROXY_PORT > 65535) {
    throw new Error("Invalid port number for LITELLM_PROXY_PORT");
}

const LITELLM_PROXY_HOST = process.env.LITELLM_PROXY_HOST || "127.0.0.1";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:*****@172.31.50.205:9875/webui_db";

const REDIS_HOST = process.env.REDIS_HOST || 'gpt-redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || 6379, 10);
const REDIS_DB = parseInt(process.env.REDIS_DB || 8, 10);
const REDIS_PWD = process.env.REDIS_PWD || '*******';

const FACE_DB = process.env.FACE_DB || 'online_face';
const FACE_URL = process.env.FACE_URL || 'https://www.degpt.ai/userVerifying';

module.exports = {
    WEBUI_NAME,
    WEBUI_URL,
    WEBUI_FAVICON_URL,
    VERSION,
    CHANGELOG,
    WEBUI_VERSION,
    DATA_DIR,
    FRONTEND_BUILD_DIR,
    WEBUI_AUTH,
    WEBUI_AUTH_TRUSTED_EMAIL_HEADER,
    JWT_EXPIRES_IN,
    STATIC_DIR,
    CUSTOM_NAME,
    UPLOAD_DIR,
    CACHE_DIR,
    DOCS_DIR,
    OLLAMA_BASE_URLS_CONFIG,
    ENABLE_OPENAI_API,
    OPENAI_API_KEY_CONFIG,
    ENABLE_SIGNUP,
    DEFAULT_MODELS,
    DEFAULT_PROMPT_SUGGESTIONS,
    DEFAULT_USER_ROLE,
    USER_PERMISSIONS,
    ENABLE_MODEL_FILTER,
    MODEL_FILTER_LIST_CONFIG,
    WEBHOOK_URL,
    ENABLE_ADMIN_EXPORT,
    WEBUI_SECRET_KEY,
    RAG_TOP_K,
    RAG_RELEVANCE_THRESHOLD,
    ENABLE_RAG_HYBRID_SEARCH,
    ENABLE_RAG_WEB_LOADER_SSL_VERIFICATION,
    RAG_EMBEDDING_ENGINE,
    PDF_EXTRACT_IMAGES,
    RAG_EMBEDDING_MODEL,
    RAG_EMBEDDING_MODEL_AUTO_UPDATE,
    RAG_EMBEDDING_MODEL_TRUST_REMOTE_CODE,
    RAG_RERANKING_MODEL,
    RAG_RERANKING_MODEL_AUTO_UPDATE,
    RAG_RERANKING_MODEL_TRUST_REMOTE_CODE,
    DEVICE_TYPE,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    RAG_TEMPLATE,
    RAG_OPENAI_API_BASE_URL,
    RAG_OPENAI_API_KEY,
    ENABLE_RAG_LOCAL_WEB_FETCH,
    YOUTUBE_LOADER_LANGUAGE,
    IMAGE_GENERATION_ENGINE,
    ENABLE_IMAGE_GENERATION,
    AUTOMATIC1111_BASE_URL,
    COMFYUI_BASE_URL,
    IMAGES_OPENAI_API_BASE_URL,
    IMAGES_OPENAI_API_KEY,
    IMAGE_SIZE,
    IMAGE_STEPS,
    IMAGE_GENERATION_MODEL,
    AUDIO_OPENAI_API_BASE_URL,
    AUDIO_OPENAI_API_KEY,
    AUDIO_OPENAI_API_MODEL,
    AUDIO_OPENAI_API_VOICE,
    ENABLE_LITELLM,
    LITELLM_PROXY_PORT,
    LITELLM_PROXY_HOST,
    DATABASE_URL,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_DB,
    REDIS_PWD,
    FACE_DB,
    FACE_URL,
};
