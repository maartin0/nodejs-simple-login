const files = require('../file');

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

const getUserFilePath = async (userID) => `users/${userID}.json`;
const getSessionFilePath = async (sessionID) => `sessions/${sessionID}.json`;

async function getUserFile(userID, create=false) {
    if (userID == null) return null;
    const userFilePath = await getUserFilePath(userID);
    if (!create && !await files.exists(userFilePath)) return null;
    return await files.init(userFilePath);
}

async function getUserData(userID) {
    if (userID == null) return null;
    const userFilePath = await getUserFilePath(userID);
    if (!await files.exists(userFilePath)) return null;
    return await files.read(userFilePath);
}

async function getSessionFile(sessionID, create=false) {
    if (sessionID == null) return null;
    const sessionFilePath = await getSessionFilePath(sessionID);
    if (!create && !await files.exists(sessionFilePath)) return null;
    return await files.init(sessionFilePath);
}

async function getSessionData(sessionID) {
    if (sessionID == null) return null;
    const sessionFilePath = await getSessionFilePath(sessionID);
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

const getMapFile = async () => await files.init(USER_MAP_FILE_PATH);

async function attempt(target, delay, limit, args) {
    let attempt = 0;
    while (attempt < limit) {
        const result = await target(...args);
        if (result === true) return true;
        if (result === null) break;
        attempt += 1;
        await sleep(delay);
    }

    argString = args.join(", ");
    console.error(`Failed to run function ${target.name} with args ${argString}.`);
    return false;
}

async function getUserID(username) {
    if (username == null) return null;

    const mapData = await getMapData();
    if (mapData == null) return null;
    return mapData[username];
}

async function setUserID(username, userID) {
    if (username == null) return false;

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
    
    const userData = await getUserData(userID);
    if (userData == null) return false;

    // Check if user exists
    if (userData.username == null) return false;

    // If session already exists, invalidate it
    if (userData.session != null) await deleteSession(userData.session);

    // Open writable file
    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    const sessionID = await uuid();
    userFile.json.session = sessionID;
    userFile.json.expiry = await getExpiry();

    const sessionFile = await getSessionFile(sessionID, true);
    if (sessionFile == null) {
        files.close(userFile);
        return false;
    }

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
    if (valid) return userData.session;

    // If stored session is valid, return it, otherwise create a new session.

    const createSuccess = await createSession(userID);
    if (!createSuccess) return null;

    const newUserData = await getUserData(userID);
    if (newUserData == null) return null;
    
    return newUserData.session;
}

async function checkSession(sessionID) {
    if (sessionID == null) return false;

    const sessionData = await getSessionData(sessionID);
    if (sessionData == null) return false;

    const userData = await getUserData(sessionData.userID);
    if (userData == null) return false;

    if (userData.expiry == null) return false;
    
    if (await hasExpired(userData.expiry)) {
        await deleteSession(sessionID);
        return false;
    }

    return true;
}

async function deleteSession(sessionID) {
    if (sessionID == null) return false;
    
    const sessionData = await getSessionData(sessionID);
    if (sessionData == null) return false;

    if (sessionData.userID == null) return false;

    const userData = await getUserData(sessionData.userID);
    if (userData == null) return false;
    if (userData.session !== sessionID) return false;

    const userFile = await getUserFile(sessionData.userID);
    if (userFile == null) return false;

    userFile.json.session = undefined;
    userFile.json.expiry = undefined;

    await files.save(userFile);
    await files.remove(
        await getSessionFilePath(sessionID)
    );

    return true;
}

/* PUBLIC AUTH FUNCTIONS */

async function register(username, password) {
    if (username == null || password == null) return false;

    // If user already exists, exit
    if (await getUserID(username) != null) return false;

    const userID = await uuid();
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

    return await createSession(userID);
}

/* ACCOUNT FUNCTIONS */

async function deleteAccount(userID) {
    if (userID == null) return false;

    const userData = await getUserData(userID);
    if (userData == null) return false;

    // Check if user exists
    if (userData.username == null) return false;

    // Delete any remaining session
    if (userData.session != null) await deleteSession(userData.session);
    
    await files.remove(
        await getUserFilePath(userID)
    );

    return await attempt(setUserID, 200, 10, [userData.username, undefined]);
}

async function modifyUsername(userID, newUsername) {
    if (userID == null || newUsername == null) return false;

    // If user with that name already exists, exit
    if (await getUserID(newUsername) != null) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    const removeResult = await attempt(setUserID, 200, 10, [userFile.json.username, undefined]);
    if (!removeResult) return false;

    userFile.json.username = newUsername;
    await files.save(userFile);

    return await attempt(setUserID, 200, 10, [newUsername, userID]);
}

async function modifyPassword(userID, newPassword) {
    if (userID == null || newPassword == null) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    userFile.json.hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await files.save(userFile);

    return true;
}

async function getUserIDFromSession(sessionID) {
    if (sessionID == null) return null;

    const sessionData = await getSessionData(sessionID);
    if (sessionData == null) return null;

    return sessionData.userID;
}

async function getUserEmail(userID) {
    if (userID == null) return null;

    const userData = await getUserData(userID);
    if (userData == null) return null;
    
    return userData.email;
}

async function setUserEmail(userID, email) {
    if (userID == null) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;

    userFile.json.email = email;

    await files.save(userFile);
    return true;
}

module.exports = {
    entry: {
        login: login,
        register: register,
    },
    session: {
        fetch: getSession,
        remove: deleteSession,
        verify: checkSession,
    },
    account: {
        remove: deleteAccount,
        modify: {
            username: modifyUsername,
            password: modifyPassword,
            email: setUserEmail,
        },
    },
    fetch: {
        user: {
            id: getUserID,
            name: getUserName,
            email: getUserEmail,
            idFromSession: getUserIDFromSession,
        },
    },
}
