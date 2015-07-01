var zoom = 1;
var nodes = {};
var myNodes = [];
var playerx,playery;
var startx = 2000,starty = 2000;
var mousex,mousey;
var canvas;
var socket = null;
var splitKey = 32;
var qKey = 81;
var wKey = 87;
var splitKeyPressed = false;
var qKeyPressed = false;
var wKeyPressed = false;
var b_left,b_top,b_right,b_bottom;

window.onload = function () {
  console.log('init');
  canvas = document.getElementById("canvas");
  canvas.onmousemove = function(e) {
    mousex = e.clientX;
    mousey = e.clientY;
  };
  window.onkeydown = onKeyDown;
  window.onkeyup = onKeyUp;
  setInterval(tick, 100);
}

var Node = function(x, y, radius, name, virus) {
  this.x = x;
  this.y = y;
  this.radius = radius;
  if (name) {
    this.name = name;
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
  nodes = {};
  myNodes = [];
  url = document.getElementById('url').value;
  socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';

  window.onresize = onWindowResize;
  onWindowResize ();

  canvas.focus();

  socket.onopen = function (event) {
    sendPacket(socket, 254);
    sendPacket(socket, 255);
    sendPacket(socket, 0, document.getElementById('nickname').value);
    sendPacket(socket, 16, [10,10]);
    //~ drawCircle(125,125,100);
  }

  socket.onmessage = function (event) {
    var view = new DataView(event.data);
    var packetId = view.getUint8(0, true);
    console.log('received packetId', packetId);

    switch (packetId) {
      case 16: // Update nodes
          var nbNodesToDestroy = view.getUint16(1, true);
          console.log('nbNodesToDestroy', nbNodesToDestroy);
          var i = 3;
          for (var j = 0; j < nbNodesToDestroy; ++j) {
            var killerId = view.getUint32(i, true);
            i+=4;
            var killedId = view.getUint32(i, true);
            i+=4;
            var n;
            if ((n = myNodes.indexOf(killedId)) > -1) {
              myNodes.splice(n, 1);
            }
            delete nodes[killedId];
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
            if (nodes[nodeId] == null) {
              nodes[nodeId] = new Node(x,y,radius,nodeName,virus);
            } else {
              nodes[nodeId].update(x,y,radius);
            }
            var nodeId = view.getUint32(i, true);
            i+=4;
          }
          i+=2;
          nbNodesToDestroy = view.getUint16(i, true);
          console.log('nbNodesToDestroy', nbNodesToDestroy);
          i+=2;
          for (var j = 0; j < nbNodesToDestroy; ++j) {
            var killedId = view.getUint32(i, true);
            i+=4;
            delete nodes[killedId];
          }
          break;
      case 17: // Update position and size
      case 20: // Clear all nodes
      case 21: // Draw line
          alert(packetId);
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
          b_left = view.getFloat64(1, true);
          b_top = view.getFloat64(9, true);
          b_right = view.getFloat64(17, true);
          b_bottom = view.getFloat64(25, true);
          console.log('setBorder', b_left,b_top,b_right,b_bottom);
          break;
      default:
          console.log('received unknown packetId', packetId);
          break;
    }
  };
}

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
    case 17:
    case 18:
    case 19:
    case 21:
    size = 1;
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
    case 17:
    case 18:
    case 19:
    case 21:
    break;
    case 254:
      view.setUint32(1, 4, true);
    break;
    case 255:
      view.setUint32(1, 673720361, true);
    break;
  }
  socket.send(view);
}

function tick() {
  if (socket == null) {
    return;
  }
  drawScreen();
  sendPacket(socket, 16, [startx+mousex,starty+mousey]);
}

function drawScreen() {
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (myNodes.length > 0) {
    startx = nodes[myNodes[0]].x - canvas.width/2;
    starty = nodes[myNodes[0]].y - canvas.height/2;
  }
  for (var i in nodes) {
    drawCircle(nodes[i].x-startx, nodes[i].y-starty, nodes[i].radius, nodes[i].name);
  }
  ctx.strokeRect(b_left-startx,b_top-starty,b_right-b_left,b_bottom-b_top);
}

function drawCircle(x, y, radius, text) {
  // Full circle
  if (canvas.getContext) {
    var ctx = canvas.getContext("2d");

    ctx.beginPath();
    ctx.arc(x*zoom, y*zoom, radius*zoom, 0, Math.PI*2, false);
    ctx.closePath();
    ctx.stroke();

    if (text) {
      ctx.font = "30px Serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y);
    }
  }
}

function onKeyDown (event)
{
  console.log("key", event.keyCode);
  if ((event.keyCode == splitKey) && !splitKeyPressed) {
    splitKeyPressed = true;
    sendPacket(socket, 17);
  } else if ((event.keyCode == wKey) && !wKeyPressed) {
    wKeyPressed = true;
    sendPacket(socket, 21);
  } else if ((event.keyCode == qKey) && !qKeyPressed) {
    qKeyPressed = true;
    sendPacket(socket, 18);
  }
}

function onKeyUp (event)
{
  if ((event.keyCode == splitKey) && splitKeyPressed) {
    splitKeyPressed = false;
  } else if ((event.keyCode == wKey) && wKeyPressed) {
    wKeyPressed = false;
  } else if ((event.keyCode == qKey) && qKeyPressed) {
    qKeyPressed = false;
    sendPacket(socket, 19);
  }

}

function onWindowResize ()
{
  canvas.width = window.innerWidth-20;
  title = document.getElementById("title");
  if(title.offsetHeight)          {titleHeight=title.offsetHeight;}
  else if(title.style.pixelHeight){titleHeight=title.style.pixelHeight;}
  canvas.height = window.innerHeight-titleHeight-50;
}
