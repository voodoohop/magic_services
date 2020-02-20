
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const mdns = require("mdns");
const {get_private_ip} = require("network");
const {exposeLocalService, findServicesRemote} = require("./discovery_remote");
const {isReachable} = require("./helpers");
const sleep = require('sleep-async')().Promise;
const {debounce} = require("lodash");

const {keys} = Object;

// 2 minute health check
const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000;
const MAESTRON_SERVICE_TYPE = "bakeryservice";

const localHost = _formatHost(os.hostname());

console.log("Local host name", localHost);


/**
 * Find a free port and set up automatic broadcasting via bonjour
 * @param  {} serviceDescription=null Service configuration
 * @param  {} serviceDescription.isUnique True if multiple services of the same name are allowed to coexist
 * @param  {} serviceDescription.name The service name. This is not used for discovery
 * @param  {} serviceDescription.type The service type. This is used for discovery.
 * @param  {} serviceDescription.txt Additional metadata to pass in the DNS TXT field
 */
async function publishService(params) {
    
    let {type, name = null, isUnique = true, host = localHost, port=null, txt={}}  = params;
    
    host = _formatHost(host);

    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;

    // const publishParams = { name, type, port,  txt };

    txt = {...txt, type};

    console.log("Publishing", type, name, port, txt);

    const localIp = await new Promise(resolve => get_private_ip((err,ip) => resolve(ip)));
    console.log("Used network to determine local IP", localIp);
    console.log("Starting new advertisement with type", type);
    
    const service={type, name, host, port, txt};

    // 10 minute timeout in case service takes a long time to start up
    if (! await isReachable(service, 60*10)) {
        console.error("Service was not reachable. Abandoning.");
        return () => null;
    }

    //advertisement = bonjour.publish({name, type:MAESTRON_SERVICE_TYPE, port, txt: {type}})// 
    const advertisement = mdns.createAdvertisement(["http","tcp", MAESTRON_SERVICE_TYPE], port,{ name, txtRecord:txt, host, networkInterface: localIp});
    advertisement.start();
    const unexpose = await exposeLocalService(service);


    const unpublish = () => {
        console.log("Unpublishing service", name);
        advertisement.stop();
        unexpose();
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
 * find a service that matches the given type.
 * @param  {} options options
 * @param  {string} options.type The type of service
 * @param  {object} options.txt Metadata
 * @param  {boolean} options.local=true Whether to look only on the local host for services
 * @param  {func} callback Callback which is called any time a new service is found that satistfies the query
 */
function findServicesLocal({ type,  local = false, onlyMaestron=true }, callback) {

    const serviceType = ["http","tcp"];

    if (onlyMaestron)
        serviceType.push(MAESTRON_SERVICE_TYPE);

    var browser = mdns.createBrowser(serviceType);

    browser.on('serviceUp', function(service) {
        if (local && !_isLocal(service))
          return;
        // console.log("checking service.txtRecord.type", service.txtRecord.type, type)
        if (type && !(service.txtRecord.type === type)) 
            return;
        
        console.log("service up: ", service);
        callback({available: true, service:_formatServiceFromBonjour(service)});
    });

    browser.on('serviceDown', function(service) {
        console.log("serviceDown",service);
        const formatted = _formatServiceFromBonjour(service);
        if (type && !(formatted.type === type))
          return;
        console.log("Service down: ", formatted.name);
        callback({available: false, service: formatted}); 
    });

    browser.start();

    return browser.stop;
}

async function findServices(opts, callback) {
    let localServices = {};
    let remoteServices = {};

    const stopLocal = findServicesLocal(opts, ({available, service}) => {
        if (available)
            localServices[service.name] = service;
        else
            delete localServices[service.name];
        callback({available, service}, {...remoteServices, ...localServices});
    });
    
    // Give local services a small headstart. they will override remote services of the same name
    await sleep.sleep(1000);

    const stopRemote = findServicesRemote(opts, ({available, service}) => {
        if (available)
            remoteServices[service.name] = service;
        else
            delete remoteServices[service.name];
        
        if (!localServices[service.name])
            callback({available, service}, {...remoteServices, ...localServices});
    });

    return () => {
        stopRemote();
        stopLocal();
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
    return _promiseTimeout(timeout, new Promise(resolve => {
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


const _isLocal = service => service.host.startsWith(localHost);



module.exports = { publishService, findServices, findServiceOnce, localHost, findAccumulatedServices };


const _formatServiceFromBonjour = ({name, host, port, txtRecord}) => { 
    host = host && _formatHost(host);
    return {
        url: `http://${host}:${port}`,
        host, port, txt:txtRecord,
        name,
        type: (txtRecord && txtRecord.type) || undefined
    };
}


function _formatHost(host) {
    if (host.toLowerCase() === "localhost") 
        return localHost;
    return host.replace(/\.$/, "").replace(".fritz.box", ".local");
}


const _promiseTimeout = function(ms, promise){

    // Create a promise that rejects in <ms> milliseconds
    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject('Timed out in '+ ms + 'ms.')
      }, ms)
    })
    return Promise.race([
        promise,
        timeout
      ])
}
  