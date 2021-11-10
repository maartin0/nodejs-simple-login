const fs = require('fs');
const fp = fs.promises;
const dirname = require('path');

var open_files = new Set();

async function get_path(filename) {
    var path = __dirname.split("/");
    path.splice(path.length - 1);
    return path.join("/") + "/data/" + filename;
}

async function try_open(path) {
    if (open_files.has(path)) {
        return false;
    } else {
        open_files.add(path);
        return true;
    }
}

async function close(file) {
    if (open_files.has(file.path)) {
        open_files.delete(file.path);
    }
}

async function ext_exists(filename) {
    try {
        await fp.access(
            await get_path(filename);
        );
        return true;
    } catch {
        return false;
    }
}

async function exists(path) {
    try {
        await fp.access(
            path;
        );
        return true;
    } catch {
        return false;
    }
}


async function init(filename) {
    if (!(await try_open(filename))) return null;

    var file = {
        path: await get_path(filename),
        content: "{}",
        json: {}
    }

    var file = await reload(file);
    return file;
}

async function read(filename) {
    var file = {
        path: await get_path(filename),
        content: "{}",
        json: {}
    }

    var file = await reload(file);
    return file.json;
}

async function reload(file) {
    var file_exists = await exists(file.path);

    if (!file_exists) {
        await save(file);
    } else {
        file.content = await fp.readFile(file.path);
        file.json = JSON.parse(file.content);
    }

    return file;
}

async function save(file) {
    file.content = JSON.stringify(file.json);
    await fp.writeFile(file.path, file.content);
    close(file);
}

module.exports = { 
    init: init,
    reload: reload,
    save: save,
    close: close,
    read: read,
    exists: ext_exists
};