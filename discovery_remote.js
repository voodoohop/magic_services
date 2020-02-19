
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

    const remotePort = await new Promise(resolve => exposerSocket.emit("getFreePort", localPort, resolve));

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
    
    const reemit = () => {
        console.log("Socket reconnected. Republishing");
        exposerSocket.emit("publishService", proxiedService);
    };

    exposerSocket.on("reconnect", reemit);
   
    return () => {
        console.log("Disposing of exposed service", proxiedService);
        console.log("Killing AutoSSH");
        disposeReverseSSH();
        exposerSocket.emit("unpublishService", proxiedService);
        exposerSocket.off(reemit);
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


module.exports = {exposeLocalService, findServicesRemote};
