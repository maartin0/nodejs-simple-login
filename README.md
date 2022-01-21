# nodejs-simple-login
A simple login made in nodejs.

Click [here](http://maartin0.ddns.net/) to view a demo.

`auth/auth.js` handles authentication<br>
`auth/email.js` handles forgot password emails<br>
`auth/index.js` handles routing for auth.js

`file/index.js` handles JSON file reading and writing

Configure emails in `config/auth.json`. <br>
Set URL of the domain the app is running on, for redirects.<br>
See the [nodemailer documentation](https://nodemailer.com/smtp/) for more info.
