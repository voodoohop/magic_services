const io = require("socket.io");
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');
const {random} = require("lodash");
const {values, keys, entries} = Object;
const {isReachable} = require("./helpers");

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};

serverSocket.on('connection', async socket => {

    console.log("Connection from client", socket.id);
    socket.on("getFreePort", async callback => callback(await getPortPromise({port: random(5000,65000), stopPort: 65535 })));
        
    socket.on("publishService", serviceDescription => {
         services[serviceDescription.name] = {service: serviceDescription, socket};
         console.log("Received service publish", serviceDescription);
         isReachable(serviceDescription).then(reachable => {
          if (reachable) {
            broadcastServiceUpdate();
            serverSocket.sockets.emit("publishService", serviceDescription);
          } else {
            console.error("Not reachable",serviceDescription,". Ignoring.");
          }
        })

    })

    socket.on("unpublishService", serviceDescription =>{
        delete services[serviceDescription.name];
        console.log("Received service publish", serviceDescription);
        broadcastServiceUpdate();
        serverSocket.sockets.emit("unpublishService", serviceDescription);
   })

   socket.on("disconnect", () => {
       console.log("Forwarder disconnected. Unpublishing his services.")
       values(services).forEach(({ service, socket }) => {
         if (socketId === socket.id) {

             console.log("Sending unpublish of", service)
             serverSocket.sockets.emit("unpublishService", service);
         }
       });
   })

   values(services).forEach(service => socket.emit("publishService",service));
    

});

function broadcastServiceUpdate() {
    // FIXME: should not emit to originator
    serverSocket.sockets.emit("services", services);
}
