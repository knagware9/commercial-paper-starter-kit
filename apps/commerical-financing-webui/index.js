'use strict';

// Load external modules
const express = require('express');
const path = require('path');
let bodyParser = require('body-parser');
let http = require('http');
let session = require('express-session');
let rest = require('./rest-interface.js');
let util = require('./util.js');
let passport = require('passport');
let mongoose = require('mongoose');
let allConfigs = require('./server-configs.js');

// Routing modules
let paperRoutes = require('./routes/paper.js');
let authRoutes = require('./routes/auth.js')(passport);
let usersRoutes = require('./routes/users.js');

// Local and REST server config
let serverConfig = {};
if (process.argv.length == 3) {
    let configName = process.argv[2];
    let config = allConfigs[configName];

    if (config) {
        serverConfig = config;
    } else {
        console.log('[ERROR] No server configurations detected, exiting');
        process.exit();
    }
}
util.serverConfig = serverConfig;

let nsSubdomain = 'fabric';
let nsDomain = 'hyperledger';
let nsClient = 'cp';
let namespace = nsSubdomain + '.' + nsDomain + '.' + nsClient;
util.namespace = namespace;

const composerServerConfig = {
    'protocol': 'http://',
    'host': 'localhost',
    'port': 3000,
    'loginPath': '/auth/github',
    'namespace': namespace
};
let loginURL = composerServerConfig.protocol + composerServerConfig.host + ':' + composerServerConfig.port + composerServerConfig.loginPath;
rest.setServerConfig(composerServerConfig);

// Mongoose config
mongoose.connect(serverConfig.dbURL, { useMongoClient: true });
let db = mongoose.connection;
db.on('error', (err) => {
    console.log('[ERROR]', err);
});
db.once('open', () => {
    console.log('[INFO]', 'Connected to MongoDB');
});

// Get the express server
const app = express();

// Express settings
app.set('view engine', 'pug');

// Express middleware
app.use('/static', express.static(path.join(__dirname, serverConfig.staticDir)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'kitty',
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Custom middleware
// Build the viewData object if it doesn't exist
app.use((req, res, next) => {
    if (!res.viewData) {
        res.viewData = {};
    }

    next();
});

// Retrieve company info for the UI and add it to the viewData
app.use((req, res, next) => {
    if (!req.user || req.originalUrl == '/logout') {
        res.viewData.companyInfo = { name: serverConfig.company };
        return next();
    }

    rest.getCompany(util.serverConfig.company, util.serverConfig.token, (getCompanyRes, getCompanyErr) => {
        if (getCompanyErr) {
            getCompanyErr.handler.redirect = '/login';

            return next(getCompanyErr);
        }

        res.viewData.companyInfo = getCompanyRes;
        next();
    });
});

// Place the user in viewData if logged in
app.use((req, res, next) => {
    if (req.user) {
        res.viewData.currentUser = req.user;
    }

    next();
});

// Load routing modules
app.use('/paper', paperRoutes);
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);

// Root routes
app.get('/', (req, res, next) => {
    if (req.user) {
        return res.redirect('/paper');
    }

    util.clearGuards(req);
    res.viewData.flash = util.getFlash(req);
    res.render('login', res.viewData);
});

app.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/paper');
    }

    util.clearGuards(req);
    res.viewData.flash = util.getFlash(req);
    res.render('login', res.viewData);
});

app.get('/logout', (req, res) => {
    req.logout();

    util.flashSuccess(req, 'You were logged out');
    res.redirect('/');
});

// Guard against redirection loops by logging out
app.use((err, req, res, next) => {
    if (err.handler) {
        if (!req.session.redirectGuards) {
            req.session.redirectGuards = {};
        }

        let guardValue = req.session.redirectGuards[err.handler.redirect];

        if (!guardValue) {
            req.session.redirectGuards[err.handler.redirect] = 1;
        } else {
            if (guardValue >= 1) {
                req.logout();
                util.flashSuccess(req, 'You were logged out');
                util.clearGuards(req);
                res.viewData.flash = util.getFlash(req);
                return res.render('login', res.viewData);
            } else {
                req.session.redirectGuards[err.handler.redirect] += 1;
            }
        }
    }

    return next(err);
});

// Log errors if debug is enabled
app.use((err, req, res, next) => {
    if (serverConfig.debug) {
        console.log('[ERROR]');
        console.log(err);
    }

    return next(err);
});

// Set default message and redirect if none given for each type of error
app.use((err, req, res, next) => {
    let msg = 'There was an error';
    let redirect = '/logout';

    if (err.handler && err.handler.type) {
        switch(err.handler.type) {
        case util.ERROR_TYPES.COMPOSER_REST_HTTP_ERROR:
            msg = 'An HTTP error occurred during a call to the REST server, check server logs';
            redirect = '/paper';
            break;

        case util.ERROR_TYPES.COMPOSER_REST_ERROR:
            msg = 'A REST server error occurred';
            redirect = '/paper';

            if (err.handler.subtype) {
                if (err.handler.subtype == util.COMPOSER_REST_ERROR_TYPES.AUTH) {
                    msg = 'Not authenticated to the REST server';
                }
                else if (err.handler.subtype == util.COMPOSER_REST_ERROR_TYPES.ENROLL) {
                    msg = 'No default identity enrolled or selected on the REST server';
                }
            }
            break;

        case util.ERROR_TYPES.VALIDATION_ERROR:
            msg = 'A field was inputted incorrectly';
            redirect = '/paper';
            break;

        case util.ERROR_TYPES.AUTHENTICATION_ERROR:
            msg = 'You must be authenticated to perform this action';
            redirect = '/login';
            break;

        case util.ERROR_TYPES.USER_ALREADY_EXISTS_ERROR:
            msg = 'This user already exists';
            redirect = '/auth/local/register';
            break;

        case util.ERROR_TYPES.MONGOOSE_ERROR:
            msg = 'There was a database error, could not perform action';
            redirect = '/paper';
            break;

        case util.ERROR_TYPES.CRYPTO_ERROR:
            msg = 'There was an error while performing cryptographic functions';
            redirect = '/paper';
            break;

        case util.ERROR_TYPES.NOT_ALLOWED_ERROR:
            msg = 'You do not have sufficient permissions to perform this action';
            redirect = '/paper';
            break;

        case util.ERROR_TYPES.INVALID_ROLE_ERROR:
            msg = 'Invalid role type selected';
            redirect = '/auth/local/register';
            break;
        }

        err.handler.msg = err.handler.msg || msg;
        err.handler.redirect = err.handler.redirect || redirect;
    }

    return next(err);
});

// Set the error message flash and redirect
app.use((err, req, res, next) => {
    if (err.handler) {
        util.flashError(req, err.handler.msg);
        return res.redirect(err.handler.redirect);
    }

    return next(err);
});

// Handle unhandled errors
app.use((err, req, res, next) => {
    // Let the default Pug error handler send error to the browser
    if (err.code) {
        if (err.code.substring(0, 3) == 'PUG') {
            return next(err);
        }
    }

    // If debug is enabled, send the full error to the browser
    if (serverConfig.debug) {
        return res.send(err.toString());
    } else {
        return res.send('[ERROR] A fatal error occurred');
    }
});

// Start listening
app.listen(serverConfig.port, () => {
    console.log('[INFO] Started listening on', serverConfig.port);
});

// On exit, close MongoDB connection
process.on('SIGINT', cleanup);

function cleanup() {
    console.log('[INFO] Closing MongoDB connection');
    mongoose.disconnect();

    process.exit();
}
