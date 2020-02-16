
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const sleep = require('sleep-async')().Promise;


const { difference, differenceBy } = require("lodash");


const { findServices, prepareServicePublisher, findServiceOnce } = require("./index");


const GATEWAY_HOST = 'localhost';
const GATEWAY_PORT = 4321;

const REVERSE_SSH_HOST = "ec2-18-185-70-234.eu-central-1.compute.amazonaws.com";
const REVERSE_SSH_USERNAME = "ubuntu";
const REVERSE_SSH_KEYFILE = path.join(homedir(), "credentials", "ec2_model_supervisor_key.pem");

const SERVICE_UPDATE_DEBOUNCE_TIME = 1000;

const exposerSocket = io(`http://${GATEWAY_HOST}:${GATEWAY_PORT}`);

const cleanupPromise = new Promise(resolve => nodeCleanup(resolve));

async function reverseSSH(localPort) {

    const remotePort = await new Promise(resolve => exposerSocket.emit("getFreePort", resolve));

    return await new Promise((resolve, reject) => {
        const autoSSHClient = autossh({
            host: REVERSE_SSH_HOST,
            username: REVERSE_SSH_USERNAME,
            localPort,
            remotePort,
            privateKey: REVERSE_SSH_KEYFILE,
            reverse: true
        });

        autoSSHClient
            .on('error', reject)
            .on('connect', connection => {
                console.log('Tunnel established on port ' + connection.localPort);
                console.log('pid: ' + connection.pid);
                resolve({ remotePort: connection.remotePort, host: REVERSE_SSH_HOST, dispose: autoSSHClient.kill });
            });
        nodeCleanup(() => autoSSHClient.kill());
    });
}

async function exposeLocalService(service) {
    const { remotePort, host, dispose } = await reverseSSH(service.port);
    // const remotePort=21312;
    const proxiedService = { ...service, host: REVERSE_SSH_HOST, port: remotePort };

    console.log(`Local service at ${service.host}:${service.port} now available at ${host}:${remotePort}.`);
    await sleep.sleep(1000);
    exposerSocket.emit("publishService", proxiedService);
    return () => {
        console.log("Disposing of exposed service", proxiedService);
        console.log("Killing AutoSSH");
        dispose();
        exposerSocket.emit("unpublishService", proxiedService);
    };
}


function exposeRemoteServices(exposerSocket) {
    let available = {};
    exposerSocket.on("publishService", async service => {
        console.log("Got remote service announcement", service);
        if (localServices[service.name]) {
            console.error("Found",service.name,"locally, Ignoring.");
            return;
        }
        console.log("Checking if port reachable.");
        const reachable = await isPortReachable(service.port, { host: service.host });
        if (!reachable) {
            console.error("service was not reachable. ignoring.", service);
            return;
        }
        let publisher = available[service.name] || await prepareServicePublisher({ type: "testservice2", name: service.name + "_remote", isUnique: false, host: service.host, port: service.port });
        available[service.name] = publisher;
        console.log(publisher);
        const { publish } = publisher;
        console.log("Exposing remote service", service);
        publish({ txt: service.txt });
    });
    exposerSocket.on("unpublishService", service => {
        if (!available[service.name]) {
            console.error("Received unpublish, but had not tracked any published services of that name.", service);
            return;
        }
        available[service.name].unpublish();
    });
}

const http = require('http');

async function testCreateService() {
    const port = await portfinder.getPortPromise();
    const { publish, unpublish } = await prepareServicePublisher({ type: "testservice2", port });

    http.createServer(function (request, res) {
        res.writeHead(200); res.end('Hello World\n');
    }).listen(port);

    await publish({ txt: { expose: true } });
    // setTimeout(unpublish, 7000);
}


let localServices = {};

async function serviceManager() {

    let disposers = {};

    findServices({ type: "testservice2" }, async ({ available, service }, services) => {
        // this is a kind of ugly way of telling exposeRemoteServices which local services don't need to be duplicated
        localServices = services;

        if (available) {
            let removed = false;
            disposers[service.name] = () => { removed = true };

            console.log("Got avalaible service announcement.", service);
            console.log("Checking if port reachable.");

            const reachable = await isPortReachable(service.port, { host: service.host });
            if (!reachable) {
                console.log("Port not reachable. Ignoring.");
                return;
            }
            console.log("Exposing service", service);
            disposers[service.name] = await exposeLocalService(service);
            if (removed)
                disposers[service.name]();
        } else {
            console.log("Got service down announcement", service, "Calling disposer.");
            disposers[service.name] && disposers[service.name]();
        }
    });

}

// serviceManager();
// exposeRemoteServices(exposerSocket);
testCreateService();
// const browser = findServices({type:"testservice2"}, (services) => {
//     // console.log("Exposing",services);
//     // console.log("known services", browser.services);
// });

