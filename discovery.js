
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const {exposeRemotely, findServicesRemote, updateServiceActivity, onActivity} = require("./discovery_remote");
const {exposeLocally, findServicesLocal} = require("./discovery_local");
const {isReachable, promiseTimeout, formatHost} = require("./helpers");
const sleep = require('sleep-async')().Promise;
const {debounce} = require("lodash");

const {keys} = Object;

let mdnsAvailable = false;
try {
    require("mdns");
    mdnsAvailable = true;
}
catch (e) {
  console.error("Problem: Multicast DNS not available. Can use remote exposing and browsing though. ");
}

// 2 minute health check
const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000;


const localHost = formatHost(os.hostname());

console.log("Local host name", localHost);


/**
 * Find a free port and set up automatic broadcasting via bonjour
 * @param  {} serviceDescription=null Service configuration
 * @param  {} serviceDescription.isUnique True if multiple services of the same name are allowed to coexist
 * @param  {} serviceDescription.name The service name. This is not used for discovery
 * @param  {} serviceDescription.type The service type. This is used for discovery.
 * @param  {} serviceDescription.port The port of the service to publish
 * @param  {} serviceDescription.host The host of the service to be published. Defaults to local host name.
 * @param  {} serviceDescription.txt Additional metadata to pass in the DNS TXT field
 * @param  {} serviceDescription.local Whether to use local discovery via multicast DNS / Bonjour
 * @param  {} serviceDescription.remote Whether to use remote discovery via a remote gateway server
 */
async function publishService({type, name = null, isUnique = true, host = localHost, port=null, txt={}, local=true, remote=true, activityProxy=false} ) {
    
    local = local && mdnsAvailable;
    host = formatHost(host);

    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;

    txt = {...txt, type};


    let service={type, name, host, port, txt};

    console.log("Publishing", service);
    
    // 10 minute timeout in case service takes a long time to start up
    if (! await isReachable(service, 60*10)) {
        console.error("Service was not reachable. Abandoning.");
        return () => null;
    }


    if (activityProxy)
        service = await _proxyService(service, activeRequests => updateServiceActivity(service.name, activeRequests));
    
    const unexposeRemote = remote && await exposeRemotely(service);
    const unexposeLocal = local && await exposeLocally(service);

    const unpublish = () => {
        console.log("Unpublishing service", name);
        local && unexposeLocal();
        remote && unexposeRemote();
        clearInterval(intervalHandle);
    }

    // Re-publish repeatedly
    const intervalHandle = setTimeout(async () => {
        console.log("Performing health check on service", service);
        if (! await isReachable(service)) {
            console.error("Service went offline. Unpublishing.");
            unpublish();     
        }
    }, HEALTH_CHECK_INTERVAL);


    nodeCleanup(unpublish);

    return unpublish;
}

/**
 * Find services by type. Searches via multicast DNS / Bonjour and a remote but centralized server by default. Local services with the same name take preference over remote services.
 * @param  {} opts
 * @param  {} opts.type The service type (string) to find.
 * @param  {} opts.local Whether to use local discovery via multicast DNS / Bonjour
 * @param  {} opts.remote Whether to use remote discovery via a remote gateway server
 * @param  {} callback The callback is invoked with an object containing the boolean flag available which indicates whether the service went up or down and the service description.
 */
async function findServices(opts, callback) {
    
    let {local=true, remote = true} = opts;

    local = local && mdnsAvailable;

    let localServices = {};
    let remoteServices = {};

    
    const stopLocal = local && findServicesLocal(opts, ({available, service}) => {
        if (available)
            localServices[service.name] = service;
        else
            delete localServices[service.name];
        callback({available, service}, {...remoteServices, ...localServices});
    });
    
    // Give local services a small headstart. they will override remote services of the same name
    await sleep.sleep(1000);

    const stopRemote = remote && findServicesRemote(opts, ({available, service}) => {
        if (available)
            remoteServices[service.name] = service;
        else
            delete remoteServices[service.name];
        
        if (!localServices[service.name])
            callback({available, service}, {...remoteServices, ...localServices});
    });

    return () => {
        stopRemote && stopRemote();
        stopLocal && stopLocal();
    }
}

/**
 * Finds services and updates the callback with a debounced list of currently active services
 * @param  {} opts Same as options of *findservices*
 * @param  {} callback Called with an object that contains the service names as keys and service details as values
 * @param  {} debounceTime=3000 Debounce time. So we don't update UIs when services disappear and appear in quick succession.
 */
async function findAccumulatedServices(opts, callback, debounceTime=3000) {

    const debouncedServicesCallback = debounce(callback, debounceTime);

    const stop = await findServices(opts, (_, services) => {
        console.log("found accumulated services", keys(services));
        debouncedServicesCallback(services)
    })

    return stop;
}

/**
 * Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements
 * @param  {} options
 */
function findServiceOnce(options,timeout=30000) {
    return promiseTimeout(timeout, new Promise(resolve => {
        console.log("Finding once",options,"with timeout", timeout);
        const stop = findServices(options, async ({available,service}) => {
            if (available) {
                console.log("Found service", service);
                resolve(service);
                (await stop)();
            }
        })
    }));
}



module.exports = { publishService, findServices, findServiceOnce, localHost, findAccumulatedServices, onActivity };

const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
async function _proxyService({host, port,...service}, callback) {
    let activeRequests = 0;
    
    const proxiedPort = await getPortPromise({port: port + 1, stopPort: 65535 })
    console.log("Proxy port:", proxiedPort,"Original port:", port,"Proxy host:",localHost);
    const apiProxy = createProxyMiddleware('**', { 
        target: `http://${host}:${port}`, 
        onProxyReq: (...args) => {
            console.log("REQ",new Date());
            activeRequests++;
            callback(activeRequests);
        },
        onProxyRes: (...args) => {
            console.log("RES",new Date());
            if (activeRequests >0)
                activeRequests--;
            callback(activeRequests);
        },
        onError: () => {
            activeRequests = 0;
            callback(activeRequests);
        }

    });
    
    const app = express();
    app.use('**', apiProxy);
    app.listen(proxiedPort);
    return {...service, host: localHost, port: proxiedPort};
}
