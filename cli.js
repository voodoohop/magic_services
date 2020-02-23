
const  { publishService, findServiceOnce } = require("./discovery");
const nodeCleanup = require('node-cleanup');
const openBrowser = require('opn');
const visServer = require("./visualizer/server");
const sleep = require('sleep-async')().Promise;

console.log('called directly');
const program = require('commander');

program
    .option('--expose <name@host:port>', 'Expose local service')
    .option('--expose-metadata <metadata>', 'Metadata in the form.')
    .option('--launch-visualizer [port]', 'Launch the visualizer service and and open it in the browser.')
    .option('--no-local',"Don't expose or search on local network via multicast DNS / Bonjour.", false)
    .option('--no-remote',"Don't expose or search for remote services.", false)
    .option('--no-activity-proxy',"Disable proxy service that transmits activity information to service visualizer.", false)
    .outputHelp()
program.parse(process.argv);



console.log("Arguments", program.opts());

if (program.expose) {
    console.log("Exposing...");
    exposeService(program);
}
    
if (program.launchVisualizer) {
    launchVisualizer({remote: program.remote, local: program.local, port:parseInt(program.launchVisualizer)});
}


async function launchVisualizer({remote,local,port}) {
   console.log("Launching service visualizer on port", port);
   visServer({remote,local,port});
   await sleep.sleep(1000);
   openBrowser(`http://localhost:${port}`);
}

async function exposeService(program) {
    const [type, host_and_port] = program.expose.split("@");
    const [host, port] = host_and_port.split(":");
    let metadata = {};
    if (program.exposeMetadata) {
        const keyvalues = program.exposeMetadata.split(",");
        keyvalues.forEach(keyvalue => {
            const [key, value] = keyvalue.split(":");
            metadata[key] = value;
        });
    }
    const service = { type, port: parseInt(port), host, txt: metadata, remote: program.remote, local: program.local, activityProxy: program.activityProxy };
    console.log("Publishing", service);
    const unpublish = await publishService(service);
    nodeCleanup(unpublish);
}
