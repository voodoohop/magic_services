
const is_reachable = require('is-reachable');
const portfinder = require('portfinder');
const sleep = require('sleep-async')().Promise;
const os = require("os");

const { fromEntries, values, keys } = Object;


const identityTransformer = stream$ => stream$;


const log = (prefix) => (...args) => console.log(`[${prefix}]`, ...args);

const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const pipe2 = (x,...fns) => fns.reduce((v, f) => f(v), x);


const notNull = o => o != null;


const objectEqual = (o1, o2) => JSON.stringify(o1) == JSON.stringify(o2);

// Default to 90 second max timeout to determine if a service is reachable
const DEFAULT_MAX_REACHABLE_TIMEOUT = 90;

async function isReachable(service, max_timeout_seconds = DEFAULT_MAX_REACHABLE_TIMEOUT) {
    console.log("Checking if port reachable.",service.host,service.port);
    let timeout_secs = 2;
    
    do {
        if (await is_reachable(`${service.host}:${service.port}`,{ timeout: timeout_secs * 1000 })) {
            console.log("Port was reachable after", timeout_secs)
            return true;
        }
        await sleep.sleep(timeout_secs * 1000);
        timeout_secs *= 2;
        console.log("Service", service.name,{host:service.host, port: service.port }, "not reachable. Increased timeout to",timeout_secs);
    
    } while (timeout_secs < max_timeout_seconds);
    console.log("Port was unreachable");
    return false;
}


function formatHost(host) {
    if (host.toLowerCase() === "localhost") {
        host = os.hostname();
    }
    host = host.replace(/\.$/, "").replace(".fritz.box", ".local");
    if (!host.includes(".")) {
        host = host + ".local";
    }
    return host;
}

const promiseTimeout = function(ms, promise) {

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
  
const randomAlphanumeric = (len) => {
    return [...Array(len)]
      .map(i => base[Math.random()*base.length|0])
      .join('');
 };
 

module.exports = {identityTransformer, log, pipe, notNull, pipe2, isReachable, formatHost, promiseTimeout, randomAlphanumeric};
