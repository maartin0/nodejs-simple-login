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
// var bodyParser = require('body-parser')

const app = new express();
const port = 80;

// Middlewares
app.use(express.static(__dirname + "/static/"));
app.set('views', __dirname + "/templates/");

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use(express.urlencoded());
app.use(express.json());

// app.use(bodyParser.urlencoded({ extended: false }))
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
    const check_result = await cookie_schema.isValid(request.cookies);

    if (!check_result) {
        response.redirect(get_gstring("/login", {
            info: "You need to sign in to do that!"
        }));
        return false;
    }

    const user_id = auth.session(request.cookies.session);

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
        csrfToken: request.csrfToken()
    });
});

app.get("/register", function (request, response) {
    response.render("register", {
        csrfToken: request.csrfToken()
    });
});

app.post("/auth/login", function(request, response) {
    var check_result = login_schema.isValid(request.body).then(function(valid) {
        if (!valid) {
            response.send({
                info: "Invalid Form Data",
                success: 0
            });
            return;
        }
        
        const username = request.body.username;

        if (!auth.user_exists(username)) {
            response.send({
                info: "Invalid credentials",
                success: 0
            });
            return;
        }
        
        const password = request.body.password;

        const result = auth.login(username, password);

        if (!result) {
            response.send({
                info: "Invalid credentials",
                success: 0
            });
            return;
        }

        const session = auth.get_session(username);
        
        if (session == null) {
            response.send({
                info: "An unknown error occurred",
                success: 0
            });
            return;
        }

        response.send({
            info: "Success!",
            session: session,
            success: 1
        });
    });
})

app.post("/auth/register", function(request, response) {
    var check_result = login_schema.isValid(request.body).then(function(valid) {
        if (!valid) {
            response.send({
                info: "Invalid Form Data",
                success: 0
            });
            return;
        }
        
        const username = request.body.username;

        if (auth.user_exists(username)) {
            response.send({
                info: "User already exists!",
                success: 0
            });
            return;
        }
        
        const password = request.body.password;

        const result = auth.register(username, password);

        if (!result) {
            response.send({
                info: "An unknown error occurred",
                success: 0
            });
            return;
        }

        const session = auth.get_session(username);
        
        if (session == null) {
            response.send({
                info: "An unknown error occurred",
                success: 0
            });
            return;
        }

        response.send({
            info: "Success!",
            session: session,
            success: 1
        });
    });
})

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`)
})