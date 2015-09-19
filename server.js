#!/usr/bin/env node

// 引入模块
var http = require('http'),
	express = require('express'),
	fortune = require('./lib/fortune.js'),
	formidable = require('formidable'),
	fs = require('fs'),
	vhost = require('vhost');

var jqupload = require('jquery-file-upload-middleware');

var config = require('./config.js');
var emailService = require('./lib/email.js')(config);

//----------------------------------------------------------------------------//
var app = express();

// 1，设置 handlebars 视图引擎
var handlebars = require('express3-handlebars').create({
    defaultLayout:'main',
    helpers: {
        section: function(name, options){
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        },
        static: function(name) {
            return require('./lib/static.js').map(name);
        }
    }
});
// 注册视图引擎
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// 3，设置监听端口
app.set('port', process.env.PORT || 3000);

// 4，使用域更好的处理异常
app.use(function(req, res, next){
    // create a domain for this request
    var domain = require('domain').create();
    // handle errors on this domain
    domain.on('error', function(err){
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch(error){
                // if Express error route failed, try
                // plain Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(error){
            console.error('Unable to send 500 response.\n', error.stack);
        }
    });

    // add the request and response objects to the domain
    domain.add(req);
    domain.add(res);

    // execute the rest of the request chain in the domain
    domain.run(next);
});

// 设置运行环境，影响log和数据库连接
// app.set('env', 'production');

// 5，session设置
// var MongoSessionStore = require('session-mongoose')(require('connect'));
// var sessionStore = new MongoSessionStore({ url: config.mongo[app.get('env')].connectionString });


var session = require('express-session');

// redis session参数配置
var RedisStore = require('connect-redis')(session);
var RedisOptions = {
  host : '127.0.0.1',
  port : '6379',
  ttl  : 3600,
  prefix : 'nodejs-sid_'
};
var sessionStore = new RedisStore(RedisOptions);

// session用到cookie
var cookiePaser = require('cookie-parser');
app.use(cookiePaser(config.cookieSecret));

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: config.cookieSecret,
	store: sessionStore,
}));

// session过期判断
app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error('session timeout')) // handle error 
  }
  next() // otherwise continue 
})

// 6，静态文件路径设置(在log之前，这样不会记静态请求log)
app.use(express.static(__dirname + '/public'));

// 7，log处理
switch(app.get('env')){
    case 'development':
        // 简短，有颜色的日志工具
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        // 访问log日志，在项目之外
        app.use(require('express-logger')({ path: '../log/requests.log'}));
        break;
}

//---------------------------------------------------------
// jQuery File Upload endpoint middleware
app.use('/upload', function(req, res, next){
    var now = Date.now();
    jqupload.fileHandler({
        uploadDir: function(){
            return __dirname + '/public/uploads/' + now;
        },
        uploadUrl: function(){
            return '/uploads/' + now;
        },
    })(req, res, next);
});

app.get('/users/vacation-photo', function(req, res){
    var now = new Date();
    res.render('users/upload', { year: now.getFullYear(), month: now.getMonth() });
});
app.post('/users/upload/:year/:month', function(req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        if(err) return res.redirect(303, '/error');
        console.log('received fields:');
        console.log(fields);
        console.log('received files:');
        console.log(files);
        res.redirect(303, '/thank-you');
    });
});

//-----------------------------------------------------
app.use(require('body-parser')());

// 8，数据库配置
var mongoose = require('mongoose');
var options = {
    server: {
       socketOptions: { keepAlive: 1 } 
    }
};
switch(app.get('env')){
    case 'development':
        mongoose.connect(config.mongo.development.connectionString, options);
        break;
    case 'production':
        mongoose.connect(config.mongo.production.connectionString, options);
        break;
    default:
        throw new Error('Unknown execution environment: ' + app.get('env'));
}

// -------------------------------------------------------------------------------------//

// flash message middleware
app.use(function(req, res, next){
	// if there's a flash message, transfer
	// it to the context, then clear it
	res.locals.flash = req.session.flash;
	delete req.session.flash;

    res.locals.user = req.session.user;
    
	next();
});

// 做用户假数据
function getCustomerData(){
    return {
        customer: {
            name: '张三',
            sex: '男',
        },
    };
}

// ---------------------------------------------------------------------------------------------/

// 添加数据到 context
app.use(function(req, res, next){
	if(!res.locals.partials) res.locals.partials = {};

    // 注意数据是追加属性的方式！！
 	// res.locals.partials = getCustomerData();

 	next();
});

// 定义取得静态文件的static方法
var static = require('./lib/static.js').map;
app.use(function(req, res, next){
	var now = new Date();
	res.locals.logoImage = now.getMonth()==11 && now.getDate()==19 ?
	static('/img/logo_bud_clark.png') :
	static('/img/logo.png');
	next();
});

// 在头部添加购物车数据
app.use(function(req, res, next) {
	var cart = req.session.cart;
	res.locals.cartItems = cart && cart.items ? cart.items.length : 0;
	next();
});

//--------------------------------------------------------------------------/
// 创建 "admin" 子域 ;这个应该在其它路由之前设置
var admin = express.Router();
app.use(require('vhost')('admin.*', admin));

// create admin routes; these can be defined anywhere
admin.get('/', function(req, res){
	res.render('admin/home');
});
admin.get('/users', function(req, res){
	res.render('admin/users');
});
//--------------------------------------------------------------------------/

// 引入路由设置
require('./routes.js')(app);

// restful api

var Attraction = require('./models/attraction.js');

// restful api定义
var rest = require('connect-rest');

rest.get('/attractions', function(req, content, cb){
    Attraction.find({ approved: true }, function(err, attractions){
        if(err) return cb({ error: 'Internal error.' });
        cb(null, attractions.map(function(a){
            return {
                name: a.name,
                description: a.description,
                location: a.location,
            };
        }));
    });
});

rest.post('/attraction', function(req, content, cb){
    var a = new Attraction({
        name: req.body.name,
        description: req.body.description,
        location: { lat: req.body.lat, lng: req.body.lng },
        history: {
            event: 'created',
            email: req.body.email,
            date: new Date(),
        },
        approved: false,
    });
    a.save(function(err, a){
        if(err) return cb({ error: 'Unable to add attraction.' });
        cb(null, { id: a._id });
    }); 
});

rest.get('/attraction/:id', function(req, content, cb){
    Attraction.findById(req.params.id, function(err, a){
        if(err) return cb({ error: 'Unable to retrieve attraction.' });
        cb(null, { 
            name: a.name,
            description: a.description,
            location: a.location,
        });
    });
});


// API 子域名配置
var apiOptions = {
    context: '/',
    domain: require('domain').create(),
};

apiOptions.domain.on('error', function(err){
    console.log('API domain error.\n', err.stack);
    setTimeout(function(){
        console.log('Server shutting down after API domain error.');
        process.exit(1);
    }, 5000);
    server.close();
    var worker = require('cluster').worker;
    if(worker) worker.disconnect();
});

// 使用二级域名访问：[api.local/attractions]
app.use(vhost('api.*', rest.rester(apiOptions)));

// API 配置


// 添加自动视图支持
var autoViews = {};

app.use(function(req,res,next){
    var path = req.path.toLowerCase();  
    // check cache; if it's there, render the view
    if(autoViews[path]) return res.render(autoViews[path]);
    // if it's not in the cache, see if there's
    // a .handlebars file that matches
    if(fs.existsSync(__dirname + '/views' + path + '.handlebars')){
        autoViews[path] = path.replace(/^\//, '');
        return res.render(autoViews[path]);
    }
    // 没有找到对应视图，转到404处理
    next();
});


/* 404，500 放在next最后处理 */
// 404 页面配置 
app.use(function(req, res, next){
	res.status(404);
	res.render('404');
});

// 500 页面配置 (回调参数多第一个err)
app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500 || 500);
	res.render('500');
});

// app.error(function(err, req, res, next) {                                             
//     mailServie.sendMail({                                                     
//       subject : "FixedAssetManager_Server[App Error]",                    
//       text    : err.message + "\n" + err.stack + "\n" + err.toString()            
//     });                                                                       
//     if (err instanceof PageNotFoundError) {                               
//         res.render("errors/404");                                             
//     } else if (err instanceof ServerError) {                                      
//         res.render("errors/500");                                             
//     }                                                                         
// });  

// process.on("uncaughtException", function (err) {                                      
//     mailServie.sendMail({                                                     
//         subject : "FixedAssetManager_Server[App Error]",                      
//         text    : err.message + "\n" + err.stack + "\n" + err.toString()          
//     });                                                                       
// });

// 定义并启动服务
var server;

function startServer() {
    server = http.createServer(app).listen(app.get('port'), function(){
      console.log( 'Express started in ' + app.get('env') +
        ' mode on http://localhost:' + app.get('port') +
        '; press Ctrl-C to terminate.' );
    });
}

if(require.main === module){
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}
