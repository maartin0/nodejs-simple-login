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

async function sendError(response, info) {
  response.send({
    info,
    success: 0,
  });
}

async function handle(result, response) {
  if (result) response.send({ success: 1 });
  else sendError(response, UNKNOWN_ERROR);
}

router.get('/login', noSession, async (request, response) => {
  let hiddenString = 'hidden';

  if (configFile.email.enable) hiddenString = '';

  response.render('login', {
    csrfToken: request.csrfToken(),
    forgotToggle: hiddenString,
  });
});

router.post('/auth/login', async (request, response) => {
  const { username } = request.body;
  const userID = await auth.fetch.user.id(username);

  if (!userID) {
    // User does not exist.
    await sendError(response, INVALID_CREDENTIALS_ERROR);
    return;
  }

  const { password } = request.body;
  const loginResult = await auth.entry.login(username, password);

  if (!loginResult) {
    // Password is incorrect.
    await sendError(response, INVALID_CREDENTIALS_ERROR);
    return;
  }

  const sessionID = await auth.session.fetch(userID);

  if (!sessionID) {
    await sendError(response, UNKNOWN_ERROR);
    return;
  }

  response.send({
    success: 1,
    session: sessionID,
  });
});

router.get('/register', noSession, async (request, response) => {
  response.render('register', { csrfToken: request.csrfToken() });
});

router.post('/auth/register', async (request, response) => {
  const { username } = request.body;
  let userID = await auth.fetch.user.id(username);

  if (userID) {
    await sendError(response, USER_ALREADY_EXISTS_ERROR);
    return;
  }

  const { password } = request.body;
  const registerResult = await auth.entry.register(username, password);

  if (!registerResult) {
    await sendError(response, UNKNOWN_ERROR);
    return;
  }

  userID = await auth.fetch.user.id(username);
  if (!userID) {
    await sendError(response, UNKNOWN_ERROR);
    return;
  }

  const loginResult = await auth.entry.login(username, password);

  if (!loginResult) {
    await sendError(response, UNKNOWN_ERROR);
    return;
  }

  const sessionID = await auth.session.fetch(userID);

  if (!sessionID) {
    await sendError(response, UNKNOWN_ERROR);
    return;
  }

  response.send({
    success: 1,
    session: sessionID,
  });
});

router.get('/logout', session, async (request, response) => {
  response.render('logout');

  const sessionID = request.cookies.session;
  await auth.session.remove(sessionID);
});

router.get('/forgot', noSession, async (request, response) => {
  if (configFile.email.enable) response.render('forgot', { csrfToken: request.csrfToken() });
  else response.sendStatus(404);
});

router.post('/auth/forgot', noSession, async (request, response) => {
  if (!configFile.email.enable) {
    response.sendStatus(404);
    return;
  }

  response.send({ success: 1 });

  let { email } = request.body;
  if (!validator.isEmail(`${email}`)) return;

  email = validator.normalizeEmail(email);

  const userID = await auth.fetch.user.idFromEmail(email);
  if (!userID) return;

  const otp = await auth.otp.fetch(userID);
  if (!otp) return;

  const body = `Hi,\n\nWe recieved your password reset request.\n\nIf you forgot your password please click on the link below and follow the instructions.\n${configFile.url}/reset?psk=${otp}\n\nIf you believe there has been an error, or you did not make this request. Please ignore this email and consider changing your password.`;

  emails.send(email, 'Your forgot password request', body);
});

router.get('/reset', noSession, async (request, response) => {
  const otp = request.query.psk;
  if (!otp) {
    response.redirect('/login?info=Not%20found');
    return;
  }

  const userID = await auth.otp.verify(otp);
  if (!userID) {
    response.redirect('/login?info=Invalid%2Fexpired%20token');
    return;
  }

  const sessionID = await auth.session.fetch(userID);
  if (!sessionID) {
    response.redirect('/login?info=An%20unknown%20error%20occurred.%20Please%20try%20again%20later');
    return;
  }

  response.cookie('session', sessionID);
  response.redirect('/account');
});

router.get('/account', session, async (request, response) => {
  const sessionID = request.cookies.session;
  const userID = await auth.fetch.user.idFromSession(sessionID);
  if (!userID) request.redirect('/login');

  let username = await auth.fetch.user.username(userID);
  let email = await auth.fetch.user.email(userID);
  let name = await auth.fetch.user.name(userID);

  if (!email) email = '';
  if (!username) username = '';
  if (!name) name = '';

  response.render('account', {
    username: validator.escape(username),
    email: validator.escape(email),
    name: validator.escape(name),
    csrfToken: request.csrfToken(),
  });
});

router.post('/auth/account/username', session, async (request, response) => {
  const userID = await auth.fetch.user.idFromSession(request.cookies.session);
  if (await auth.fetch.user.id(request.body.username)) {
    await sendError(response, USER_ALREADY_EXISTS_ERROR);
  } else {
    await handle(
      userID
      && request.body.username
      && await auth.account.modify.username(userID, request.body.username),
      response,
    );
  }
});

router.post('/auth/account/name', session, async (request, response) => {
  const userID = await auth.fetch.user.idFromSession(request.cookies.session);
  await handle(
    userID
    && request.body.name
    && await auth.account.modify.name(userID, request.body.name),
    response,
  );
});

router.post('/auth/account/email', session, async (request, response) => {
  const userID = await auth.fetch.user.idFromSession(request.cookies.session);
  await handle(
    userID
    && request.body.email
    && validator.isEmail(`${request.body.email}`)
    && await auth.account.modify.email(userID, validator.normalizeEmail(request.body.email)),
    response,
  );
});

router.post('/auth/account/password', session, async (request, response) => {
  const userID = await auth.fetch.user.idFromSession(request.cookies.session);
  await handle(
    userID
    && request.body.password
    && await auth.account.modify.password(userID, request.body.password),
    response,
  );
});

router.post('/auth/account/delete', session, async (request, response) => {
  const userID = await auth.fetch.user.idFromSession(request.cookies.session);
  await handle(
    userID
    && await auth.account.remove(userID),
    response,
  );
});

async function session(request, response, next) {
  if (await auth.session.verify(request.cookies.session)) next();
  else response.redirect('/login');
}

async function noSession(request, response, next) {
  if (await auth.session.verify(request.cookies.session)) response.redirect('/');
  else next();
}

module.exports = {
  router,
  session,
};
