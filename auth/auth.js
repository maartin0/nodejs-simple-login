const files = require("../files/file.js");
const uuid = require("uuid");

const bcrypt = require("bcrypt-promise");
const rounds = 10;

// Session length in ms (Default: 1 hour)
const session_length = 60 * 60 * 1000;

/* TIME FUNCTIONS */
async function now() {
    return + new Date();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function has_expired(check) {
    const cur = await now();
    console.log("Current epoch: " + cur);
    console.log("Supplied: " + check);
    const result = check > cur;
    console.log("Is invalid: " + result);
    return result;
}

async function get_expiry() {
    return (await now()) + session_length;
}

/* Attempt function used for registering. Required in case of concurrent modification of the user - id map file. */

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

/* MISC FUNCTIONS */

async function init() {
    var users_file = await files.init("users.json");
    await files.close(users_file);
}

/* PATH & FILE FUNCTIONS */

async function get_user_file_path(id) {
    return "users/" + id + ".json";
}

async function get_session_file_path(id) {
    return "sessions/" + id + ".json"
}

async function init_user_file(id) {
    const user_file_path = await get_user_file_path(id);
    if (!await files.exists(user_file_path)) return null;
    return await files.init(user_file_path);
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

    const user_file_path = await get_user_file_path(user_id);
    if (!files.exists(user_file_path)) return false;
    var user_data = await files.read(user_file_path);
    if (user_data === null) return false;

    // Check if user exists
    if (user_data.username === null) return false;

    // If session already exists, invalidate it
    const old_session = user_data.session;
    if (old_session != null) {
        const r = await delete_session(old_session);
    };

    // Previous user file was read only to prevent collision with delete_session function.
    var user_file = await init_user_file(user_id);
    if (user_file === null) return false;

    // Generate session id
    const session_id = uuid.v4();
    user_file.json.session = session_id;
    user_file.json.expiry = await get_expiry();
    
    const session_file_path = await get_session_file_path(session_id);
    if (await files.exists(session_file_path)) return null;
    var session_file = await files.init(session_file_path);
    if (session_file === null) return false;

    session_file.json.user_id = user_id;
    await files.save(session_file);
    await files.save(user_file);

    return true;
}

async function get_session(user_id) {
    console.count("Get");
    if (user_id == null) return null;

    const user_file_path = await get_user_file_path(user_id);
    if (!await files.exists(user_file_path)) return null;
    console.count("Get");

    var user_file = await files.read(user_file_path);
    if (user_file === null) return null;
    console.count("Get");

    const session_id = user_file.session;
    const valid = await check_session(session_id);
    console.count("Get");
    console.log(session_id);

    if (valid) return session_id;
    console.count("Get");

    const success = await create_session(user_id);
    if (!success) return null;
    console.count("Get");

    user_file = await files.read(user_file_path);
    console.count("Get");
    console.log(user_file);

    const new_session_id = user_file.session;
    const new_valid = await check_session(new_session_id);
    console.count("Get");
    console.log(new_session_id);

    if (valid) return new_session_id;
    console.count("Get");
    return null;
}

async function check_session(session_id) {
    console.count("Check");
    if (session_id == null) return false;

    const session_file_path = await get_session_file_path(session_id);
    if (!files.exists(session_file_path)) return false;
    console.count("Check");

    var session_file = await files.read(session_file_path);
    if (session_file === null) return false;
    console.count("Check");

    const user_id = session_file.user_id;
    if (user_id == null) return false;
    console.count("Check");
    
    const user_file_path = await get_user_file_path(user_id);
    if (!await files.exists(user_file_path)) return null;
    console.count("Check");
    var user_file = await files.read(user_file_path);

    const expiry = user_file.expiry;
    if (expiry == null) return false;
    console.count("Check");
    
    if (await has_expired(expiry)) {
        // await delete_session(session_id);
        return false;
    }
    console.count("Check");

    return true;
}

async function delete_session(session_id) {
    if (session_id == null) return false;

    const session_file_path = await get_session_file_path(session_id);
    if (!files.exists(session_file_path)) return false;

    var session_file = await files.read(session_file_path);
    if (session_file === null) return false;

    const user_id = session_file.user_id;
    if (user_id == null) return false;

    const user_file = await init_user_file(user_id);
    if (user_file === null) return false;

    if (user_file.json.session === session_id) {
        user_file.json.session = undefined;
        user_file.json.expiry = undefined;
        await files.save(user_file);
    } else {
        await files.close(user_file);
        return false;
    }

    await files.delete_file(session_file_path);

    return true;
}

/* PUBLIC AUTH FUNCTIONS */

async function register(username, password) {
    if (await get_user_id(username) != null) return false;

    const user_id = uuid.v4();
    const user_data = await files.init(await get_user_file_path(user_id));

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
    const user_path = await get_user_file_path(user_id);
    const user_data = await files.read(user_path);
    const hash = user_data.hash;
    if (!bcrypt.compare(password, hash)) return false;

    const old_session = user_data.session;
    if (old_session != null) await delete_session(old_session);

    const session_result = await create_session(user_id);
    if (!session_result) return false;

    return true;
}

/* DEVELOPMENT FUNCTIONS */

async function dregister() {
    const register_result = await register("hello", "world");
    console.log("Register " + register_result);
}

async function dlogin() {
    const login_result = await login("hello", "world");
    console.log("Login " + login_result);
}

async function duser() {
    const user_id = await get_user_id("hello");
    console.log("User ID: " + user_id);
    return user_id;
}

async function dcheck() {
    const session_id = "0936b522-8d63-4e30-80d0-ae4c0dc39c8c";
    const session_validity = await check_session(session_id);
    console.log("Session Valid: " + session_validity);
}

async function dcreate() {
    const user_id = "b8592813-16e0-4b17-9967-61c57ec602e3";
    const session_success = await create_session(user_id);
    console.log("Create Success: " + session_success);
}

async function dget() {
    const session_id = await get_session(user_id);
    console.log("Session ID: " + session_id);
}

async function run() {
    await init();   

    await dcheck();
}

run();


// UNCOMMENT 118 DELETE TEMPORARY ONLY