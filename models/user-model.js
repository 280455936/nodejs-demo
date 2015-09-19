var mongoose = require('mongoose');

// 定义数据格式
var UserSchema = new mongoose.Schema({
    name: String,
    pass: String
});

// 生成数据对象类
var UserModel = mongoose.model('User', UserSchema);

// 暴露model对象
module.exports = UserModel;