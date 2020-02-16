
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const bonjour = require('bonjour')();
const mdns = require("mdns");

const {values} = Object;
// 1 hour default time-to-live
const DEFAULT_TTL = 60 * 60 * 1000;
const MAESTRON_SERVICE_TYPE = "bakeryservice";

const localHost = os.hostname();

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
async function prepareServicePublisher({type, name = null, isUnique = true, host = localHost, port=null}) {
    let intervalHandle =null;
    let advertisement = null;

    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;


    const publish = async ({ txt={} } ) => {

        // const publishParams = { name, type, port,  txt };

        txt = {...txt, type};

        if (advertisement) {
            console.log("Stopping existing advertisement.");
            advertisement.stop();
        }

        console.log("Publishing", type, name, port, txt);

        if (advertisement) {
            console.log("Stopping existing advertisement");
            advertisement.stop();
        }
        console.log("Starting new advertisement with type", type);
        advertisement = mdns.createAdvertisement(["http","tcp", MAESTRON_SERVICE_TYPE], port,{ name, txtRecord: txt, host});
        advertisement.start();


        if (intervalHandle)
            clearInterval(intervalHandle);

        // Re-publish repeatedly
        intervalHandle = setInterval(async () => {
            console.log("Republishing service.");
            await publish(txt);
        }, DEFAULT_TTL);

    }

    const unpublish = () => {
        console.log("Unpublishing service", name);
        if (advertisement) {
            advertisement.stop();
            advertisement = null;
        }
    }

    unpublishers.push(unpublish);
    return { publish, unpublish };
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
        if (! (service.txtRecord.type === type)) 
            return;
        
        console.log("service up: ", service.name);
        services[service.name] = service;
        callback({available: true, service:_formatService(service)},services);
        
    });

    browser.on('serviceDown', function(service) {
        
        console.log("serviceDown",service);
        const formatted = _formatService(services[service.name] ||  service);
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




module.exports = { prepareServicePublisher, findServices, findServiceOnce };


const _formatService = ({name, host, port, txtRecord}) => { 
    host = host && host.replace(/\.$/, "");
    return {
        url: `${name}://${host}:${port}`,
        host, port, txt:txtRecord,
        name,
        type: (txtRecord && txtRecord.type) || undefined
    };
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

findServices({type:"testtype"}, found => console.log("foound",found))