const fs = require('fs');
const fp = fs.promises;
const dirname = require('path');

async function get_path(filename) {
    var path = __dirname.split("/");
    path.splice(path.length - 1);
    return path.join("/") + "/data/" + filename;
}


async function init(filename) {
    var file = {
        path: await get_path(filename),
        content: "{}",
        json: {}
    }

    var file = await reload(file);
    return file;
}

async function reload(file) {
    var file_exists = true;
    
    try {
        await fp.access(file.path);
    } catch {
        file_exists = false;
    }

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

    return file;
}

module.exports = { 
    init: init,
    reload: reload,
    save: save
};