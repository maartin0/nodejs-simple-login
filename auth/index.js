const validator = require('validator');
const express = require('express');
const router = express.Router();

const auth = require('./auth');

const INVALID_CREDENTIALS_ERROR = 'Invalid username and password combination.';
const UNKNOWN_ERROR = 'An unknown error occurred. Please try again later.';
const USER_ALREADY_EXISTS_ERROR = 'A user with that name already exists.';
const INVALID_EMAIL_ERROR = 'Invalid email address.'

async function sendError(response, info = INVALID_CREDENTIALS_ERROR) {
    response.send({
        info,
        success: 0,
    });
}

router.get('/login', async function (request, response) {
    response.render('login', { csrfToken: request.csrfToken() });
});

router.post('/auth/login', async function (request, response) {
    const username = request.body.username;
    const userID = await auth.fetch.user.id(username);

    if (userID == null) {
        // User does not exist.
        await sendError(response);
        return;
    }

    const password = request.body.password;
    const loginResult = await auth.entry.login(username, password);

    if (!loginResult) {
        // Password is incorrect.
        await sendError(response);
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

router.get('/register', async function (request, response) {
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

router.get('/logout', async function (request, response) {
    const sessionID = request.cookies.session;
    const result = await auth.session.remove(sessionID);

    response.render('logout');
});

router.get('/account', session, async function (request, response) {
    const sessionID = request.cookies.session;
    const userID = await auth.fetch.user.idFromSession(sessionID);
    if (userID == null) request.redirect('/login');

    const username = await auth.fetch.user.name(userID);
    const email = await auth.fetch.user.email(userID);
    
    response.render('account', {validator.escape(username), validator.escape(email), csrfToken: request.csrfToken() });
});

router.post('/auth/account', session, async function (request, response) {
    const sessionID = request.cookies.session;
    const userID = await auth.fetch.user.idFromSession(sessionID);
    if (userID == null) {
        await sendError(response, UNKNOWN_ERROR);
        return;
    }

    let email = request.body.email;
    if (email == null || !validator.isEmail(email + '')) {
        await sendError(response, INVALID_EMAIL_ERROR);
        return;
    } else if (await auth.fetch.user.email(userID) === email) {
        email = null;
    } else {
        email = validator.normalizeEmail(email);
    }

    let username = request.body.username;
    if (username == null) {
        // TODO: Implement Error
        await sendError(response, INVALID_USERNAME_ERROR);
        return;
    } else if (await auth.fetch.user.name(userID) === username) {
        username = null;
    } else if (await auth.fetch.user.id(username) != null) {
        await sendError(response, USER_ALREADY_EXISTS_ERROR);
        return;
    }

    // TODO: Check password etc... then save not null values

});

async function session(request, response, next) {
    const result = await auth.session.verify(request.cookies.session);

    if (!result) {
        response.redirect("/login");
        return;
    }

    next();
}

module.exports = {
    router,
    session,
}