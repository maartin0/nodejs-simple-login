const express = require('express');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const app = new express();
const port = 80;

// ----------------------------------------------------

app.use(express.static(__dirname + '/client/static/'));
app.set('views', __dirname + '/client/templates/');

app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieParser());

// ----------------------------------------------------

const csrfProtection = csrf({
    cookie: true,
/*    value: function (req) {
        console.log(req.body._csrf);
        return req.body._csrf;
    } */
});
app.use(csrfProtection);

app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);

  // handle CSRF token errors here
  res.status(403);
  res.send('403: Forbidden.');
  
  console.log("Invalid CSRF Token");
});

// ----------------------------------------------------

const auth = require('./auth');
app.use('/', auth.router);

// ----------------------------------------------------

app.get('/', auth.session, function (request, response) {
    response.render('index');
});

app.listen(port, () => {
  console.log(`\x1b[32mServer Listening at http://localhost:${port}\x1b[0m`);
});