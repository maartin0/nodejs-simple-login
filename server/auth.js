// Import crypto library for sha 256 hashing
var crypto = require('crypto');
// Import FS library for file management and reading and writing from JSON files
var fs = require('fs');
// Import UUID for random UUIDs for session tokens, salts and User IDs
var uuid = require('uuid');

// Constants
const credentials_path = "credentials/auth.json";

// Credentials
var credentials;
var credentials_file;

function reload_credentials() {
    credentials_file = fs.readFileSync(credentials_path);
    credentials = JSON.parse(credentials_file);
}

function save_credentials() {
    const credentials_string = JSON.stringify(credentials);
    fs.writeFileSync(credentials_path, credentials_string);
}

reload_credentials()

// Cryptographic Algorithms
function sha_256(value) {
    return crypto.createHash('sha256').update(value).digest('base64');
}

function generate_salt() {
    const result = uuid.v4() + uuid.v4() + uuid.v4() + uuid.v4();
    return result;
}

function salt_string(to_salt, salt) {
    var i;
    var result = '';

    const min_length = Math.min(to_salt.length, salt.length);

    for (i = 0; i < min_length; i++) {
        result += to_salt[i] + salt[i];
    }
    
    return result + to_salt.slice(i) + salt.slice(i);
}

function hash_and_salt_string(value, salt) {
    const salted_psk = salt_string(value, salt);
    return sha_256(salted_psk);
}

// Miscelaneous Methods
function get_unix_time() {
    return (+ new Date());
}

function is_integer(value) {
  return !isNaN(value) && 
         parseInt(Number(value)) == value && 
         !isNaN(parseInt(value, 10));
}

// Authentication Functions
function register(user, psk) {
    // Function that registers a new user on the system with the new username and password.
    // The password should already be hashed with sha 256 by the client.
    // Returns true on success, or false if there's another error.
    // You should check if the user exists using the other function before running this method.
    // If this method returns false, you should give the user an unknown error message.
    
    if (user_exists(user)) return false;

    const new_salt = generate_salt()
    const new_psk = hash_and_salt_string(psk, new_salt);
    const new_id = uuid.v4();

    credentials.user_map[user] = new_id;

    credentials.auth_map[new_id] = {
        "psk": new_psk,
        "salt": new_salt
    };

    save_credentials();
    return true;
}

function login(user, psk) {
    // Function that takes an attempted user and password 
    // - password should already be hashed with sha 256 once by the client.
    // user_exists should be ran before running this function to return to the user the relevant error.
    // A boolean is returned on success or failure.
    // If false is returned assume the password is incorrect.
    
    if (!user_exists(user)) return false;

    const user_id = credentials.user_map[user];

    var auth_user = credentials.aut_map[user_id];

    const stored_psk = auth_user.psk;
    const salt = auth_user.salt;

    const calculated_psk = hash_and_salt_string(psk, salt);

    if (stored_psk != calculated_psk) return false;
    
    if (get_session(user) == null) return false;
    return true;
}

function create_session(user_id) {
    const session_id = uuid.v4();

    credentials.auth_map[user_id].session = session_id;

    credentials.session_map[session_id] = {
        "expiration": (get_unix_time() + (60 * 60 * 1000)).toString(),
        "user_id": user_id
    }
    
    save_credentials();
    return session_id;
}

function get_session(user) {
    // Function that gets the current session key for a user, 
    // if none is valid, it will generate a new one, 
    // if the user doesn't exist it'll return null;
    
    if (!user_exists(user)) return null;

    const user_id = credentials.user_map[user];

    // Check user has session id
    if ("session" in credentials.auth_map[user_id]) {
        const session_id = credentials.auth_map[user_id].session;
        // Check if session has linked expiration value
        if ("expiration" in credentials.session_map[session_id]) {
            const expiration = credentials.session_map[session_id].exipration;
            // Confirm expiration is valid integer, and hasn't expired yet
            if (is_integer(expiration) && parseInt(user_credentials.expiration) >= get_unix_time()) {
                return session_id;
            }
        }
    }

    return create_session(user_id);
}

function session(session_id) {
    // Function that checks if a session key is valid, returns the user id
}

function user_exists(user) {
    return user in credentials.user_map;
}

// const result = register("yay", "this is clearly hashed lol");
// const result = login("yay", "this is clearly hashed lol");
const result = get_session("yay");
console.log(result);