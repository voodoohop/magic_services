
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const sleep = require('sleep-async')().Promise;
const {existsSync} = require("fs")

const {isReachable} = require("./helpers");

const {values, keys} = Object;

const GATEWAY_HOST = "ec2-bakerman";
const GATEWAY_PORT = 4321;

const REVERSE_SSH_HOST = "ec2-bakerman";
const REVERSE_SSH_USERNAME = "ubuntu";
const REVERSE_SSH_KEYFILE = path.join(homedir(), "credentials", "ec2_model_supervisor_key.pem");



const exposerSocket = io(`http://${GATEWAY_HOST}:${GATEWAY_PORT}`);


async function reverseSSH(localHost, localPort, {keyfile = null, host = null, user = null}) {

    keyfile = keyfile || REVERSE_SSH_KEYFILE;
    host = host || REVERSE_SSH_HOST;
    user = user || REVERSE_SSH_USERNAME;

    console.log(`Checking if ${keyfile} exists.`);
    if (!existsSync(keyfile)) {
        console.error("Fatal, no key certificate found in order to start Reverse SSH tunnels.");
        console.log("This is only required to expose services. We can continue for service discovery.");
        return {};
    }
    console.log("Found keyfile. Getting free remote port...");

    const remotePort = await new Promise(resolve => exposerSocket.emit("getFreePort", localPort, resolve));
    console.log("Got remote port",remotePort,". Starting autossh.");

    return await new Promise((resolve, reject) => {
        const opts = {
            host: host,
            username: user,
            localPort,
            localHost,
            remotePort,
            privateKey: keyfile,
            reverse: true
        };
        console.log("Starting autossh with options", opts);
        const autoSSHClient = autossh(opts);

        autoSSHClient
            .on('error', (...args) => {
                console.log("autossh error",...args)
                reject(...args);
            })
            .on('connect', connection => {
                console.log('Tunnel established on port ' + connection.localPort);
                console.log('pid: ' + connection.pid);
                console.log('Autossh exec string: ' + connection.execString);
                resolve({ remotePort: connection.remotePort, host: host, dispose: autoSSHClient.kill });
            });
        nodeCleanup(() => autoSSHClient.kill());
    });
}

async function exposeRemotely(service, remoteConfig) {

    console.log("Starting reverse SSH");
    const { remotePort, host, dispose:disposeReverseSSH } = await reverseSSH(service.host, service.port, exposerSocket, remoteConfig);

    if (!host)
        throw "Couldn't create Reverse SSH connection. Probably because of missing keyfile.";

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
    const {type, noVerify} = opts;
    console.log("finding remote services of type", type);
    
    const publishService = async service => {
        // console.log("Received remote service", service);
        if (type && !(service.txt.type === type)) {
            // console.log("But types didn't match. Skipping. Expected:", type);
            return;            
        }
        console.log("Found service of correct type.", type);
        if (!noVerify && !await isReachable(service)) {
            console.error("service was not reachable. ignoring.", service);
            return;
        }
    
        const remoteService = _formatRemoteService(service);
        
        console.log("Got remote service:", remoteService);
        callback({ available: true, service: remoteService });
    };

    const unpublishService = service => {
        // console.log("got unpublish service",service);
        if (type && !(service.txt.type === type)) {
            // console.log("But types didn't match. Skipping.");
            return;
        }
        callback({available: false, service: _formatRemoteService(service)})
    };

    exposerSocket.on("publishService", publishService);
    exposerSocket.on("unpublishService", unpublishService);
    exposerSocket.emit("sendServices");
    return () => {
        exposerSocket.off(publishService);
        exposerSocket.off(unpublishService);
    }
}


function _formatRemoteService({txt,...service}) {
    return {
        ...service,
        url: `http://${service.host}:${service.port}`,
        txt: { ...txt, location: "remote" }
    };
}

function updateServiceActivity(name,activeRequests) {
    console.log("emitting","activity",name, activeRequests);
    exposerSocket.emit("activity",name, activeRequests);
}

function onActivity(callback) {
    exposerSocket.on("activity", callback);
}

module.exports = {exposeRemotely, findServicesRemote, updateServiceActivity, onActivity};
