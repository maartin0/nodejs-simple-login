const express = require('express');
const app = new express();
const port = 80;

// ----------------------------------------------------

app.use(express.static(__dirname + "/client/static/"));
app.set('views', __dirname + "/client/templates/");

app.use(express.urlencoded());
app.use(express.json());

const exphbs  = require('express-handlebars');
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

const cookieParser = require('cookie-parser');
app.use(cookieParser());

const csrf = require('csurf');
app.use(csrf({ cookie: true }));

// ----------------------------------------------------

const auth = require("./auth/router.js");
// app.use("/", auth);

// ----------------------------------------------------

app.get("/", function (request, response) {
    response.render("index");
})

app.get("/login", function (request, response) {
    response.render("login");
})

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`);
});