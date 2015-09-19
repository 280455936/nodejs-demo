// 引入相关模块
var main = require('./controllers/mainController.js');
var filter = require('./filter.js');
var user = require('./controllers/userController.js');

// 绑定app，定义路由
module.exports = function(app){

	app.get('/', main.login);
	app.get('/home', filter.authentication, main.home);

	app.get('/signup', main.signup);
	app.post('/doLogin', main.doLogin);
	app.post('/doSignup', main.doSignup);
	app.post('/logout', main.logout);
	app.get('/logout', main.logout);

	app.get('/about', main.about);
	app.get('/user/list', user.list);

};
