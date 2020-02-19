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
  var options = {
    height: $(window).innerHeight() + "px"
  };
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
          color: item.port == 9 ? "#eee" : "#aaa"
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