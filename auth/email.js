const nodemailer = require('nodemailer');
const files = require('../file');

let transporter;
let configFile;

const CONFIGURATION_PATH = 'config/auth.json';

files.read(CONFIGURATION_PATH).then((resolve) => {
    configFile = resolve;
    transporter = nodemailer.createTransport({
        service: configFile.email.service,
        auth: configFile.email.auth,
        debug: true
    });
);

async function send(to, subject, text) {
    transporter.sendMail(
        {
            from: configFile.email.email,
            to,
            subject,
            text,
        }, 
        function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        }
    );
}

async function sendForgotEmail(email, psk) {
    const body = `Hi,

    We recieved your password reset request. 

    If you forgot your password please click on the link below and follow the instructions.
    ${configFile.url}reset?psk=${psk}

    If you believe there has been an error, or you did not make this request. Please ignore this email and consider changing your password.
    `
    send(email, 'Your forgot password request', body);
}

module.exports = {
    send,
}