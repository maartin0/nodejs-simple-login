// Import crypto library for sha 256 hashing
var crypto = require('crypto');
// Import FS library for file management and reading and writing from JSON files
var fs = require('fs');
// Import UUID for random UUIDs for session tokens, salts and User IDs
import { v4 as uuidv4 } from 'uuid';

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

function put_credentials(key0, key1, value) {
    credentials[key0][key1] = value;
    save_credentials();
}

function get_credentials(key0, key1) {
    return credentials[key0][key1];
}

reload_credentials()

// Cryptographic Algorithms
function sha_256(value) {
    return crypto.createHash('sha256').update(value).digest('base64');
}

// External Functions
function register(user, psk) {
    
}

function login(user, psk) {
    // Function that takes an attempted user and password.
    // A boolean is returned
    
}

function get_session(user) {
    // Function that gets the current session key for a user, 
    // if none is valid, it will generate a new one, 
    // if the user doesn't exist it'll return null;
}

function session(key) {
    // Function that checks if a session key is valid, returns a boolean.
}