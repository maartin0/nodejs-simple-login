const fs = require('fs').promises;

const openFiles = new Set();

async function getPath(filename) {
    const path = __dirname.split('/');
    path.splice(path.length - 1);
    return path.join('/') + '/' + filename;
}

async function attemptOpen(path) {
    if (openFiles.has(path)) {
        return false;
    } else {
        openFiles.add(path);
        return true;
    }
}

async function close(file) {
    return openFiles.delete(file.path);
}

async function fileExists(filename) {
    try {
        await fs.access(
            await getPath(filename)
        );
        return true;
    } catch {
        return false;
    }
}

async function pathExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

 

async function read(filename) {
    if (filename == null) return false;
    
    const file = {
        path: await getPath(filename)
    }
    
    if (!await pathExists(file.path)) return null;

    file.content = await fs.readFile(file.path);
    file.json = JSON.parse(file.content);
    
    return file.json;
}

async function reload(file) {
    const fileExists = await pathExists(file.path);

    if (!fileExists) {
        await save(file);
    } else {
        file.content = await fs.readFile(file.path);
        file.json = JSON.parse(file.content);
    }

    return file;
}

async function remove(filename) {
    const path = await getPath(filename);
    if (openFiles.has(path)) return false;
    await fs.rm(path);
    return true;
}

async function save(file) {
    file.content = JSON.stringify(file.json);
    await fs.writeFile(file.path, file.content);
    await close(file);
}

module.exports = { 
    init,
    reload,
    save,
    close,
    read,
    remove,
    exists: fileExists,
};