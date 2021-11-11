const files = require("../files/file.js");
const uuid = require("uuid");
const bcrypt = require("bcrypt-promise");
const rounds = 10;

const session_length = 60 * 60;

/* TIME FUNCTIONS */
async function now() {
    return + new Date();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function attempt(target, delay, limit, args) {
    var attempt = 0;
    while (attempt < limit) {
        const result = await target(...args);
        if (result === true) return true;
        if (result === null) return false;
        attempts += 1;
        await sleep(delay);
    }
    return false;
}

/* PATH FUNCTIONS */

async function get_user_file(id) {
    return "users/" + id + ".json";
}

async function get_session_file(id) {
    return "sessions/" + id + ".json"
}

/* USER ID FUNCTIONS */

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

/* SESSION FUNCTIONS */
async function create_session(user_id) {
    if (user_id == null) return false;

    // Initialise file
    const user_file_path = await get_user_file(user_id);
    if (!await files.exists(user_file_path)) return false;
    var user_file = await files.init(user_file_path);
    if (user_file === null) return false;

    // Check if user exists
    if (user_file.json.username === null) return false;

    // If session already exists, invalidate it
    const old_session = user_file.json.session;
    if (await check_session(old_session)) await delete_session(old_session);

    // Generate session id
    const session_id =  uuid.v4();
    user_file.json.session = session_id;
    user_file.json.expiry = await now();

    const session_file_path = await get_session_file(session_id);
    if (await files.exists(session_file_path)) return false;
    var session_file = await files.init(session_file_path);
    if (session_file === null) return false;

    session_file.json.user_id = user_id;
    await files.save(session_file);
    await files.save(user_file);

    return true;
}

async function check_session(session_id) {
    if (session_id == null) return false;

    return is_valid;
}

async function delete_session(session_id) {
    if (session_id == null) return false;

    return is_valid;
}

/* PUBLIC AUTH FUNCTIONS */

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
    const result = await attempt(set_user_id, 1000, 5, [username, user_id]);

    return result;
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
    if (old_session != null) await attempt(delete_session, 1000, 5, [session_id]);


}

/* DEVELOPMENT FUNCTIONS */

async function run() {
    const user_id = await get_user_id("hello");
    const result = await create_session(user_id);
    console.log("Creating session for " + user_id + ": " + result);
}

run();