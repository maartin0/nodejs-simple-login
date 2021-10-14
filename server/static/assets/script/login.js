window.onload = function () {
    const params = new URLSearchParams(window.location.search);

    if (params.has("info")) {
        var obj = document.getElementById("info-message");
        obj.innerHTML = params.get("info");

        if (params.has("error")) {
            obj.style.color = "red";
        }
    }
}