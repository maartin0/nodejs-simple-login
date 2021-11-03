async function register(event) {
    event.preventDefault();

    let element = event.submitter;
    let username = document.getElementById("register-username").value;
    let csrf = document.getElementById("register-csrf").value;
    var password = await sha256(document.getElementById("register-password").value);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/auth/register");
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
                document.location.href = "/login?info=Successfully%20Registered!%20Now%20log%20in.";
            }
        }
    }

    console.log("Register req sent");
    xhr.send(JSON.stringify({
        _csrf: csrf,
        password: password,
        username: username
    }));
}

function toggle_password() {
    var input = document.getElementById("register-password");
    if (input.type == "text") {
        input.type = "password";
    } else {
        input.type = "text";
    }
}

window.onload = function () {
    var register_form = document.getElementById("register_form");
    register_form.addEventListener('submit', register);
}