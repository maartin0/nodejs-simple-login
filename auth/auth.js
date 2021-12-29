const files = require('../file');

const crypto = require('crypto');
const bcrypt = require('bcrypt-promise');

const BCRYPT_ROUNDS = 10;
// Session Length: 1 hour
const SESSION_LENGTH_MS = 60 * 60 * 1000;
// OTP Password Expiry Timeout: 5 Minutes
const OTP_LENGTH_MS = 60 * 5 * 1000;

const USER_MAP_FILE_PATH = 'data/users.json';
const EMAIL_MAP_FILE_PATH = 'data/emails.json';
const OTP_MAP_FILE_PATH = 'data/otps.json';

const now = async () => Date.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getExpiry = async () => ((await now()) + SESSION_LENGTH_MS);
const hasExpired = async (timestamp) => ((await now()) > timestamp);

const getOTPExpiry = async () => ((await now()) + OTP_LENGTH_MS);

const uuid = async () => crypto.randomUUID();

const getUserFilePath = async (userID) => `data/users/${userID}.json`;
const getSessionFilePath = async (sessionID) => `data/sessions/${sessionID}.json`;

async function getUserFile(userID, create=false) {
    if (userID == null) return;
    const userFilePath = await getUserFilePath(userID);
    if (!create && !await files.exists(userFilePath)) return;
    return await files.init(userFilePath);
}

async function getUserData(userID) {
    if (userID == null) return;
    const userFilePath = await getUserFilePath(userID);
    if (!await files.exists(userFilePath)) return;
    return await files.read(userFilePath);
}

async function getSessionFile(sessionID, create=false) {
    if (sessionID == null) return;
    const sessionFilePath = await getSessionFilePath(sessionID);
    if (!create && !await files.exists(sessionFilePath)) return;
    return await files.init(sessionFilePath);
}

async function getSessionData(sessionID) {
    if (sessionID == null) return;
    const sessionFilePath = await getSessionFilePath(sessionID);
    if (!await files.exists(sessionFilePath)) return;
    return await files.read(sessionFilePath);
}

async function getFileData(path) {
    if (!await files.exists(path)) {
        const file = await files.init(path);
        await files.close(file);
        return file.json;
    }

    return await files.read(path);
}

const getEmailFile = async () => await files.init(EMAIL_MAP_FILE_PATH);
const getEmailData = async () => await getFileData(EMAIL_MAP_FILE_PATH);

const getMapFile = async () => await files.init(USER_MAP_FILE_PATH);
const getMapData = async () => await getFileData(USER_MAP_FILE_PATH);

const getOTPFile = async () => await files.init(OTP_MAP_FILE_PATH);
const getOTPData = async () => await getFileData(OTP_MAP_FILE_PATH);

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
    if (username == null) return;

    const mapData = await getMapData();
    if (mapData == null) return;
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
    if (userID == null) return;
    
    const userData = await getUserData(userID);
    if (userData == null) return;

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
    if (userID == null) return;

    const userData = await getUserData(userID);
    if (userData == null) return;
    
    const valid = await checkSession(userData.session);
    if (valid) return userData.session;

    // If stored session is valid, return it, otherwise create a new session.

    const createSuccess = await createSession(userID);
    if (!createSuccess) return;

    const newUserData = await getUserData(userID);
    if (newUserData == null) return;
    
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

async function checkPassword(userID, password) {
    const userData = await getUserData(userID);
    if (userData == null) return false;
    const hash = userData.hash;
    if (hash == null) return false;
    
    return await bcrypt.compare(password, hash);
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
        hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
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
    
    if (!await bcrypt.compare(password, hash)) return false;

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
    if (sessionID == null) return;

    const sessionData = await getSessionData(sessionID);
    if (sessionData == null) return;

    return sessionData.userID;
}

async function getUserEmail(userID) {
    if (userID == null) return;

    const userData = await getUserData(userID);
    if (userData == null) return;
    
    return userData.email;
}

async function setUserEmail(userID, email) {
    if (userID == null) return false;

    const emailData = await getEmailData();
    if (emailData == null) return false;

    // If account with that email already exists, exit
    if (emailData[email] != null) return false;

    const userFile = await getUserFile(userID);
    if (userFile == null) return false;
    
    const emailFile = await getEmailFile();
    if (emailFile == null) return false;

    const oldEmail = await getUserEmail(userID);

    if (oldEmail != null && oldEmail !== '') {
        emailFile.json[oldEmail] = undefined;
    }

    userFile.json.email = email;
    emailFile.json[email] = userID;

    await files.save(userFile);
    await files.save(emailFile);

    return true;
}

async function getUserIDFromEmail(email) {
    if (email == null) return;

    const emailData = await getEmailData();
    if (emailData == null) return;

    return emailData[email];
}

async function createOTP(userID) {
    if (userID == null) return;

    const otpFile = await getOTPFile();
    if (otpFile == null) return false;

    const userFile = await getUserFile(userID);;
    if (userFile == null) { 
        files.close(otpFile);
        return false;
    }

    const oldPsk = userFile.json.otp;

    if (oldPsk != null) {
        otpFile.json[oldPsk] = undefined;
    }

    const psk = await uuid();

    userFile.json.otp = psk;
    userFile.json.otpExpiry = await getOTPExpiry();

    otpFile.json[psk] = userID;

    await files.save(userFile);
    await files.save(otpFile);

    return true;
}

async function getOTP(userID) {
    if (userID == null) return;

    const result = await attempt(createOTP, 200, 10, [userID]);
    if (!result) return;

    const userData = await getUserData(userID);
    if (userData == null) return false;

    return userData.otp;
}

async function verifyOTP(otp) {
    if (otp == null) return;

    const otpData = await getOTPData();
    if (otpData == null) return;

    const userID = otpData[otp];
    if (userID == null) return;

    const userData = await getUserData(userID);
    if (userData == null) return;

    const expiry = userData.otpExpiry;
    if (expiry == null) return;

    const expired = await hasExpired(expiry);
    const userFile = await getUserFile(userID);
    if (userFile == null) return;

    userFile.json.otp = undefined;
    userFile.json.otpExpiry = undefined;

    await files.save(userFile);

    const otpFile = await getOTPFile();
    if (otpFile == null) return;

    otpFile.json[otp] = undefined;
    
    await files.save(otpFile);

    return userID;
}

module.exports = {
    entry: {
        login,
        register,
    },
    session: {
        fetch: getSession,
        remove: deleteSession,
        verify: checkSession,
    },
    otp: {
        fetch: getOTP,
        verify: verifyOTP,   
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
            idFromEmail: getUserIDFromEmail,
        },
    },
    compare: checkPassword,
}