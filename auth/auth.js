const files = require("../files/file.js");
const uuid = require("uuid");
const bcrypt = require("bcrypt-promise");
const rounds = 10;

var get_timestamp = () => + new Date();
const session_length = 60 * 60;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function attempt(target, delay, limit, args) {
    var attempt = 0;
    while (attempt < limit) {
        if (await target(...args)) return true;
        attempts += 1;
        await sleep(delay);
    }
    if (await target(...args)) return true;
    return false;
}

async function get_user_file(id) {
    return "users/" + id + ".json";
}

async function get_user_id(username) {
    const register_json = await files.read("users.json");
    return register_json[username];
}

async function set_user_id(username, user_id) {
    const register_file = await files.init("users.json");
    if (register_file === null) return false;
    register_file.json[username] = user_id;
    await files.save(register_file);
    return true;
}

async function register(username, password) {
    if (await get_user_id(username) != null) return false;

    const user_id = uuid.v4();
    const user_data = await files.init(await get_user_file(user_id));

    if (user_data === null) return false;
    if (user_data.content !== "{}") return false;

    user_data.json = {
        username: username,
        hash: await bcrypt.hash(password, rounds)
    };

    await files.save(user_data);
    return await attempt(set_user_id, 1000, 5, [username, user_id]);
}

async function create_session(user_id) {
    return session_id;
}

async function check_session(session_id) {
    return is_valid;
}

async function delete_session(session_id) {
    return is_valid;
}

async function login(username, password) {
    // Check if user exists
    const user_id = await get_user_id(username);
    if (user_id == null) return false;

    // Check if password is correct
    const user_path = await get_user_file(user_id);
    const user_data = await files.read(user_path);
    const hash = user_data.hash;
    if (!bcrypt.compare(password, hash)) return false;

    const old_session = user_data.session;

}

login("hello", "world").then((result) => console.log(result));