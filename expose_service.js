const io = require("socket.io");
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');
const {random} = require("lodash");
const {values, keys} = Object;

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};
let serviceSources = {};

let connections = {};

serverSocket.on('connection', async socket => {

    connections[socket.id] = socket;

    console.log("Connection from client", socket.id);
    socket.on("getFreePort", async callback => callback(await getPortPromise({port: random(5000,65000), stopPort: 65535 })));
        
    socket.on("publishService", serviceDescription =>{
         services[serviceDescription.name] = serviceDescription;
         serviceSources[serviceDescription.name] = socket.id;
         console.log("Received service publish", serviceDescription);
         broadcastServiceUpdate();
         serverSocket.sockets.emit("publishService", serviceDescription);
    })

    socket.on("unpublishService", serviceDescription =>{
        delete services[serviceDescription.name];
        delete serviceSources[serviceDescription.name];
        console.log("Received service publish", serviceDescription);
        broadcastServiceUpdate();
        serverSocket.sockets.emit("unpublishService", serviceDescription);
   })

   socket.on("disconnect", () => {
       console.log("Forwarder disconnected. Unpublishing his services.")
       delete connections[socket.id];
       values(serviceSources).forEach((socketId,i) => {
         if (socketId === socket.id) {
             const unpublishService = services[keys(serviceSources)[i]];
             console.log("Sending unpublish of",unpublishService)
           serverSocket.sockets.emit("unpublishService", unpublishService);
         }
       });
   })

   values(services).forEach(service => serverSocket.sockets.emit("publishService",service));
    

});

function broadcastServiceUpdate() {
    serverSocket.sockets.emit("services", services);
}


//   remote_port = 5000 + int(training_run_id)
//   script_path = os.path.dirname(os.path.abspath(__file__))

//   ssh_command = f"{script_path}/reverse_ssh.sh {params.model_server_port} {remote_port} &"