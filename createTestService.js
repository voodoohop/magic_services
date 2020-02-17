
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const http = require('http');

const { publishService } = require("./index");


async function testCreateService() {
    const port = await portfinder.getPortPromise();
    
    http.createServer(function (request, res) {
        res.writeHead(200); res.end('Hello World\n');
    }).listen(port);

    const unpublish = await publishService({ type: "testservice2", port, txt: { some_metadata: "bla" } });


    // setTimeout(unpublish, 7000);
    nodeCleanup(unpublish);
}

testCreateService();