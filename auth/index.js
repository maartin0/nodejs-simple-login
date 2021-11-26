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

router.get('/login', noSession, async function (request, response) {
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
    const sessionID = request.cookies.session;
    const result = await auth.session.remove(sessionID);

    response.render('logout');
});

router.get('/forgot', noSession, async function (request, response) {
    response.render("forgot", { csrfToken: request.csrfToken() });
});

router.post('/auth/forgot', noSession, async function (request, response) {
    let email = request.body.email;
    if (!validator.isEmail(email + '')) {
        response.send({ success: 1 });
        return;
    }

    email = validator.normalizeEmail(email);
    
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

router.post('/auth/account', session, async function (request, response) {
    const sessionID = request.cookies.session;
    const userID = await auth.fetch.user.idFromSession(sessionID);

    if (userID == null) {
        await sendError(response, UNKNOWN_ERROR);
        return;
    }

    if (request.body.delete_account === 1) {
        if (!await auth.account.remove(userID)) {
            await sendError(response, UNKNOWN_ERROR);
            return;
        }
    } else {
        let email = request.body.email;
        if (email == null || email === '') {
            email = null;
        } else if (!validator.isEmail(email + '')) {
            await sendError(response, INVALID_EMAIL_ERROR);
            return;
        } else {
            email = validator.normalizeEmail(email);
            if (await auth.fetch.user.email(userID) === email) {
                email = null;
            }
        }
        
        let username = request.body.username;
        if (username == null || username == '' || await auth.fetch.user.name(userID) === username) {
            username = null;
        } else if (await auth.fetch.user.id(username) != null) {
            await sendError(response, USER_ALREADY_EXISTS_ERROR);
            return;
        }
        
        let password = request.body.password;
        if (password == null || password === '' || await auth.compare(userID, password)) {
            password = null;
        }

        const results = [];
        if (email != null) {
            results.push(await auth.account.modify.email(userID, email));
        } if (username != null) {
            results.push(await auth.account.modify.username(userID, username));
        } if (password != null) {
            results.push(await auth.account.modify.password(userID, password));
        }

        const result = results.every(x => x);
        if (!result) {
            await sendError(response, UNKNOWN_ERROR);
            return;
        }
    }
    
    response.send({
        success: 1
    });
});

async function session(request, response, next) {
    if (!await auth.session.verify(request.cookies.session)) {
        response.redirect("/login");
    } else {
        next();
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