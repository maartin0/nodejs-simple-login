// Imports
const auth = require("./auth.js");
const yup = require("yup");

// Yup Setup
const login_schema = yup.object().shape({
    username: yup
      .string()
      .required(),
    password: yup
      .string()
      .required()
});

const register_schema = yup.object().shape({
    email: yup
      .string()
      .email()
      .required(),
    username: yup
      .string()
      .required(),
    password: yup
      .string()
      .required()
});

const cookie_schema = yup.object().shape({
    session: yup
        .string()
        .required()
});

// Express Setup
const express = require('express');
var exphbs  = require('express-handlebars');

var cookieParser = require('cookie-parser')
var csrf = require('csurf')
var bodyParser = require('body-parser')

const app = new express();
const port = 80;

const static_root = __dirname + "/static/";

// Middlewares
app.use(express.static(static_root));
app.set('views', static_root + "templates/");

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use(express.urlencoded());
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(csrf({ cookie: true }))

// Miscelaneous Methods
function get_gstring(prefix, data) {
    var result = [prefix, "?"];

    for (const [key, value] of Object.entries(data)) {
        result.push(
            encodeURIComponent(key),
            "=",
            encodeURIComponent(value),
            "&"
        );        
    }

    if (result.length > 1) result.pop();

    return result.join("");
}

async function check_session(request, response) {
    const check_result = await cookie_schema.isValid(request.body);

    if (!check_result) {
        response.redirect(get_gstring("/login", {
            info: "You need to sign in to do that!"
        }));
        return false;
    }

    const user_id = auth.session(request.body.session);

    if (user_id == null) {
        response.redirect(get_gstring("/login", {
            info: "Your session expired. Please sign in again!"
        }));
        return false;
    }
    return true;
}

// Express Method Handlers

app.get("/", function (request, response) {
    check_session(request, response).then(function (valid) {
        if (valid) response.render("index");
    });
});

app.get("/login", function (request, response) {
    response.render("login", {
        root : static_root + "templates/", 
        csrfToken: request.csrfToken()
    });
});

app.post("/auth/login/simple", function (request, response) {
    var check_result = login_schema.isValid(request.body).then(function(valid) {
        if (!valid) {
            response.redirect(get_gstring("/login", {
                info: "Invalid Form Data",
                error: 1
            }));
            return;
        }
        
        const username = request.body.username;

        if (!auth.user_exists(username)) {
            response.redirect(get_gstring("/login", {
                info: "Invalid credentials"
            }));
            return;
        }
        
        // If JS is not enabled, hash the password once before passing to login function.
        const password = auth.sha(request.body.password);

        const result = auth.login(username, password);

        if (!result) {
            response.redirect(get_gstring("/login", {
                info: "Invalid credentials"
            }));
            return;
        }

        const session = auth.get_session(username);
        
        if (session == null) {
            response.redirect(get_gstring("/login", {
                info: "An unknown error occurred",
                error: 1
            }));
            return;
        }

        response.cookie("session", session);

        response.redirect("/");
    });
});

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`)
})