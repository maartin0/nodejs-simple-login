const express = require('express');
const app = new express();
const port = 80;

app.get('/', function(request, response){
    response.sendFile('index.html', { root: __dirname+"/client/" });
});

app.listen(port, () => {
  console.log(`Server Listening at http://localhost:${port}`)
})