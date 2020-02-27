## Overview

![screenshot](docs/screenshot_visualizer.png?raw=true)

This repository implements a lightweight, realtime nodejs based service discovery framework. It allows publishing service availability both through the local network and via a remote server. Local services are automatically made available remotely via Reverse SSH. 

## CLI

The package contains an executable named `expose` which allows exposing a local service, starting the service visualizer and more.

```
Usage: cli [options]

Options:
  --expose <name@host:port>     Expose local service
  --expose-metadata <metadata>  Metadata in the form.
  --launch-visualizer [port]    Launch the visualizer service and and open it in the
                                browser.
  --no-local                    Don't expose or search on local network via multicast DNS
                                / Bonjour.
  --no-remote                   Don't expose or search for remote services.
  --no-activity-proxy           Disable proxy service that transmits activity information
                                to service visualizer.
  -h, --help                    output usage information
```

## Functions

<dl>
<dt><a href="#publishService">publishService(serviceDescription)</a></dt>
<dd><p>Find a free port and set up automatic broadcasting via bonjour</p>
</dd>
<dt><a href="#findServices">findServices(opts, callback)</a></dt>
<dd><p>Find services by type. Searches via multicast DNS / Bonjour and a remote but centralized server by default. Local services with the same name take preference over remote services.</p>
</dd>
<dt><a href="#findAccumulatedServices">findAccumulatedServices(opts, callback, debounceTime)</a></dt>
<dd><p>Finds services and updates the callback with a debounced list of currently active services</p>
</dd>
<dt><a href="#findServiceOnce">findServiceOnce(options)</a></dt>
<dd><p>Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements</p>
</dd>
</dl>

<a name="publishService"></a>

## publishService(serviceDescription)
Find a free port and set up automatic broadcasting via bonjour

**Kind**: global function  

| Param | Default | Description |
| --- | --- | --- |
| serviceDescription | <code></code> | Service configuration |
| serviceDescription.isUnique |  | True if multiple services of the same name are allowed to coexist |
| serviceDescription.name |  | The service name. This is not used for discovery |
| serviceDescription.type |  | The service type. This is used for discovery. |
| serviceDescription.port |  | The port of the service to publish |
| serviceDescription.host |  | The host of the service to be published. Defaults to local host name. |
| serviceDescription.txt |  | Additional metadata to pass in the DNS TXT field |
| serviceDescription.local |  | Whether to use local discovery via multicast DNS / Bonjour |
| serviceDescription.remote |  | Whether to use remote discovery via a remote gateway server |

<a name="findServices"></a>

## findServices(opts, callback)
Find services by type. Searches via multicast DNS / Bonjour and a remote but centralized server by default. Local services with the same name take preference over remote services.

**Kind**: global function  

| Param | Description |
| --- | --- |
| opts |  |
| opts.type | The service type (string) to find. |
| opts.local | Whether to use local discovery via multicast DNS / Bonjour |
| opts.remote | Whether to use remote discovery via a remote gateway server |
| callback | The callback is invoked with an object containing the boolean flag available which indicates whether the service went up or down and the service description. |

<a name="findAccumulatedServices"></a>

## findAccumulatedServices(opts, callback, debounceTime)
Finds services and updates the callback with a debounced list of currently active services

**Kind**: global function  

| Param | Default | Description |
| --- | --- | --- |
| opts |  | Same as options of *findservices* |
| callback |  | Called with an object that contains the service names as keys and service details as values |
| debounceTime | <code>3000</code> | Debounce time. So we don't update UIs when services disappear and appear in quick succession. |

<a name="findServiceOnce"></a>

## findServiceOnce(options)
Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements

**Kind**: global function  

| Param |
| --- |
| options | 

