const io = require("socket.io");
const portfinder = require('portfinder');

const PORT = 4321;

const serverSocket = io.listen(PORT);

let services = {};

serverSocket.on('connection', async socket => {
    const port = await portfinder.getPortPromise();
    
    console.log("Connection, sending available port", port, socket.id);
    
    socket.on("publishService", serviceDescription =>{
         services[socket.id] = serviceDescription;
         console.log("Received service publish", serviceDescription);
         broadcastServiceUpdate();
    })
    

    socket.emit("availablePort", port);
});

function broadcastServiceUpdate() {
    serverSocket.sockets.emit("services", services);
}


//   remote_port = 5000 + int(training_run_id)
//   script_path = os.path.dirname(os.path.abspath(__file__))

//   ssh_command = f"{script_path}/reverse_ssh.sh {params.model_server_port} {remote_port} &"