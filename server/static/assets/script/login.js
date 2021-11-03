async function login(event) {
    event.preventDefault();

    let element = event.submitter;
    let username = document.getElementById("login-username").value;
    let csrf = document.getElementById("login-csrf").value;
    var password = await sha256(document.getElementById("login-password").value);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/auth/login");
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.responseType = "json";

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            const result = xhr.response;
            if (!("success" in result) || result.success != 1) {
                var obj = document.getElementById("info-message");
                obj.innerHTML = result.info;
                obj.style.color = "red";
            } else {
                document.cookie = "session=" + result.session;
                document.location.href = "/";
            }
        }
    }

    xhr.send(JSON.stringify({
        _csrf: csrf,
        password: password,
        username: username
    }));
}

function toggle_password() {
    var input = document.getElementById("login-password");
    if (input.type == "text") {
        input.type = "password";
    } else {
        input.type = "text";
    }
}

window.onload = function () {
    var login_form = document.getElementById("login_form");
    login_form.addEventListener('submit', login);
}