## Overview

![screenshot](https://i.ibb.co/5X0xKhk/Screen-Shot-2020-02-20-at-2-47-53-AM.png)

## Functions

<dl>
<dt><a href="#createService">createService(serviceDescription)</a></dt>
<dd><p>Create Websocket service on a free port and automatically broadcast it via bonjour</p>
</dd>
<dt><a href="#findService">findService(options, callback)</a></dt>
<dd><p>find a service that matches the given type.</p>
</dd>
<dt><a href="#findServiceOnce">findServiceOnce(options)</a></dt>
<dd><p>Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements</p>
</dd>
</dl>

<a name="createService"></a>

## createService(serviceDescription)
Create Websocket service on a free port and automatically broadcast it via bonjour

**Kind**: global function  

| Param | Default | Description |
| --- | --- | --- |
| serviceDescription | <code></code> | Service configuration |
| serviceDescription.isUnique |  | True if multiple services of the same name are allowed to coexist |
| serviceDescription.name |  | The service name. This is not used for discovery |
| serviceDescription.type |  | The service type. This is used for discovery. |
| serviceDescription.txt |  | Additional metadata to pass in the DNS TXT field |

<a name="findService"></a>

## findService(options, callback)
find a service that matches the given type.

**Kind**: global function  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options |  |  | options |
| options.type | <code>string</code> |  | The type of service |
| options.txt | <code>object</code> |  | Metadata |
| options.local | <code>boolean</code> | <code>true</code> | Whether to look only on the local host for services |
| callback | <code>func</code> |  | Callback which is called any time a new service is found that satistfies the query |

<a name="findServiceOnce"></a>

## findServiceOnce(options)
Same as findService but returns a promise that resolves as soon as a service is found that meets the requirements

**Kind**: global function  

| Param |
| --- |
| options | 

