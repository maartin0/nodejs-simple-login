// Local Imports
import * as auth from "auth.js";

// Express Setup
const express = require('express');
const app = new express();
const port = 80;

// Main Body
const client_root = __dirname + "/client/"

app.get('/', function(request, response){
    response.sendFile('index.html', { root: client_root});
});

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`)
})