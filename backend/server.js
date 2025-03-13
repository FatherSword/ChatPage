const express = require('express'); // 引入express模块
const app = express(); // 创建express应用实例

// 定义一个端口号
const PORT = 8080;

// 定义一个路由，当用户访问根路径（'/'）时，返回特定格式的JSON数据
app.get('/api/v1/chats/new', (req, res) => {
    res.json({
        message: 'Hello, this is your Node.js backend!'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
