const ERROR_MESSAGES = require('../constant');

class Users {
    static async getUserById(id) {
        // 这里实现从数据库中根据ID获取用户
        // 示例返回一个用户对象
        return { id, name: "Jack", email: "jack@qq.com", role: "user", last_active_at: Date.now(), updated_at: Date.now(), created_at: Date.now(), api_key: 'sk-3bf509ee141340a09eccb4247ad410ec' };
    }

    static async getUserByApiKey(apiKey) {
        // 这里实现从数据库中根据API密钥获取用户
        // 示例返回一个用户对象
        return { id: "d611cc24-11c8-4935-88aa-e275607947f4", name: "Jack", email: "jack@qq.com", role: "admin", last_active_at: Date.now(), updated_at: Date.now(), created_at: Date.now(), api_key };
    }

    static async updateUserLastActiveById(id) {
        // 这里实现更新用户最后活跃时间
        // 示例中不进行实际操作
        console.log(`User with id ${id} last active time updated`);
    }
}

module.exports = Users;
