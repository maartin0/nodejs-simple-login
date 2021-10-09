var crypto = require('crypto');
import { v4 as uuidv4 } from 'uuid';

function sha_256(value) {
    return crypto.createHash('sha256').update(value).digest('base64');
}

function register(user, psk) {

}
console.log(sha_256("Hello World"))