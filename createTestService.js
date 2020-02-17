
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const http = require('http');

const { findServices, prepareServicePublisher, findServiceOnce } = require("./discovery");


async function testCreateService() {
    const port = await portfinder.getPortPromise();
    const { publish, unpublish } = await prepareServicePublisher({ type: "testservice2", port });

    http.createServer(function (request, res) {
        res.writeHead(200); res.end('Hello World\n');
    }).listen(port);

    await publish({ txt: { expose: true } });
    // setTimeout(unpublish, 7000);
}

testCreateService();