
const  { publishService, findServiceOnce } = require("./discovery");
const {autoexpose, AUTOEXPOSER_SERVICE_TYPE} = require("./discovery_autoexpose");
const nodeCleanup = require('node-cleanup');
const openBrowser = require('opn');

console.log('called directly');
const program = require('commander');

program
    .option('--expose <name@host:port>', 'Expose local service')
    .option('--expose-metadata <metadata>', 'Metadata in the form.')
    .option('--no-autoexpose', 'Don\'t start an EC2-based exposer proxy.', false)
    .option('--launch-visualizer', 'Open the network\'s service visualizer in the browser.', false)
    .outputHelp()
program.parse(process.argv);



console.log("Arguments", program.opts());

if (program.autoexpose)
    autoexpose();

if (program.expose) {
    console.log("Exposing...");
    exposeService(program);
}
    
if (program.launchVisualizer) {
    launchVisualizer()
}


async function launchVisualizer() {
   console.log("Looking for visualizer service...");
   const service = await findServiceOnce({type:AUTOEXPOSER_SERVICE_TYPE}, 20000);
   console.log("Got visualizer service", service);
   openBrowser(`http://${service.host}:${service.port}`);
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
    const unpublish = await publishService({ type: name, port, host, txt: metadata });
    nodeCleanup(unpublish);
}
