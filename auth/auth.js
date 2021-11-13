const files = require('../files/file');

const crypto = require('crypto');
const bcrypt = require('bcrypt-promise');

const BCRYPT_ROUNDS = 10;
const SESSION_LENGTH_MS = 60 * 60 * 1000;
const USER_MAP_FILE_PATH = 'users.json';

const now = async () => Date.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getExpiry = async () => ((await now()) + SESSION_LENGTH_MS);
const hasExpired = async (timestamp) => ((await now()) > timestamp);

const uuid = async () => crypto.randomUUID();

const getUserFilePath = async (userID) => 'users/$(userID).json';
const getSessionFilePath = async (sessionID) => 'sessions/$(sessionID).json';

async function getUserFile(userID, create=false) {
    const userFilePath = await getUserFilePath(userID);
    if (!create && !await files.exists(userFilePath)) return null;
    return await files.init(userFilePath);
}

async function getUserData(userID) {
    const userFilePath = await getUserFilePath(userID);
    if (!await files.exists(userFilePath)) return null;
    return await files.read(userFilePath);
}

async function getSessionFile(sessionID, create=false) {
    const sessionFilePath = await getSessionFilePath(userID);
    if (!create && !await files.exists(sessionFilePath)) return null;
    return await files.init(sessionFilePath);
}

async function getSessionData(sessionID) {
    const sessionFilePath = await getSessionFilePath(userID);
    if (!await files.exists(sessionFilePath)) return null;
    return await files.read(sessionFilePath);
}

async function getMapData() {
    if (!await files.exists(USER_MAP_FILE_PATH)) {
        const userFile = await getMapFile();
        await files.close(userFile);
        return userFile.json;
    }

    return await files.read(USER_MAP_FILE_PATH);
}

const getMapFile () => await files.init(USER_MAP_FILE_PATH);

async function attempt(target, delay, limit, args) {
    let attempt = 0;
    while (attempt < limit) {
        const result = await target(...args);
        if (result === true) return true;
        if (result === null) break;
        attempts += 1;
        await sleep(delay);
    }

    argString = args.join(", ");
    console.error("Failed to run function $(target.name) with args $(argString).");
    return false;
}

async function getUserID(username) {
    if (username == null) return null;

    const mapData = await getMapData();
    if (mapData == null) return null;
    return registerJSON[username];
}

async function setUserID(username, userID) {
    if (username == null || userID == null) return false;

    const mapFile = await getMapFile();
    if (mapFile == null) return false;
    mapFile.json[username] = userID;
    await files.save(mapFile);

    return true;
}

async function getUserName(userID) {
    if (userID == null) return null;
    
    const userData = await getUserData(userID);
    if (userData == null) return null;

    return userData.username;
}

/* SESSION FUNCTIONS */

async function createSession(userID) {
    if (userID == null) return false;
    
    let userData = await getUserData(userID);
    if (userData == null) return false;

    // Check if user exists
    if (userData.username == null) return false;

    // If session already exists, invalidate it
    if (userData.session != null) {
        await deleteSession(userData.session);
    }

    // Previous user file was read only to prevent collision with deleteSession function.
    let userFile = await getUserFile(userID);
    if (userFile == null) return false;

    // Generate session id
    userFile.json.session = await uuid();
    userFile.json.expiry = await getExpiry();
    
    let sessionFile = await getSessionFile(sessionID);
    if (sessionFile == null) return false;

    sessionFile.json.userID = userID;
    await files.save(sessionFile);
    await files.save(userFile);

    return true;
}

async function getSession(userID) {
    if (userID == null) return null;

    const userData = await getUserData(userID);
    if (userData == null) return null;
    
    const valid = await checkSession(userData.session);
    if (valid) return sessionID;

    // If stored session is valid, return it, otherwise create a new session.

    const createSuccess = await createSession(userID);
    if (!createSuccess) return null;

    const newUserData = await getUserData(userID);
    if (newUserData == null) return null;

    const newValid = await checkSession(userFile.session);
    if (newValid) return userFile.session;

    return null;
}

async function checkSession(sessionID) {
    if (sessionID == null) return false;

    let sessionData = await getSessionData(sessionID);
    if (sessionData == null) return false;

    const userData = await getUserData(sessionData.userID);
    if (userData == null) return false;

    if (userData.expiry == null) return false;
    
    if (await has_expired(userData.expiry)) {
        await deleteSession(sessionID);
        return false;
    }

    return true;
}

async function deleteSession(sessionID) {
    if (sessionID == null) return false;
    
    const sessionData = await getSessionData(sessionID);
    if (sessionData == null) return false;

    if (sessionFile.userID == null) return false;

    const userData = await getUserData(sessionFile.userID);
    if (userData == null) return false;
    if (userData.session !== sessionID) return false;

    const userFile = await getUserFile(sessionFile.userID);
    if (userFile == null) return false;

    userFile.json.session = undefined;
    userFile.json.expiry = undefined;

    await files.save(userFile);
    await files.delete_file(
        await getSessionFilePath(sessionID)
    );

    return true;
}

/* PUBLIC AUTH FUNCTIONS */

async function register(username, password) {
    if (username == null || password == null) return false;

    // If user already exists, exit
    if (await getUserID(username) != null) return false;

    const userID = uuid();
    const userFile = await getUserFile(userID, true);
    if (userFile == null) return false;
    if (userFile.content !== '{}') return false;

    userFile.json = {
        username: username,
        hash: await bcrypt.hash(password, BCRYPT_ROUNDS)
    };

    await files.save(userFile);

    return await attempt(setUserID, 200, 10, [username, userID]);
}

async function login(username, password) {
    if (username == null || password == null) return false;

    const userID = await getUserID(username);
    if (userID == null) return false;

    // Check if password is correct
    const userData = await getUserData(userID);
    const hash = userData.hash;

    if (!bcrypt.compare(password, hash)) return false;

    if (userData.session != null) await deleteSession(userData.session);

    return true;
}

/* ACCOUNT FUNCTIONS */

async function delete_account(userID) {
    if (userID == null) return false;

    const userData = await getUserData(userID);
    if (userData == null) return false;

    // Check if user exists
    if (userData.username == null) return false;

    if (userData.session != null) await deleteSession(userData.session);
    
    await files.delete_file(
        await getUserFilePath(userID);
    );

    const mapResult = await attempt(setUserID, 200, 10, [userData.username, undefined]);

    return mapResult;
}

async function modify_username(userID, newUsername) {
    if (userID == null || newUsername == null) return false;

    // If user with that name already exists, exit
    if (await getUserID(newUsername) != null) return false;

    const userData = await getUserData(userID);
    if (userData == null) return false;

    // Exit if username isn't different
    if (userData.username === newUsername) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    const removeResult = await attempt(setUserID, 200, 10, [userFile.json.username, undefined]);
    if (!removeResult) return false;

    userFile.json.username = newUsername;
    await files.save(userFile);

    const addResult = await attempt(setUserID, 200, 10, [newUsername, userID]);

    return addResult;
}

async function modify_password(userID, newPassword) {
    if (userID == null || newPassword == null) return false;

    const userData = await getUserData(userID);
    if (userData == null) return false;

    // Check if passwords are the same
    if (await bcrypt.compare(newPassword, userData.hash)) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    userFile.json.hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await files.save(userFile);

    return true;
}

module.exports = {
    entry: {
        login: login,
        register: register
    },
    session: {
        fetch: getSession,
        remove: deleteSession,
        verify: checkSession
    },
    account: {
        remove: delete_account,
        modify: {
            username: modify_username,
            password: modify_password
        }
    },
    fetch: {
        user: {
            id: getUserID,
            name: getUserName
        }
    }
}
