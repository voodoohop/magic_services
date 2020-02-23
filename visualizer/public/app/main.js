const { keys, entries } = Object;


const BACKGROUND_COLOR = "#222";
const BORDER_COLOR = "rgba(255,255,255,0.4)";
const ROOT_NODE = "conn";
const nodeColors = {
  background: BACKGROUND_COLOR,
  border: BORDER_COLOR,
  hover: {
    border: "white",
    background: BACKGROUND_COLOR
  },
  highlight: {
    border: "white",
    background: BACKGROUND_COLOR      
  }
};

const activeNodeColors = {
  background:"orange",
  border:"white"
};

function toTable(obj) {
  if (!obj)
    return "";
  return `<table>${entries(obj).map(([key, value]) => `<tr><td><b>${key}</b></td><td>${value}</td></tr>`).join(" ")}</table>`
}

function truncateWithEllipses(text, max) 
{
    return text.substr(0,max-1)+(text.length>max ? `…`:''); 
}

$(function () {


  var nodes = new vis.DataSet();

  var edges = new vis.DataSet();
  var container = document.getElementById('mynetwork');
  var data = {
    nodes: nodes,
    edges: edges
  };

  var options = _getVisJSOptions();

  var network = new vis.Network(container, data, options);


  function draw() {

    var loadWhoami = $.getJSON("/whoami.json");
    var loadServices = $.getJSON('/list.json');

    $.when(loadWhoami, loadServices).then(function (whoamiResult, servicesResult) {

      console.log(servicesResult);
      nodes.clear();
      edges.clear();


      var whoami = whoamiResult[0];
      var services = servicesResult[0];



      nodes.add({
        id: ROOT_NODE,
        type: "dot"
      })

      services.forEach(function (item) {

        let { txt = {}, host: host_id } = item;

          const remote_host = txt.originHost ? 
          {
            id: txt.originHost,
            label: txt.originHost.split(".")[0],
            group: "host"
          } 
          : null;

          var host = {
            id: host_id,
            label: item.host.split(".")[0],
            group: "host"
          }

          if (remote_host) {
            host.color = {background: "transparent",hover:{background: "transparent"}, highlight:{background: "transparent"}};
            host.group = "gateway";
          }

          if (!nodes.get(host.id)) {
            nodes.add(host);
  
            edges.add({
              from: ROOT_NODE,
              to: host_id,
              label: item.addresses && item.addresses[1],
              dashes: true
            });
  
          }

          if (remote_host) {
            if (!nodes.get(remote_host.id)) {
              nodes.add(remote_host);
              edges.add({
                from: remote_host.id,
                to: host_id,
                label:null,
                dashes: true,
                length: 300
              });   
            }

   
          }
        



        var app_id = item.name;

        const description = txt.dataset_name || ("(" + item.port+")");
        console.log(description)
        const secondLine = truncateWithEllipses(description, 12);
        console.log(secondLine)
        var app = {
          id: app_id,
          label: item.type + "\n" + secondLine,
          title: toTable(txt),
          group: "app",
          borderWidth:1
        }

        if (!nodes.get(app_id)) {
          nodes.add(app);
          edges.add({
            from: remote_host ? remote_host.id : host_id,
            to: app_id,
            color: {
              inherit: 'to'
            }
          })
        }

      })
    })

  }

  draw();

  var socket = new WebSocket('ws://' + location.host + '/');

  socket.addEventListener("message", function ({data}) {
    console.log(data);
    const {type, ...rest} = JSON.parse(data);
    if (type === "refresh") {
      draw();
    }
    if (type === "activity") {
      const {name, activeRequests} = rest;
      const hostNode = nodes.get(name);
      if (!hostNode)
        return;
      const isActive = (activeRequests > 0);
      console.log(isActive);
      nodes.update({
        ...hostNode, 
        borderWidth: isActive ? 8 :  2,
        color: isActive ? activeNodeColors : nodeColors
      });
    }
  })

})

function _getVisJSOptions() {


  return {
    height: $(window).innerHeight() + "px",
    // "physics": {
    //   "barnesHut": {
    //     "theta": 0.15,
    //     "springLength": 120,
    //     "springConstant": 0.1,
    //     "damping": 0.68,
    //     "avoidOverlap": 0.58
    //   },
    //   "minVelocity": 0.75
    // },
    nodes: {
      size: 25,
      font: {
        size: 15,
        color: '#ffffff'
      },

      borderWidth: 2,
      color: nodeColors,
    },
    edges: {
      width: 1
    },
    groups: {
      host: {
        shape: "circle",
        // font: "14px verdana white",
        // color: nodeColors,
        widthConstraint: {
          minimum: 100
        }
      },
      active_host: {
        shape: "dot",
        // font: "14px verdana white",
        // color: nodeColors,
        widthConstraint: {
          minimum: 100
        }
      },
      gateway: {
        shape: "circle",
        // font: "14px verdana white",
        // borderWidth: 2,
        "shapeProperties": {
          "borderDashes": true
        },
        // color: {...nodeColors, background:"transparent",hover:{...nodeColors.hover, background: "transparent"}}
      },
      app: {
        color: nodeColors,
        shape: 'box',
        font: {
          size:12
        }
      },
      icons: {
        shape: 'icon',
        icon: {
          face: 'FontAwesome',
          code: '\uf0c0',
          size: 50,
          color: 'orange'
        }
      },
      source: {
        color: { border: 'white' }
      }
    },
    "interaction": {
      "hover": true
    }
  };
}
