async function sha256(string) {
    const bit_arr = sjcl.hash.sha256.hash(string);
    return sjcl.codec.hex.fromBits(bit_arr);
}

async function notify(string, is_error) {
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

        element.children[0].style.opacity = '0';

        setTimeout(function () { element.remove() }, 500);
    }

    document.getElementById("notifications").appendChild(container);
}

window.onload = function () {
    const params = new URLSearchParams(window.location.search);

    if (params.has("info")) {
        const info_message = params.get("info");

        if (params.has("error")) {
            notify(info_message, true);
        } else {
            notify(info_message, false);
        }

        // Remove params from URL
        window.history.replaceState({}, 'Register/Login', window.location.pathname)
    }

}