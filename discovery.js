
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const {exposeRemotely, findServicesRemote} = require("./discovery_remote");
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
 * @param  {} serviceDescription.txt Additional metadata to pass in the DNS TXT field
 */
async function publishService({type, name = null, isUnique = true, host = localHost, port=null, txt={}, local=true, remote=true} ) {
    
    local = local && mdnsAvailable;
    host = formatHost(host);

    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;

    txt = {...txt, type};


    const service={type, name, host, port, txt};

    console.log("Publishing", service);
    
    // 10 minute timeout in case service takes a long time to start up
    if (! await isReachable(service, 60*10)) {
        console.error("Service was not reachable. Abandoning.");
        return () => null;
    }

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



module.exports = { publishService, findServices, findServiceOnce, localHost, findAccumulatedServices };
