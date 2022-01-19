const crypto = require('crypto');
const bcrypt = require('bcrypt-promise');
const files = require('../file');

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

async function getUserFile(userID, create = false) {
  if (!userID) return;
  const userFilePath = await getUserFilePath(userID);
  if (!create && !await files.exists(userFilePath)) return;
  return files.init(userFilePath);
}

async function getUserData(userID) {
  if (!userID) return;
  const userFilePath = await getUserFilePath(userID);
  if (!await files.exists(userFilePath)) return;
  return files.read(userFilePath);
}

async function getSessionFile(sessionID, create = false) {
  if (!sessionID) return;
  const sessionFilePath = await getSessionFilePath(sessionID);
  if (!create && !await files.exists(sessionFilePath)) return;
  return files.init(sessionFilePath);
}

async function getSessionData(sessionID) {
  if (!sessionID) return;
  const sessionFilePath = await getSessionFilePath(sessionID);
  if (!await files.exists(sessionFilePath)) return;
  return files.read(sessionFilePath);
}

async function getFileData(path) {
  if (!await files.exists(path)) {
    const file = await files.init(path);
    await files.close(file);
    return file.json;
  }

  return files.read(path);
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

  argString = args.join(', ');
  console.error(`Failed to run function ${target.name} with args ${argString}.`);
  return false;
}

async function getUserID(username) {
  if (!username) return;

  const mapData = await getMapData();
  if (!mapData) return;
  return mapData[username];
}

async function setUserID(username, userID) {
  if (!username) return false;

  const mapFile = await getMapFile();
  if (!mapFile) return false;

  mapFile.json[username] = userID;
  await files.save(mapFile);

  return true;
}

async function getUserUsername(userID) {
  if (!userID) return;

  const userData = await getUserData(userID);
  if (!userData) return;

  return userData.username;
}

async function getUserName(userID) {
  if (!userID) return;

  const userData = await getUserData(userID);
  if (!userData) return;

  return userData.name;
}

/* SESSION FUNCTIONS */

async function createSession(userID) {
  if (!userID) return false;

  const userData = await getUserData(userID);
  if (!userData) return false;

  // Check if user exists
  if (!userData.username) return false;

  // If session already exists, invalidate it
  if (userData.session) await deleteSession(userData.session);

  // Open writable file
  const userFile = await getUserFile(userID);
  if (!userFile) return false;

  const sessionID = await uuid();
  userFile.json.session = sessionID;
  userFile.json.expiry = await getExpiry();

  const sessionFile = await getSessionFile(sessionID, true);
  if (!sessionFile) {
    files.close(userFile);
    return false;
  }

  sessionFile.json.userID = userID;
  await files.save(sessionFile);
  await files.save(userFile);

  return true;
}

async function getSession(userID) {
  if (!userID) return;

  const userData = await getUserData(userID);
  if (!userData) return;

  const valid = await checkSession(userData.session);
  if (valid) return userData.session;

  // If stored session is valid, return it, otherwise create a new session.

  const createSuccess = await createSession(userID);
  if (!createSuccess) return;

  const newUserData = await getUserData(userID);
  if (!newUserData) return;

  return newUserData.session;
}

async function checkSession(sessionID) {
  if (!sessionID) return false;

  const sessionData = await getSessionData(sessionID);
  if (!sessionData) return false;

  const userData = await getUserData(sessionData.userID);
  if (!userData) return false;

  if (!userData.expiry) return false;

  if (await hasExpired(userData.expiry)) {
    await deleteSession(sessionID);
    return false;
  }

  return true;
}

async function deleteSession(sessionID) {
  if (!sessionID) return false;

  const sessionData = await getSessionData(sessionID);
  if (!sessionData) return false;

  if (!sessionData.userID) return false;

  const userData = await getUserData(sessionData.userID);
  if (!userData) return false;
  if (userData.session !== sessionID) return false;

  const userFile = await getUserFile(sessionData.userID);
  if (userFile == null) return false;

  userFile.json.session = undefined;
  userFile.json.expiry = undefined;

  await files.save(userFile);
  await files.remove(
    await getSessionFilePath(sessionID),
  );

  return true;
}

async function checkPassword(userID, password) {
  const userData = await getUserData(userID);
  if (!userData) return false;
  const { hash } = userData;
  if (!hash) return false;

  return bcrypt.compare(password, hash);
}

/* PUBLIC AUTH FUNCTIONS */

async function register(username, password) {
  if (username == null || password == null) return false;

  // If user already exists, exit
  if (await getUserID(username) != null) return false;

  const userID = await uuid();
  const userFile = await getUserFile(userID, true);
  if (!userFile) return false;
  if (userFile.content !== '{}') return false;

  userFile.json = {
    username,
    hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  };

  await files.save(userFile);

  return attempt(setUserID, 200, 10, [username, userID]);
}

async function login(username, password) {
  if (username == null || password == null) return false;

  const userID = await getUserID(username);
  if (!userID) return false;

  // Check if password is correct
  const userData = await getUserData(userID);
  const { hash } = userData;

  if (!await bcrypt.compare(password, hash)) return false;

  if (userData.session) await deleteSession(userData.session);

  return createSession(userID);
}

/* ACCOUNT FUNCTIONS */

async function deleteAccount(userID) {
  if (!userID) return false;

  const userData = await getUserData(userID);
  if (!userData) return false;

  // Check if user exists
  if (!userData.username) return false;

  // Delete any remaining session
  if (userData.session) await deleteSession(userData.session);

  await files.remove(
    await getUserFilePath(userID),
  );

  return attempt(setUserID, 200, 10, [userData.username, undefined]);
}

async function modifyUsername(userID, newUsername) {
  if (!userID || !newUsername) return false;

  // If user with that name already exists, exit
  if (await getUserID(newUsername) != null) return false;

  const userFile = await getUserFile(userID);
  if (!userFile) return false;

  const removeResult = await attempt(setUserID, 200, 10, [userFile.json.username, undefined]);
  if (!removeResult) return false;

  userFile.json.username = newUsername;
  await files.save(userFile);

  return attempt(setUserID, 200, 10, [newUsername, userID]);
}

async function modifyPassword(userID, newPassword) {
  if (!userID || !newPassword) return false;

  const userFile = await getUserFile(userID);
  if (!userFile) return false;

  userFile.json.hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await files.save(userFile);

  return true;
}

async function getUserIDFromSession(sessionID) {
  if (!sessionID) return;

  const sessionData = await getSessionData(sessionID);
  if (!sessionData) return;

  return sessionData.userID;
}

async function getUserEmail(userID) {
  if (!userID) return;

  const userData = await getUserData(userID);
  if (!userData) return;

  return userData.email;
}

async function setUserEmail(userID, email) {
  if (!userID) return false;

  const emailData = await getEmailData();
  if (!emailData) return false;

  // If account with that email already exists, exit
  if (emailData[email]) return false;

  const userFile = await getUserFile(userID);
  if (!userFile) return false;

  const emailFile = await getEmailFile();
  if (!emailFile) return false;

  const oldEmail = await getUserEmail(userID);

  if (oldEmail) emailFile.json[oldEmail] = undefined;

  userFile.json.email = email;
  emailFile.json[email] = userID;

  await files.save(userFile);
  await files.save(emailFile);

  return true;
}

async function modifyName(userID, name) {
  if (!userID || !name) return false;

  const userFile = await getUserFile(userID);
  if (!userFile) return false;

  userFile.json.name = name;

  await files.save(userFile);
  return true;
}

async function getUserIDFromEmail(email) {
  if (!email) return;

  const emailData = await getEmailData();
  if (!emailData) return;

  return emailData[email];
}

async function createOTP(userID) {
  if (!userID) return;

  const otpFile = await getOTPFile();
  if (!otpFile) return false;

  const userFile = await getUserFile(userID);
  if (!userFile) {
    files.close(otpFile);
    return false;
  }

  const oldPsk = userFile.json.otp;

  if (oldPsk) otpFile.json[oldPsk] = undefined;

  const psk = await uuid();

  userFile.json.otp = psk;
  userFile.json.otpExpiry = await getOTPExpiry();

  otpFile.json[psk] = userID;

  await files.save(userFile);
  await files.save(otpFile);

  return true;
}

async function getOTP(userID) {
  if (!userID) return;

  const result = await attempt(createOTP, 200, 10, [userID]);
  if (!result) return;

  const userData = await getUserData(userID);
  if (!userData) return false;

  return userData.otp;
}

async function verifyOTP(otp) {
  if (!otp) return;

  const otpData = await getOTPData();
  if (!otpData) return;

  const userID = otpData[otp];
  if (!userID) return;

  const userData = await getUserData(userID);
  if (!userData) return;

  const expiry = userData.otpExpiry;
  if (!expiry) return;

  const expired = await hasExpired(expiry);
  const userFile = await getUserFile(userID);
  if (!userFile) return;

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
      name: modifyName,
    },
  },
  fetch: {
    user: {
      id: getUserID,
      username: getUserUsername,
      name: getUserName,
      email: getUserEmail,
      idFromSession: getUserIDFromSession,
      idFromEmail: getUserIDFromEmail,
    },
  },
  compare: checkPassword,
};
