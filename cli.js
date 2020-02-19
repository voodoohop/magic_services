
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
    .option('--no-expose', 'Don\'t expose remotely.', false)
    .option('--launch-visualizer [port]', 'Launch the visualizer service and and open it in the browser.')
    .outputHelp()
program.parse(process.argv);



console.log("Arguments", program.opts());

if (program.expose) {
    console.log("Exposing...");
    exposeService(program);
}
    
if (program.launchVisualizer) {
    launchVisualizer(parseInt(program.launchVisualizer));
}


async function launchVisualizer(port) {
   console.log("Launching service visualizer on port", port);
   visServer(port)
   await sleep.sleep(1000);
   openBrowser(`http://localhost:${port}`);
}

async function exposeService(program) {
    const [name, host_and_port] = program.expose.split("@");
    const [host, port] = host_and_port.split(":");
    let metadata = {};
    if (program.exposeMetadata) {
        const keyvalues = program.exposeMetadata.split(",");
        keyvalues.forEach(keyvalue => {
            const [key, value] = keyvalue.split(":");
            metadata[key] = value;
        });
    }
    const unpublish = await publishService({ type: name, port: parseInt(port), host, txt: metadata });
    nodeCleanup(unpublish);
}
