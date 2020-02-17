
const isReachable = require('is-reachable');

const isPortReachable = require('is-port-reachable');

async function checkPortReachable(host, port) {
    const isReachable2 = await isReachable(`http://${host}:${port}`);
    console.log({isReachable2})
    const isReachable3=await isPortReachable(port,{host, timeout:10000})
    console.log({isReachable3});
    return isReachable3
}

checkPortReachable(process.argv[2],parseInt(process.argv[3]))