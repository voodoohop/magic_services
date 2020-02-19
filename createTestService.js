
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const http = require('http');

const { publishService,findServices } = require("./index");


async function testCreateService(type,metadata={md:"hello, world"}) {
    const port = await portfinder.getPortPromise();
    
    http.createServer(function (request, res) {
        res.writeHead(200); res.end('Hello World\n');
    }).listen(port);

    const unpublish = await publishService({ type, port, txt: metadata });


    // setTimeout(unpublish, 7000);
    nodeCleanup(unpublish);
}

findServices({}, ({available, service}) => {
    console.log(available, service);
});

testCreateService(process.argv[2] || "testservice", {dataset_name: "cello_viola", run_id:1234} );