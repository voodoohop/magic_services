
const isPortReachable = require('is-port-reachable');
const portfinder = require('portfinder');
const sleep = require('sleep-async')().Promise;


const { fromEntries, values, keys } = Object;

const identityTransformer = stream$ => stream$;


const log = (prefix) => (...args) => console.log(`[${prefix}]`, ...args);

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const pipe2 = (x,...fns) => fns.reduce((v, f) => f(v), x);


const notNull = o => o != null;


const objectEqual = (o1, o2) => JSON.stringify(o1) == JSON.stringify(o2);


async function isReachable(service) {
    console.log("Checking if port reachable.");
    let timeout=2500;
    while (timeout < 10*60*1000) {
        if (await isPortReachable(service.port, { host: service.host , timeout }))
            return true;
        await sleep.sleep(timeout);
        timeout *= 2;
        console.log("Service",service.name,"not reachable. Increased timeout to",timeout);
    }

    return false;
}

module.exports = {identityTransformer,log, pipe,  notNull, pipe2, isReachable};

