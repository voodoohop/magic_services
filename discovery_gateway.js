const io = require("socket.io");
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');
const {random} = require("lodash");
const {values, keys, entries} = Object;
const {isReachable} = require("./helpers");
const {mapValues} = require("lodash");

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};

serverSocket.on('connection', socket => {

    console.log("Connection from client", socket.id);
    socket.on("getFreePort", async (localPort, callback) => callback(await getPortPromise({port: localPort, stopPort: 65535 })));
        
    socket.on("publishService", async serviceDescription => {
         services[serviceDescription.name] = {service: serviceDescription, socket};
         console.log("Received service publish", serviceDescription);
         if (! await isReachable(serviceDescription)) {
           console.error("Not reachable",serviceDescription,". Ignoring.");
           return;
         }
         console.log("Server responded. Publishing to everyone.");

         socket.broadcast.emit("publishService", serviceDescription);
    })

    socket.on("unpublishService", serviceDescription =>{
        delete services[serviceDescription.name];
        console.log("Received service publish", serviceDescription);

        socket.broadcast.emit("unpublishService", serviceDescription);
   })
   const socketId = socket.id;
   socket.on("disconnect", () => {
       console.log("Forwarder disconnected. Unpublishing his services.")
       values(services).forEach(({ service, socket }) => {
         if (socketId === socket.id) {
             delete services[service.name]
             console.log("Sending unpublish of", service)
             socket.broadcast.emit("unpublishService", service);
         }
       });
   });


   socket.on("sendServices", () => {
      values(services).forEach(({service}) => { 
        console.log("Publishing existing service",service, "to", socket.id);
        socket.emit("publishService",service);
      })
   });

   socket.on("activity",(name, activeRequests) => {
      console.log("Broadcasting activity",name,activeRequests);
      socket.broadcast.emit("activity", name, activeRequests);
   });

});

nodeCleanup(() => {
  console.log("Cleanup. Unpublishing.")
  values(services).forEach(({ service, socket }) => {
        console.log("Sending unpublish of", service)
        socket.broadcast.emit("unpublishService", service);
  });
})