
const mdns = require("mdns");
const os = require("os");
const {get_private_ip} = require("network");
const {formatHost} = require("./helpers");

const MAESTRON_SERVICE_TYPE = "bakeryservice";

async function exposeLocally(service) {

    const {type, name, host, port, txt} = service;

    const localIp = await new Promise(resolve => get_private_ip((err,ip) => resolve(ip)));
    console.log("Used network to determine local IP", localIp);
    console.log("Starting new advertisement with type", type);

    const advertisement = mdns.createAdvertisement(["http","tcp", MAESTRON_SERVICE_TYPE], port,{ name, txtRecord:txt, host, networkInterface: localIp});
    advertisement.start();

    return advertisement.stop;
}

/**
 * find a service that matches the given type.
 * @param  {} options options
 * @param  {string} options.type The type of service
 * @param  {object} options.txt Metadata
 * @param  {boolean} options.local=true Whether to look only on the local host for services
 * @param  {func} callback Callback which is called any time a new service is found that satistfies the query
 */
function findServicesLocal({ type, localMachine = false, onlyMaestron=true }, callback) {

    const serviceType = ["http","tcp"];

    if (onlyMaestron)
        serviceType.push(MAESTRON_SERVICE_TYPE);

    var browser = mdns.createBrowser(serviceType);

    browser.on('serviceUp', function(service) {
        if (localMachine && !_isLocal(service))
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

module.exports = {exposeLocally, findServicesLocal};


const _isLocal = service => service.host.startsWith(os.hostname());


const _formatServiceFromBonjour = ({name, host, port, txtRecord}) => { 
    host = host && formatHost(host);
    return {
        url: `http://${host}:${port}`,
        host, port, txt:txtRecord,
        name,
        type: (txtRecord && txtRecord.type) || undefined
    };
}


