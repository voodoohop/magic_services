
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const bonjour = require('bonjour')();
const mdns = require("mdns");
const {get_private_ip} = require("network");
const {exposeLocalService, findServicesRemote} = require("./discovery_remote");
// 1 hour default time-to-live
const DEFAULT_TTL = 60 * 60 * 1000;
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

    //advertisement = bonjour.publish({name, type:MAESTRON_SERVICE_TYPE, port, txt: {type}})// 
    const advertisement = mdns.createAdvertisement(["http","tcp", MAESTRON_SERVICE_TYPE], port,{ name, txtRecord:txt, host, networkInterface: localIp});
    advertisement.start();
    const unexpose = await exposeLocalService({type, name, host, port, txt});


    const unpublish = () => {
        console.log("Unpublishing service", name);
        advertisement.stop();
        unexpose();
        clearInterval(intervalHandle);
    }

    // Re-publish repeatedly
    const intervalHandle = setTimeout(async () => {
        console.log("Republishing service.");
        unpublish();
        await publishService(params);
    }, DEFAULT_TTL);


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
        callback({available: true, service:_formatService(service)});
        
    });

    browser.on('serviceDown', function(service) {
        
        console.log("serviceDown",service);
        const formatted = _formatService(service);
        if (type && !(formatted.type === type))
          return;
        console.log("service down: ", formatted.name);
        callback({available: false, service: formatted});
        
    });

    browser.start();

    return browser.stop;
}

function findServices(opts, callback) {
    let localServices = {};
    let remoteServices = {};

    findServicesLocal(opts, ({available, service}) => {
        if (available)
            localServices[service.name] = service;
        else
            delete localServices[service.name];
        callback({available, service}, {...remoteServices, ...localServices});
    });

    findServicesRemote(opts, ({available, service}) => {
        if (available)
            remoteServices[service.name] = service;
        else
            delete remoteServices[service.name];
        
        if (!localServices[service.name])
            callback({available, service}, {...remoteServices, ...localServices});
    });
}

/**
 * Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements
 * @param  {} options
 */
function findServiceOnce(options,timeout=1000) {
    return _promiseTimeout(timeout, new Promise(resolve => {
        const stop = findServices(options, ({available,service}) => {
            if (available) {
                resolve(service);
                stop();
            }
        })
    }));
}


const _isLocal = service => service.host.startsWith(localHost);



module.exports = { publishService, findServices, findServiceOnce, localHost };


const _formatService = ({name, host, port, txtRecord}) => { 
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
  