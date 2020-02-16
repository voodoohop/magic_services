
const io = require("socket.io-client");
const autossh = require('autossh');
const { homedir } = require("os");
const path = require("path");
const nodeCleanup = require('node-cleanup');
const isPortReachable = require('is-port-reachable');

const { map, scan, now, run, runEffects, filter, mergeArray, fromPromise, join,constant,take,
        debounce, skipRepeatsWith, switchLatest, tap, awaitPromises, multicast, zip,withItems,
        combine, skipRepeats, throttle, periodic, never, startWith, combineArray, skip, chain } = require('@most/core');

const { newDefaultScheduler } = require('@most/scheduler');
const { createAdapter } = require("@most/adapter");
const { difference, differenceBy} = require("lodash");
const { drain,streamify, pipe,pipe2, log$, fromArray$ ,notNull} = require("./helpers");

const { findServices, prepareService, findServiceOnce } = require("./index");


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
                resolve({remotePort: connection.remotePort, host: REVERSE_SSH_HOST, dispose: autoSSHClient.kill });
            });
        nodeCleanup(() => autoSSHClient.kill());
    });
}

async function exposeService(service) {
    const { remotePort, host, dispose } = await reverseSSH(service.port);
    // const remotePort=21312;
    const proxiedService = {...service, host: REVERSE_SSH_HOST, port: remotePort };

    console.log(`Local service at ${service.host}:${service.port} now available at ${host}:${remotePort}.`);
    exposerSocket.emit("publishService", proxiedService);
    return () => {
        console.log("Disposing of exposed service", proxiedService);
        console.log("Killing AutoSSH");
        dispose();
        exposerSocket.emit("unpublishService", proxiedService);
    };
}

const http = require('http');

async function testCreateService() {
    const { port, publish, unpublish } = await prepareService({ type: "testservice2" });
    console.log({ port });
    http.createServer(function (request, res) {
        res.writeHead(200); res.end('Hello World\n');
    }).listen(port);

    await publish({ txt: { expose: true } });
    // setTimeout(unpublish, 7000);
}


const getDiff = (previous,next) => ({added: differenceBy(next, previous, JSON.stringify), removed: differenceBy(previous,next, JSON.stringify)});
const getSequentialDiff$ = services$ => zip(getDiff, startWith([],services$), services$)
console.log("Wutg",withItems);



async function serviceManager() {
    // await testCreateService();
    

    findServices({ type: "testservice2" }, );

    const diff$ = pipe2(services$,
        debounce(SERVICE_UPDATE_DEBOUNCE_TIME),
        log$("services"),
        multicast, 
        getSequentialDiff$);


    
    const added$ = pipe2(diff$, 
        chain(({added}) => fromArray$(added)),
        map(async service => {
          const reachable = await isPortReachable(service.port,{host: service.host});
          console.log("Service",service,"is reachable:",true);
          return reachable ? service : null;
        }),
        awaitPromises,
        filter(notNull)
        );

    const removed$ = multicast(chain(({removed}) => fromArray$(removed),diff$));

    
    const exposed_disposers$ = pipe2(added$, map(exposeService), awaitPromises);
 
    const disposeRequests =  join(zip((service, disposer) => 
        pipe2(removed$, 
          filter(removedService  => removedService === service),
          constant(disposer),
          take(1)
        )
        ,added$, exposed_disposers$));
    // fromPromise()
    drain(tap(dispose => {
        console.log("disposing");
        dispose();
    }, disposeRequests));

    // drain(tap( ,exposed_disposers$));

    drain(log$("serviceDiff")(diff$));
    // drain(log$("serviceExposed")(exposed$));
    // drain(log$("itemTest")(withItems([1,2,3], repeat(now())));
}

// test();
testCreateService();
// const browser = findServices({type:"testservice2"}, (services) => {
//     // console.log("Exposing",services);
//     // console.log("known services", browser.services);
// });

