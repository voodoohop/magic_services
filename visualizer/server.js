

var WebSocketServer = require('ws').Server;
var express = require('express');
var server = require('http').createServer();
const {dirname} = require("path");

const { findAccumulatedServices, localHost, onActivity} = require("../discovery");

const {values, keys} = Object;

var wss = new WebSocketServer({
  server: server
});
var app = express();
var path = require('path');
var services = [];
var os = require('os');

app.use(express.static(path.join(__dirname, 'public')));

app.use('/static', express.static(dirname(require.resolve("vis"))))
app.use('/static', express.static(dirname(require.resolve("jquery"))))

app.get('/list.json', function (req, res) {
  console.log("Sending services",keys(services));
  res.json(values(services));
});

app.get('/whoami.json', function (req, res) {
  res.json({
    hostname: localHost
  });
});

server.on('request', app);

server.on('listening', function () {
  var port = server.address().port;

  var eth0 = os.networkInterfaces()["eth0"];
  if (eth0) {
    var ipv4Interface = eth0.filter(function (interface) {
      return interface.family == "IPv4"
    })[0];
    if (ipv4Interface) {
      console.log("http://%s:%d", ipv4Interface.address, port);
    }
  }
});


// process.on('SIGINT', function () {
//   process.exit(0)
// });

// process.on('SIGTERM', function () {
//   process.exit(0)
// });

module.exports = ({remote, local, port}) => { 

  findAccumulatedServices({remote,local}, (servicesObj) => {
    console.log("found services", keys(servicesObj));
    services = servicesObj;
    console.log("Sending",keys(services));
    wss.clients.forEach(function (client) {
      console.log("Refreshing client.");
      client.send(JSON.stringify({type:"refresh"}));
    });
  }, 1000);

  onActivity((name,activeRequests) => {
    wss.clients.forEach(function (client) {
      console.log("Refreshing client.");
      client.send(JSON.stringify({type:"activity", name, activeRequests}));
    });  
  });
  server.listen(port);
};