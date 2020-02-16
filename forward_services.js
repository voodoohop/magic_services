
const io = require("socket.io-client");
const {findServices, prepareService, findServiceOnce} = require("./index");

const GATEWAY_HOST = 'localhost';
const GATEWAY_PORT = 4321;

const exposerSocket = io(`http://${GATEWAY_HOST}:${GATEWAY_PORT}`);

async function exposeService(service) {


    const freeRemotePort = await new Promise(resolve => exposerSocket.on("availablePort", resolve));


    return async publishParams => {
        // TODO: run reverse ssh
        exposerSocket.emit("publishService", {...publishParams, host: GATEWAY_HOST, port: freeRemotePort})
    }

    // exposerSocket.on("services", services => {
    //     console.log("Got available services update", services);
    // });
}


async function test() {
    const {port, publish, unpublish} = await prepareService({type: "testservice2"});
    console.log({port});
    await publish({txt:{expose:true}});
    // setTimeout(unpublish, 7000);
    const oneService = await findServiceOnce({type:"testservice2"});
    console.log("found one service",oneService);
}

test();

console.log("finding");
const browser = findServices({type:"testservice2"}, (services) => {
    console.log("Exposing",services);
    // console.log("known services", browser.services);
});

