const io = require("socket.io");
const {getPortPromise} = require('portfinder');
const nodeCleanup = require('node-cleanup');

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};

serverSocket.on('connection', async socket => {

        
    console.log("Connection from client", socket.id);
    socket.on("getFreePort", async callback => callback(await getPortPromise()));
        
    socket.on("publishService", serviceDescription =>{
         services[serviceDescription.name] = serviceDescription;
         console.log("Received service publish", serviceDescription);
         broadcastServiceUpdate();
    })

    socket.on("unpublishService", serviceDescription =>{
        delete services[serviceDescription.name];
        console.log("Received service publish", serviceDescription);
        broadcastServiceUpdate();
   })
    

});

function broadcastServiceUpdate() {
    serverSocket.sockets.emit("services", services);
}


//   remote_port = 5000 + int(training_run_id)
//   script_path = os.path.dirname(os.path.abspath(__file__))

//   ssh_command = f"{script_path}/reverse_ssh.sh {params.model_server_port} {remote_port} &"