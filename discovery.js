
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const bonjour = require('bonjour')();
const mdns = require("mdns");
const {get_private_ip} = require("network");

// 1 hour default time-to-live
const DEFAULT_TTL = 60 * 60 * 1000;
const MAESTRON_SERVICE_TYPE = "bakeryservice";

const localHost = _formatHost(os.hostname());

console.log("Local host name", localHost);
const unpublishers = [];

nodeCleanup(_unpublish);



/**
 * Find a free port and set up automatic broadcasting via bonjour
 * @param  {} serviceDescription=null Service configuration
 * @param  {} serviceDescription.isUnique True if multiple services of the same name are allowed to coexist
 * @param  {} serviceDescription.name The service name. This is not used for discovery
 * @param  {} serviceDescription.type The service type. This is used for discovery.
 * @param  {} serviceDescription.txt Additional metadata to pass in the DNS TXT field
 */
async function publishService({type, name = null, isUnique = true, host = localHost, port=null, txt={}}) {

    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;




    // const publishParams = { name, type, port,  txt };

    const txtRecord = {...txt, type};

    console.log("Publishing", type, name, port, txt);

    const localIp = await new Promise(resolve => get_private_ip((err,ip) => resolve(ip)));
    console.log("Used network to determine local IP", localIp);
    console.log("Starting new advertisement with type", type);

    //advertisement = bonjour.publish({name, type:MAESTRON_SERVICE_TYPE, port, txt: {type}})// 
    const advertisement = mdns.createAdvertisement(["http","tcp", MAESTRON_SERVICE_TYPE], port,{ name, txtRecord, host, networkInterface: localIp});
    advertisement.start();

    // Re-publish repeatedly
    intervalHandle = setInterval(async () => {
        console.log("Republishing service.");
        await publish(txt);
    }, DEFAULT_TTL);


    const unpublish = () => {
        console.log("Unpublishing service", name);
        advertisement.stop();
    }

    unpublishers.push(unpublish);
    return  unpublish;
}

/**
 * find a service that matches the given type.
 * @param  {} options options
 * @param  {string} options.type The type of service
 * @param  {object} options.txt Metadata
 * @param  {boolean} options.local=true Whether to look only on the local host for services
 * @param  {func} callback Callback which is called any time a new service is found that satistfies the query
 */
function findServices({ type,  local = false }, callback) {

    var browser = mdns.createBrowser(["http","tcp", MAESTRON_SERVICE_TYPE]);
    let services= {};
    browser.on('serviceUp', function(service) {
        if (local && !_isLocal(service))
          return;
        console.log("checking service.txtRecord.type", service.txtRecord.type, type)
        if (type && !(service.txtRecord.type === type)) 
            return;
        
        console.log("service up: ", service);
        services[service.name] = service;
        callback({available: true, service:_formatService(service)},services);
        
    });

    browser.on('serviceDown', function(service) {
        
        console.log("serviceDown",service);
        const formatted = _formatService(services[service.name] ||  _formatSevice(service));
        if (!(formatted.type === type))
          return;
        console.log("service down: ", formatted.name);
        callback({available: false, service: formatted}, services);
        
    });

    browser.start();

    return browser.stop;
}


/**
 * Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements
 * @param  {} options
 */
function findServiceOnce(options) {
    return new Promise(resolve => {
        const stop = findServices(options, services => {
            if (services.length > 0) {
                stop();
                resolve(services[0]);
            }
        })
    });
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
    return host.replace(/\.$/, "").replace(".fritz.box", ".local");
}

async function _unpublish() {
    console.log("unpublishing");
    try {
        unpublishers.forEach(u => u());
    } catch (e) {
        console.error("Couldn't unpublish but continuing.");
        console.error(e);
    }
}

