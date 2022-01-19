const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const path = require('path');

const auth = require('./auth');

const app = new express();
const port = 8080;

// ----------------------------------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------

const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

app.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);

  // handle CSRF token errors here
  res.status(403);
  res.send('403: Forbidden.');

  console.log('Invalid CSRF Token');
});

app.use('/', auth.router);

app.get('/', auth.session, (request, response) => {
  response.render('index');
});

app.listen(port, () => {
  console.log(`\x1b[32mServer Listening at http://localhost:${port}\x1b[0m`);
});
