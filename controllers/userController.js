var UserModel = require('../models/user-model.js');

exports.list = function(req, res){
    UserModel.find(function(err, users){

        res.render('users/list', {users:users});
    });
};
