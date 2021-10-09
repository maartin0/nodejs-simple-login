const express = require('express');
const app = new express();
const port = 80;

const client_root = __dirname + "/client/"

app.get('/', function(request, response){
    response.sendFile('index.html', { root: client_root});
});

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`)
})