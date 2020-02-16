const io = require("socket.io");
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');
const {random} = require("lodash");
const {values} = Object;

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};

serverSocket.on('connection', async socket => {

        
    console.log("Connection from client", socket.id);
    socket.on("getFreePort", async callback => callback(await getPortPromise({port: random(5000,65000), stopPort: 65535 })));
        
    socket.on("publishService", serviceDescription =>{
         services[serviceDescription.name] = serviceDescription;
         console.log("Received service publish", serviceDescription);
         broadcastServiceUpdate();
         serverSocket.sockets.emit("publishService", serviceDescription);
    })

    socket.on("unpublishService", serviceDescription =>{
        delete services[serviceDescription.name];
        console.log("Received service publish", serviceDescription);
        broadcastServiceUpdate();
        serverSocket.sockets.emit("unpublishService", serviceDescription);
   })

   values(services).forEach(service => serverSocket.sockets.emit("publishService",service));
    

});

function broadcastServiceUpdate() {
    serverSocket.sockets.emit("services", services);
}


//   remote_port = 5000 + int(training_run_id)
//   script_path = os.path.dirname(os.path.abspath(__file__))

//   ssh_command = f"{script_path}/reverse_ssh.sh {params.model_server_port} {remote_port} &"