const validator = require('validator');
const express = require('express');
const router = express.Router();

const auth = require('./auth');
const emails = require('./email');
const files = require('../file');

const CONFIGURATION_PATH = 'config/auth.json';
let configFile;
files.read(CONFIGURATION_PATH).then((resolve) => (configFile = resolve));

const INVALID_CREDENTIALS_ERROR = 'Invalid username and password combination.';
const UNKNOWN_ERROR = 'An unknown error occurred. Please try again later.';
const USER_ALREADY_EXISTS_ERROR = 'A user with that name already exists.';
const INVALID_EMAIL_ERROR = 'Invalid email address.'

const encode = (content) => 

async function sendError(response, info) {
    response.send({
        info,
        success: 0,
    });
}

async function handleResult(result, response) {
    if (result) {
        response.send({ success: 1 });
    } else {
        sendError(response, UNKNOWN_ERROR);
    }
}

router.get('/login', noSession, async function (request, response) {
    let hiddenString = "hidden";

    if (configFile.email.enable) {
        hiddenString = "";
    }
    
    response.render('login', { 
        csrfToken: request.csrfToken(),
        forgotToggle: hiddenString,
    });
});

router.post('/auth/login', async function (request, response) {
    const username = request.body.username;
    const userID = await auth.fetch.user.id(username);

    if (userID == null) {
        // User does not exist.
        await sendError(response, INVALID_CREDENTIALS_ERROR);
        return;
    }

    const password = request.body.password;
    const loginResult = await auth.entry.login(username, password);

    if (!loginResult) {
        // Password is incorrect.
        await sendError(response, INVALID_CREDENTIALS_ERROR);
        return;
    }

    const sessionID = await auth.session.fetch(userID);

    if (sessionID == null) {
        await sendError(response, UNKNOWN_ERROR);
        return;
    }

    response.send({
        success: 1,
        session: sessionID,
    });
});

router.get('/register', noSession, async function (request, response) {
    response.render('register', { csrfToken: request.csrfToken() });
});

router.post('/auth/register', async function (request, response) {
    const username = request.body.username;
    let userID = await auth.fetch.user.id(username);

    if (userID != null) {
        sendError(response, USER_ALREADY_EXISTS_ERROR);
        return;
    }

    const password = request.body.password;
    const registerResult = await auth.entry.register(username, password);

    if (!registerResult) {
        sendError(response, UNKNOWN_ERROR);
        return;
    }

    userID = await auth.fetch.user.id(username);
    if (userID == null) {
        sendError(response, UNKNOWN_ERROR);
        return;
    }

    const loginResult = await auth.entry.login(username, password);

    if (!loginResult) {
        sendError(response, UNKNOWN_ERROR);
        return;
    }

    const sessionID = await auth.session.fetch(userID);

    if (sessionID == null) {
        await sendError(response, UNKNOWN_ERROR);
        return;
    }

    response.send({
        success: 1,
        session: sessionID,
    });
});

router.get('/logout', session, async function (request, response) {
    response.render('logout');
    
    const sessionID = request.cookies.session;
    const result = await auth.session.remove(sessionID);
});

router.get('/forgot', noSession, async function (request, response) {
    response.render("forgot", { csrfToken: request.csrfToken() });
});

router.post('/auth/forgot', noSession, async function (request, response) {
    response.send({ success: 1 });
    
    let email = request.body.email;
    if (!validator.isEmail(email + '')) return;

    email = validator.normalizeEmail(email);
    
    const userID = await auth.fetch.user.idFromEmail(email);
    if (userID == null) return;

    const otp = await auth.otp.fetch(userID);
    if (otp == null) return;


    const body = `Hi,

We recieved your password reset request. 

If you forgot your password please click on the link below and follow the instructions.
${configFile.url}/reset?psk=${otp}

If you believe there has been an error, or you did not make this request. Please ignore this email and consider changing your password.`

    emails.send(email, 'Your forgot password request', body);
});

router.get('/reset', noSession, async function (request, response) {
    const otp = request.query.psk;
    if (otp == null) {
        response.redirect('/login?info=Not%20found');
        return;
    }

    const userID = await auth.otp.verify(otp);
    if (userID == null) {
        response.redirect('/login?info=Invalid%2Fexpired%20token');
        return;
    }

    const sessionID = await auth.session.fetch(userID);
    if (sessionID == null) {
        response.redirect('/login?info=An%20unknown%20error%20occurred.%20Please%20try%20again%20later');
        return;
    }

    response.cookie('session', sessionID);
    response.redirect('/account');
});

router.get('/account', session, async function (request, response) {
    const sessionID = request.cookies.session;
    const userID = await auth.fetch.user.idFromSession(sessionID);
    if (userID == null) request.redirect('/login');

    let username = await auth.fetch.user.name(userID);
    let email = await auth.fetch.user.email(userID);
    
    if (email == null) email = '';
    if (username == null) username = '';
    
    response.render('account', {
        username: validator.escape(username), 
        email: validator.escape(email), 
        csrfToken: request.csrfToken(),
    });
});

router.post('/auth/account/username', session, async function (request, response) {
    const userID = await auth.fetch.user.idFromSession(request.cookies.session);
    handle(
        userID && request.body.username && await auth.account.modify.username(userID, request.body.username),
        response
    );
});

router.post('/auth/account/name', session, async function (request, response) {
    const userID = await auth.fetch.user.idFromSession(request.cookies.session);
    handle(
        userID && request.body.name && await auth.account.modify.name(userID, request.body.name),
        response
    );
});

router.post('/auth/account/email', session, async function (request, response) {
    const userID = await auth.fetch.user.idFromSession(request.cookies.session);
    handle(
        userID && request.body.email && validator.isEmail(email + '') && await auth.account.modify.email(userID, validator.normalizeEmail(request.body.email)), 
        response
    );
});

router.post('/auth/account/password', session, async function (request, response) {
    const userID = await auth.fetch.user.idFromSession(request.cookies.session);
    handle(
        userID && request.body.password && await auth.account.modify.password(userID, request.body.password),
        response
    );
});

router.post('/auth/account/delete', session, async function (request, response) {
    const userID = await auth.fetch.user.idFromSession(request.cookies.session);
    handle(
        userID && await auth.account.remove(userID),
        response
    );
});

async function session(request, response, next) {
    if (await auth.session.verify(request.cookies.session)) {
        next();
    } else {
        response.redirect("/login");
    }
}

async function noSession(request, response, next) {
    if (await auth.session.verify(request.cookies.session)) {
        response.redirect("/");
    } else {
        next();
    }
}

module.exports = {
    router,
    session,
}