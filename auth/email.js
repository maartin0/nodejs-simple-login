const nodemailer = require('nodemailer');
const files = require('../file');

const EMAIL_CREDENTIALS_PATH = 'config/email_credentials.json';

let email_config;
let transporter;

async function init() {
    email_config = await files.read(EMAIL_CREDENTIALS_PATH);
    transporter = nodemailer.createTransport({
        direct: true,
        name: '',
    });
}

async function send(to, subject, text) {
    transporter.sendMail(
        {
            from: email_config.email,
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

init().then(function () {
    send('martinmmps@gmail.com', 'Guess What', 'Hello World');
});

module.exports = {
    send,
}