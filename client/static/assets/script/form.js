// Notifications

async function clear_notifications() {
    var notifications = document.getElementById("notifications").children;
    for (i = 0; i < notifications.length; i++) {
        soft_delete_element(notifications.item(i));
    }
}

async function soft_delete_element(element) {
    element.children[0].style.opacity = '0';
    setTimeout(function () { element.remove() }, 500);
}

async function notify(string, is_error, timeout=-1) {
    var container = document.createElement('div');
    
    var notification = document.createElement('span');
    notification.classList.add("notification");
    notification.textContent = string;
    
    if (is_error) {
        notification.classList.add("error");
    } else {
        notification.classList.add("info");
    }

    var br = document.createElement('br');

    container.appendChild(notification);
    container.appendChild(br);
    container.appendChild(br.cloneNode());

    container.onclick = function (event) {
        var element;
        if (event.target.id.includes("div")) {
            element = event.target;
        } else {
            element = event.target.parentNode;
        }

        soft_delete_element(element);
    }

    document.getElementById("notifications").appendChild(container);

    if (timeout > 0) {
        setTimeout(async function () {
            try {
                container.remove();
            } catch {}
        }, timeout);
    }
}

// Event Function(s)

async function toggle_password() {
    var input = document.getElementById("login-password");
    if (input.type === "text") {
        input.type = "password";
    } else {
        input.type = "text";
    }
}

async function password_policy(psk) {
    return psk.length > 7;
}

async function check_confirmation(event) {
    var password = document.getElementsByName("password").item(0);

    if (!password_policy(password)) {
        password.setCustomValidity("Password must be longer than 8 characters.");
        return false;
    }

    var confirm = document.getElementsByName("confirm").item(0);

    if (password.value !== confirm.value) {
        confirm.setCustomValidity("Passwords do not match.");
        return false;
    } else {
        confirm.setCustomValidity("");
        return true;
    }
}

// Submit Functionality

async function send_xhr(url, data, success, failure) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.responseType = "json";

    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.response == null) {
                notify("Unable to contact server.", true);
                return;
            }

            const result = xhr.response;
            if (!("success" in result) || result.success != 1) {
                failure(result);
            } else {
                success(result);
            }
        }
    }

    xhr.send(JSON.stringify(data));
}

async function submit() {
    var form = document.getElementsByTagName("form").item(0);
    var inputs = form.getElementsByTagName("input");
    var redirect = "";
    var successMessage = "";

    var request_body = {};

    for (i = 0; i < inputs.length; i++) {
        var input = inputs.item(i);

        if (input.name === "redirect") {
            redirect = input.value;
            continue;
        } else if (input.name === "success") {
            successMessage = input.value;
            continue;
        } else if (input.classList.contains("ignored")) continue;

        request_body[input.name] = input.value;
    }

    send_xhr(
        form.getAttribute("javascript_action"), 
        request_body,
        function (result) {
            // Success
            if ("session" in result) {
                document.cookie = "session=" + result.session;
            }

            if (successMessage !== "") {
                notify(successMessage, false);
            }

            if (redirect !== "") {
                document.location.href = redirect;
            }
        }, 
        function (result) {
            // Failure
            notify(result.info, true); 
        }
    );
}

async function submit_form(event) {
    event.preventDefault();
    clear_notifications();

    var confirm_elements = document.getElementsByName("confirm");
    if (confirm_elements.length > 0) {
        var result = await check_confirmation();
        if (!result) return;
    }

    submit();
}

// Page startup logic

async function clear_get_params() {
    window.history.replaceState({}, '', window.location.pathname);
}

async function load_info_message() {
    const params = new URLSearchParams(window.location.search);

    if (params.has("info")) {
        const info_message = params.get("info");

        if (params.has("error")) {
            notify(info_message, true);
        } else {
            notify(info_message, false);
        }

        clear_get_params();
    }
}

async function add_event_listeners() {
    document.getElementsByTagName("form").item(0).addEventListener(
        'submit', 
        submit_form
    );
}

window.onload = function () {
    load_info_message();
    add_event_listeners()
}

// Other functions
async function readCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}