// 未登录验证
exports.authentication = function(req, res, next) {

    if (!req.session.user) {
    	var flash = {
    		type: 'danger',
			intro: '登录验证',
			message: '请登录系统使用.'
		};
        req.session.flash = flash;
        return res.redirect('/');
    }else{
    	next();
    }
}