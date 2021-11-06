const files = require("../files/file.js");
const uuid = require("uuid").v4;
const bcrypt = require("bcrypt-promise");
const rounds = 10;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function attempt(target, delay, limit, args) {
    var attempt = 0;
    while (attempts < limit) {
        if (await target()) return true;
        attempts += 1;
        await sleep(delay);
    }
    if (await target(...args)) return true;
    return false;
}

async function get_user_id(username) {
    const register_json = await files.read("registered_users.json");
    return register_json[username];
}

async function set_user_id(username, user_id) {
    const register_file = await files.init("registered_users.json");
    if (register_file === null) return false;
    register_file.json[username] = user_id;
    files.save(register_file);
    return true;
}

async function register(username, password) {
    if (get_user_id(username) != null) return false;
    const user_id = uuid();

    const user_data = await files.init(uuid + ".json");
    if (user_data === null) return false;
    if (user_data.content !== "{}") return false;

    user_data.json = {
        username: username,
        hash: await bcrypt.hash(password, rounds)
    };

    await files.save(user_data);

    return await attempt(set_user_id, 1000, 5, [username, user_id]);
}

async function login(username, password) {
    const auth_file = await files.init("auth.json");
    const hash = auth_file.json[username];
    const result = await bcrypt.compare(password, hash);
    console.log(result);

    return result; 
}

async function user_exists(user) {

}

register("hello", "world");