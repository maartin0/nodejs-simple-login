const fs = require('fs');
const fp = fs.promises;

var path;
var file;
var content;

var default_json = {};

async function load(input_path, default_content) {
    path = input_path;
    default_json = default_content;

    await reload();
}

async function create_default() {
    await fp.writeFile(path, JSON.stringify(default_json));
}

async function reload() {
    try {
        content = await fp.readFile(path);
    } catch {
        await create_default();
        reload();
    }
}

async function save() {
    await fp.writeFile(path, JSON.stringify(content));
}

module.exports = {
    init: load,
    reload: reload,
    save: save,
    json: content
}