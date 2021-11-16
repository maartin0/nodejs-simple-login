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

app.use(express.urlencoded());
app.use(express.json());

app.use(cookieParser());
app.use( csrf( { cookie: true } ) );

// ----------------------------------------------------

const auth = require('./auth');
app.use('/', auth.router);

// ----------------------------------------------------

app.get('/', function (request, response) {
    response.render('index');
})

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`);
});