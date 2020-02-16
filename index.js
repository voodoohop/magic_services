
const portfinder = require('portfinder');
const nodeCleanup = require('node-cleanup');
const os = require("os");
const bonjour = require('bonjour')();
const mdns = require("mdns");

const {values} = Object;
// 1 hour default time-to-live
const DEFAULT_TTL = 60 * 60 * 1000;

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
async function prepareService({type, name = null, isUnique = true, host = localHost}) {
    const port = await portfinder.getPortPromise();
    let intervalHandle =null;
    let advertisement = null;


    if (name === null)
        name = `${type}`;
    if (isUnique)
        name = `${name}_${process.pid}`;


    const publish = async ({ txt={} } ) => {

        // const publishParams = { name, type, port,  txt };

        if (advertisement) {
            console.log("Stopping existing advertisement.");
            advertisement.stop();
        }

        console.log("Publishing", type, name, port, txt);

        if (advertisement) {
            console.log("Stopping existing advertisement");
            advertisement.stop();
        }
        advertisement = mdns.createAdvertisement(["http","tcp", type], port,{ name, txtRecord: txt, host});
        advertisement.start();
        console.log("Starting new advertisement");

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
    return { publish, port, unpublish };
}

/**
 * find a service that matches the given type.
 * @param  {} options options
 * @param  {string} options.type The type of service
 * @param  {object} options.txt Metadata
 * @param  {boolean} options.local=true Whether to look only on the local host for services
 * @param  {func} callback Callback which is called any time a new service is found that satistfies the query
 */
function findServices({ type,  local = true }, callback) {

    var browser = mdns.createBrowser(["http","tcp", type]);

    let available = {};

    browser.on('serviceUp', function(service) {
        if (local && _isLocal(service)) {
            console.log("service up: ", service);
            available[service.name] = service;
            callback(_formatServices(available));
        }
    });

    browser.on('serviceDown', function(service) {
        service = available[service.name];
        if (local && _isLocal(service)) {
            console.log("service down: ", service);
            delete available[service.name];
            callback(_formatServices(available));
        }
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




module.exports = { prepareService, findServices, findServiceOnce };


const _formatService = ({name, host, port, txtRecord, type}) => { 
    host = host.replace(/\.$/, "");
    return {
        url: `${type.name}://${host}:${port}`,
        host, port, txt:txtRecord
    };
}


const _formatServices = available => values(available).map(_formatService);


async function _unpublish() {
    console.log("unpublishing");
    try {
        unpublishers.forEach(u => u());
    } catch (e) {
        console.error("Couldn't unpublish but continuing.");
        console.error(e);
    }
}
