
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const sleep = require('sleep-async')().Promise;


const { findServices, publishService, findServiceOnce } = require("./discovery");

const {values, keys} = Object;

const GATEWAY_HOST = "ec2-18-185-70-234.eu-central-1.compute.amazonaws.com";
const GATEWAY_PORT = 4321;

const REVERSE_SSH_HOST = "ec2-18-185-70-234.eu-central-1.compute.amazonaws.com";
const REVERSE_SSH_USERNAME = "ubuntu";
const REVERSE_SSH_KEYFILE = path.join(homedir(), "credentials", "ec2_model_supervisor_key.pem");

const exposerSocket = io(`http://${GATEWAY_HOST}:${GATEWAY_PORT}`);

const cleanupPromise = new Promise(resolve => nodeCleanup(resolve));

async function reverseSSH(localHost, localPort) {

    const remotePort = await new Promise(resolve => exposerSocket.emit("getFreePort", resolve));

    return await new Promise((resolve, reject) => {
        const autoSSHClient = autossh({
            host: REVERSE_SSH_HOST,
            username: REVERSE_SSH_USERNAME,
            localPort,
            localHost,
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
    const { remotePort, host, dispose:disposeReverseSSH } = await reverseSSH(service.host, service.port);
    // const remotePort=21312;
    const proxiedService = { ...service,txt: {...service.txt, originHost:service.host, originPort: service.port, location: "remote"} ,host: REVERSE_SSH_HOST, port: remotePort, url:`http://${REVERSE_SSH_HOST}:${remotePort}`};

    console.log(`Local service at ${service.host}:${service.port} now available at ${host}:${remotePort}.`);
    await sleep.sleep(1000);
    exposerSocket.emit("publishService", proxiedService);
    return () => {
        console.log("Disposing of exposed service", proxiedService);
        console.log("Killing AutoSSH");
        disposeReverseSSH();
        exposerSocket.emit("unpublishService", proxiedService);
    };
}


function exposeRemoteServices(exposerSocket) {
    let availableUnpublishers = {};
    exposerSocket.on("publishService", async service => {
        console.log("Got remote service announcement", service);
        if (localServices[service.name] || localServices[service.name + "_remote"]) {
            console.error("Found", service.name, "locally, Ignoring.");
            return;
        }
        console.log("Checking if port reachable.");
        const reachable = await isPortReachable(service.port, { host: service.host });
        if (!reachable) {
            console.error("service was not reachable. ignoring.", service);
            return;
        }
        if (availableUnpublishers[service.name])
          availableUnpublishers[service.name]();
        
        const unpublisher = await publishService({ 
            type: service.type, 
            name: service.name + "_remote", 
            isUnique: false, 
            host: service.host, 
            port: service.port,
            txt: {...service.txt, location:"remote" }
         });
        
        availableUnpublishers[service.name] = unpublisher;

        console.log("Exposing remote service", service);
    });
    exposerSocket.on("unpublishService", service => {
        if (!availableUnpublishers[service.name]) {
            console.error("Received unpublish, but had not tracked any published services of that name.", service);
            return;
        }
        availableUnpublishers[service.name]();
        delete availableUnpublishers[service.name];
    });
    nodeCleanup(() => { 
        console.log("Cleaning up",keys(availableUnpublishers));
        values(availableUnpublishers).forEach(unpublish => {  
        console.log("Unpublishing remote service.");
        unpublish();
    })
});
}

const http = require('http');

let localServices = {};

async function publishLocalServices() {

    let disposers = {};

    findServices({}, async ({ available, service }, services) => {
        // this is a kind of ugly way of telling exposeRemoteServices which local services don't need to be duplicated
        localServices = services;

        // forward i
        if (available) {
            if (service.txt.location === "remote") {
                console.log(`${service.name}" is tunneled remotely. We don't need to expose it again.`);
                return;
            }
            let removed = false;
            disposers[service.name] = () => { removed = true };

            console.log("Got avalaible service announcement.", service);
            console.log(`Checking if port "${service.port}" is reachable.`);

            const reachable = await isPortReachable(service.port, { host: service.host, timeout:10000 });
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

async function testIfAlreadyRunning() {
    while (true) {
        let alreadyRunning = false;
        try {
            await findServiceOnce({type: "autoServiceExposer"});
            alreadyRunning = true;
        } catch(e) {
            console.log("Find service timed out.");
        }
        if (!alreadyRunning) {
            console.log("No autoexposer found. Spinning up.");
            const unpublish = await publishService({type: "autoServiceExposer", port:9999});
            publishLocalServices();
            exposeRemoteServices(exposerSocket);
            nodeCleanup(unpublish);
            break;
        } else {
            console.log("Autoexpose service already running. Checking again in 10 minutes.");
        }
        await sleep.sleep(10*60*1000)
    }   
};
    
    
testIfAlreadyRunning();