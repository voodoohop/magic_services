const {keys, entries} = Object;

function toTable(obj) {
  if (!obj)
    return "";
  return `<table>${entries(obj).map(([key,value]) => `<tr><td><b>${key}</b></td><td>${value}</td></tr>`).join(" ")}</table>`
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
        id: "9587",
        type: "dot"
      })

      services.forEach(function (item) {
        var host_id = item.host;

        var host = {
          id: host_id,
          label: item.host.split(".")[0],
          shape: "dot",
          font: "14px verdana white"
        }

        if (!nodes.get(host.id)) {
          nodes.add(host);

          edges.add({
            from: "9587",
            to: host_id,
            label: item.addresses && item.addresses[1],
            dashes: true
          });

        }

        var app_id = item.name;
        console.log(toTable(item.txtRecord))
        var app = {
          id: app_id,
          label: item.type + ":" + item.port,
          title: toTable(item.txt),
          shape: "box",
          color: item.port == 9 ? "#eee" : "#aaa",
          group: "diamonds"
        }

        if (!nodes.get(app_id)) {
          nodes.add(app);
          edges.add({
            from: host_id,
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

  socket.addEventListener("message", function (e) {
    draw();
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
      shape: 'dot',
      size: 20,
      font: {
        size: 15,
        color: '#ffffff'
      },
      borderWidth: 2
    },
    edges: {
      width: 2
    },
    groups: {
      diamonds: {
        color: { background: 'transparent', border: 'white' },
        shape: 'diamond'
      },
      dotsWithLabel: {
        label: "I'm a dot!",
        shape: 'dot',
        color: 'cyan'
      },
      mints: { color: 'rgb(0,255,140)' },
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
    }
  };
}
