const files = require("../files/file.js");

const bcrypt = require("bcrypt-promise");
const rounds = 10;

// The below functions do no checking of user data.

async function register(username, password) {
    const auth_file = await files.init("auth.json");
    const hash = await bcrypt.hash(password, rounds);
    auth_file.json[username] = hash;
    await files.save(auth_file);
}

async function login(username, password) {
    const auth_file = await files.init("auth.json");
    const hash = auth_file.json[username];
    const result = await bcrypt.compare(password, hash);
    console.log(result);

    return result; 
}

// The below functions are designed to be run from user input, and check first. The return result is success (bool)

async function user_register(username, password) {

}