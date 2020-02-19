
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const sleep = require('sleep-async')().Promise;


const { findServices, publishService, findServiceOnce } = require("./discovery");
const {isReachable} = require("./helpers");

const {values, keys} = Object;

const GATEWAY_HOST = "ec2-bakerman";
const GATEWAY_PORT = 4321;

const REVERSE_SSH_HOST = "ec2-bakerman";
const REVERSE_SSH_USERNAME = "ubuntu";
const REVERSE_SSH_KEYFILE = path.join(homedir(), "credentials", "ec2_model_supervisor_key.pem");

const AUTOEXPOSER_SERVICE_TYPE = "autoServiceExposer";

const exposerSocket = io(`http://${GATEWAY_HOST}:${GATEWAY_PORT}`);


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
    const { remotePort, host, dispose:disposeReverseSSH } = await reverseSSH(service.host, service.port, exposerSocket);
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


function findServicesRemote(opts, callback) {
    const {type} = opts;
    exposerSocket.on("publishService", async service => {
        console.log("Received remote service", service);

        
        if (!await isReachable(service)) {
            console.error("service was not reachable. ignoring.", service);
            return;
        }
       
        const remoteService = _formatRemoteService(service);
        
        console.log("Got remote service:", remoteService);
        callback({ available: true, service: remoteService });

    });
    exposerSocket.on("unpublishService", service => {
        console.log("got unpublish service",service);
        if (type && !(service.txt.type === type)) {
            console.log("But types didn't match. Skipping.");
            return;
        }
        callback({available: false, service: _formatRemoteService(service)})
    });
}


function _formatRemoteService(service) {
    return {
        type: service.type,
        name: service.name,
        host: service.host,
        port: service.port,
        txt: { ...service.txt, location: "remote" }
    };
}

// function publishLocalServices(exposerSocket) {

//     let disposers = {};

//     return findServices({}, async ({ available, service }, services) => {
//         // this is a kind of ugly way of telling exposeRemoteServices which local services don't need to be duplicated
//         localServices = services;

//         // forward i
//         if (available) {
//             if (service.txt.location === "remote") {
//                 console.log(`${service.name}" is tunneled remotely. We don't need to expose it again.`);
//                 return;
//             }
//             if (service.txt.noExpose) {
//                 console.log(`${service.name}" has noExpose flag set. Ignoring.`);
//                 return;
//             }
//             let removed = false;
//             disposers[service.name] = () => { removed = true };

//             console.log("Got avalaible service announcement.", service);
//             console.log(`Checking if port "${service.port}" is reachable.`);

//             if (!isReachable(service)) {
//                 console.log("Port not reachable. Ignoring.");
//                 return;
//             }
//             console.log("Exposing service", service);
//             disposers[service.name] = await exposeLocalService(service, exposerSocket);
//             if (removed)
//                 disposers[service.name]();
//         } else {
//             console.log("Got service down announcement", service, "Calling disposer.");
//             disposers[service.name] && disposers[service.name]();
//         }
//     });

// }


module.exports = {exposeLocalService, findServicesRemote};
