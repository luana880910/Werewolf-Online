var express = require('express');
var app = express();
var roomID;
var users = {};
var gameStatus = 0;
var id = [0, 0, 0, 1, 1, 1, 2, 3, 4];//0是村民,1是狼人,2是預言家,3是獵人,4是女巫
var http = require('http').createServer(app);
var io = require('socket.io')(http);
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
var count;
app.use(express.static(__dirname + '/image'));

io.on('connection', function (socket) {
  // socket.join('room 1', () => {
  //   let rooms = Object.keys(socket.rooms);
  //   console.log(rooms); // [ <socket.id>, 'room 1' ]
  // });
  var url = socket.request.headers.referer;
  var splited = url.split('/');
  var roomID = splited[splited.length - 1];
  if (roomID == '') {
    roomID = 'index';
  }
  socket.on('join', function (userName) {
    socket.join(roomID);
    user = userName;
    //console.log(io.nsps['/'].adapter.rooms);	
    users[socket.id] = userName;

    count = io.nsps['/'].adapter.rooms[roomID].length;
    // user = userName;
    io.emit('newGamer', user, count);
    console.log('目前連線人數: ' + count);
    console.log('新玩家進入: ' + user);
  });
  socket.on('disconnect', function () {
    console.log('user disconnected');
    console.log('目前連線人數: ' + count);
    io.emit('gamerDisconnect', user, count);
    console.log(user + '已離開');
  });
  socket.on('chat message', function (msg) {
    console.log(users[socket.id] + ':' + msg);
    io.emit('chat message', users[socket.id], msg);
  });
  //code before the pause
  setTimeout(function () {
    //do what you need here
    if (count == 3 && gameStatus == 0) {
      gameStatus = 1;
      for (var i = 0; i < id.length; i++) {
        var iRand = parseInt(id.length * Math.random());
        var temp = id[i];
        id[i] = id[iRand];
        id[iRand] = temp;
      }
      io.clients((error, clients) => {
        if (error) throw error;
        console.log(clients);
        for (var i = 0; i < 9; i++) {
          io.in(clients[i]).emit('giveID', id[i]);
          console.log(clients[i] + "is" + id[i]);
        }
      });
    }
  }, 1000);

});

http.listen(3000, function () {
  console.log('listening on *:3000');
});