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

// External Functions
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

    credentials[user] = {};
    
    credentials[user].psk = new_psk;
    credentials[user].id = new_id;
    credentials[user].salt = new_salt;

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

    const stored_psk = credentials[user].psk;
    const salt = credentials[user].salt;

    const calculated_psk = hash_and_salt_string(psk, salt);

    if (stored_psk != calculated_psk) return false;
    
    get_session(user);
    return true;
}

function get_session(user) {
    // Function that gets the current session key for a user, 
    // if none is valid, it will generate a new one, 
    // if the user doesn't exist it'll return null;
    
}

function session(key) {
    // Function that checks if a session key is valid, returns the user id
}

function user_exists(user) {
    return user in credentials;
}

// const result = register("yay", "this is clearly hashed lol");
const result = login("yay", "this is clearly hashed lol");
console.log(result);