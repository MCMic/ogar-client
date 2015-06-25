var zoom = 1;
var nodes = [];
var myNodes = [];
var playerx,playery;
var canvas = document.getElementById("canvas");

var Node = function(x, y, radius, name, virus) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  if (name) {
    this.name = name;
  } else {
    this.name = "No name";
  }
  if (virus) {
    this.rgb = [0,0,0];
  } else {
    this.rgb = [255,0,0];
  }
  this.virus = virus;
}
Node.prototype.update = function (x, y, radius) {
  this.x = x;
  this.y = y;
  this.radius = radius;
}

function connect() {
  url = document.getElementById('url').value;
  socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';

  window.onresize = onWindowResize;
  onWindowResize ();

  socket.onopen = function (event) {
    sendPacket(socket, 254);
    sendPacket(socket, 255);
    sendPacket(socket, 0, document.getElementById('nickname').value);
    sendPacket(socket, 16, [10,10]);
    //~ drawCircle(125,125,100);
  }

  socket.onmessage = function (event) {
    console.log('recv message', event);
    var view = new DataView(event.data);
    var packetId = view.getUint8(0, true);
          console.log('received packetId', packetId);

    switch (packetId) {
      case 16: // Update nodes
          console.log('recv packetId', 'Update Nodes');
          var nbNodesToDestroy = view.getUint16(1, true);
            console.log('nbNodesToDestroy', nbNodesToDestroy);
          var i = 3;
          for (var j = 0; j < nbNodesToDestroy; ++j) {
            var killerId = view.getUint32(i, true);
            i+=4;
            var killedId = view.getUint32(i, true);
            i+=4;
          }
          var nodeId = view.getUint32(i, true);
          i+=4;
          while (nodeId != 0) {
            var x = view.getUint16(i, true);
            i+=2;
            var y = view.getUint16(i, true);
            i+=2;
            var radius = view.getUint16(i, true);
            i+=2;
            var r = view.getUint8(i++, true);
            var g = view.getUint8(i++, true);
            var b = view.getUint8(i++, true);
            var flags = view.getUint8(i++, true);
            var virus = !!(flags & 1);
            flags & 2 && (i += 4);
            flags & 4 && (i += 8);
            flags & 8 && (i += 16);
            var nodeName;
            for (nodeName = ""; ; ) {
                var c = view.getUint16(i, true);
                i+=2;
                if (c == 0)
                    break;
                nodeName += String.fromCharCode(c)
            }
            console.log('node', nodeId, x,y,radius,nodeName);
            var nodeId = view.getUint32(i, true);
            i+=4;
            if (nodes[nodeId] == null) {
              nodes[nodeId] = new Node(x,y,radius,nodeName,virus);
            } else {
              nodes[nodeId].update(x,y,radius);
            }
          }
          i+=2;
          nbNodesToDestroy = view.getUint16(i, true);
          console.log('nbNodesToDestroy', nbNodesToDestroy);
          i+=2;
          for (var j = 0; j < nbNodesToDestroy; ++j) {
            var killedId = view.getUint32(i, true);
            nodes[killedId] = null;
            i+=4;
            socket.close();
          }
          drawScreen();
          break;
      case 17: // Update position and size
          socket.close();
          break;
      case 20: // Clear all nodes
          socket.close();
          break;
      case 21: // Draw line
          socket.close();
          break;
      case 32: // Add node
          var nodeId = view.getUint32(1, true);
          myNodes.push(nodeId);
          console.log('myNodes', myNodes);
          break;
      case 49: // Update leaderboard FFA
          var i = 1;
          var nbScores = view.getUint32(i, true);
          i+=4;
          var board = "<ol>";
          for (var j=0; j<nbScores; ++j) {
            var nodeId = view.getUint32(i, true);
            i+=4;
            var nodeName;
            for (nodeName = ""; ; ) {
                var c = view.getUint16(i, true);
                i+=2;
                if (c == 0)
                    break;
                nodeName += String.fromCharCode(c)
            }
            console.log('Leaderboard', j, nodeName);
            board += "<li>"+nodeName+"</li>";
          }
          board += "</ol>";
          document.getElementById('leaderboard').innerHTML = board;
          break;
      case 50: // Update leaderboard team
          break;
      case 64: // Set border
          var left = view.getFloat64(1, true);
          var top = view.getFloat64(9, true);
          var right = view.getFloat64(17, true);
          var bottom = view.getFloat64(25, true);
          console.log('setBorder', left,top,right,bottom);
          break;
      default:
          console.log('received unknown packetId', packetId);
          break;
    }
  };

  function sendPacket(socket, packetId, data)
  {
    var size;
    switch (packetId) {
      case 0:
      size = 1 + 2*data.length;
      break;
      case 16:
      size = 21;
      break;
      case 254:
      case 255:
      size = 5;
      break;
    }
    var buf = new ArrayBuffer(size);
    var view = new DataView(buf);

    view.setUint8(0, packetId, true);
    switch (packetId) {
      case 0:
        console.log('sending', data);
        var i = 1
        for (var j = 0; j < data.length; j++) {
          var c = data.charCodeAt(j);
          if (c) {
            view.setUint16(i, c, true);
          }
          i += 2;
        }
      break;
      case 16:
        console.log('sending', data);
        view.setFloat64(1, data[0], true);
        view.setFloat64(9, data[1], true);
        view.setUint32(17, 0, true);
      case 254:
        view.setUint32(1, 4, true);
      break;
      case 255:
        view.setUint32(1, 673720361, true);
      break;
    }
    socket.send(view);
  }
}

function drawScreen() {
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var startx = nodes[myNodes[0]].x - canvas.width/2;
  var starty = nodes[myNodes[0]].y - canvas.height/2;
  for (var i in nodes) {
    drawCircle(nodes[i].x-startx, nodes[i].y-starty, nodes[i].radius);
  }
}

function drawCircle(x, y, radius) {
  // Full circle
  if (canvas.getContext) {
    var ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.arc(x*zoom, y*zoom, radius*zoom, 0, Math.PI*2, false);
    ctx.closePath();

    ctx.fill();
  }
}

function onWindowResize ()
{
  canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
