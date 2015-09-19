var fortune = require('../lib/fortune.js');
var UserModel = require('../models/user-model.js');

// 登录页面
exports.login = function(req, res){
	res.render('login');
};

// 登录功能实现
exports.doLogin = function(req, res){

    var queryUser = req.body.user;
    if(!queryUser.name || !queryUser.pass) {
		if(req.xhr) return res.json({ error: '用户名密码未成功输入.' });
		req.session.flash = {
			type: 'danger',
			intro: '账号信息错误',
			message: '用户名密码未成功输入.',
		};
		return res.redirect('/');
	}

    UserModel.findOne(queryUser,function(err, user){

    	// 用户账号信息正确，db查到信息
    	if (user) {
    		req.session.user=req.body.user;
        	res.redirect(303, '/home');
    	}else{

    		req.session.flash = {
				type: 'danger',
				intro: '账号信息错误',
				message: '用户名密码不正确.',
			};
    		res.redirect(303, '/');
    	}

    });

};

// 退出
exports.logout = function(req, res){
	if (req.session) {
		req.session.destroy();
	};
	
	res.redirect(303, '/');
}

// 注册页面
exports.signup = function(req, res){
	res.render('signup');
};

// 注册功能实现

exports.doSignup = function(req, res){

	var user = req.body.user;

     if(!user.name || !user.pass) {
		if(req.xhr) return res.json({ error: '注册的用户名密码未成功输入.' });
		req.session.flash = {
			type: 'danger',
			intro: '注册信息错误',
			message: '注册的用户名密码未成功输入.',
		};
		return res.redirect('/signup');
	}

		new UserModel(user).save();

		req.session.flash = {
			type: 'info',
			intro: '系统提示',
			message: '请使用注册信息登录.',
		};
		return res.redirect(303, '/');
};

// home页面
exports.home = function(req, res){
	res.render('home');
};

// about页面
exports.about = function(req, res){
	res.render('about', { 
		fortune: fortune.getFortune(),
	} );
};

