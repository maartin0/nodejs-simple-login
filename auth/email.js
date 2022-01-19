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
    debug: true,
  });
});

async function send(to, subject, text) {
  transporter.sendMail(
    {
      from: configFile.email.email,
      to,
      subject,
      text,
    },
    (error, info) => {
      if (error) console.log(error);
      else console.log(`Email sent: ${info.response}`);
    },
  );
}

module.exports = {
  send,
};
