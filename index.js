var express = require('express');
var app = express();
var roomID;
var isNight = 0;
var users = {};
var userID = {};
var vote = {};
var wolfVote = {};
var gameStatus = 0;
var killPeople = "-1";
var witchKill = "0";
var witchSave = "0";
var votePeople = 0;
var id = [0, 0, 0, 1, 1, 1, 2, 3, 4];//0是村民,1是狼人,2是預言家,3是獵人,4是女巫
var num = [1, 2, 3, 4, 5, 6, 7, 8, 9];
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
    console.log('目前連線人數: ' + count);
    io.emit('gamerDisconnect', user, count);
    console.log(user + '已離開');
  });
  socket.on('chat message', function (msg) {
    if (userID[socket.id] == -1) {
      io.in(socket.id).emit('server', '您為觀戰狀態，不能講話。');
    }
    else if (isNight != userID[socket.id] && isNight != -1) {
      io.in(socket.id).emit('server', '現在是夜晚，還不到你講話的時間。');
    }
    else if (isNight == 1) {
      for (var j = 0; j < num.length; j++) {
        if (userID[num[j]] == 1) {
          io.in(num[j]).emit('chat message', users[socket.id], msg);
        }
      }
      if (msg.substr(0, 6) == "/kill ") {
        for (var i = 0; i < num.length; i++) {
          if (msg.substr(6, msg.length - 6) == users[num[i]]) {
            killPeople = num[i];
            isNight = 2;
            io.emit('server', "狼人請閉眼，預言家請睜眼。");
            break;
          }
          else if (msg.substr(6, msg.length - 6) == "not") {
            killPeople = 0;
          }
          else {
            killPeople = -1;

          }
        }
      }
      if (killPeople == "-1" && msg.substr(0, 6) == "/kill ") {
        io.in(socket.id).emit('server', "沒有此人，請重新輸入。");
      }
      console.log(users[socket.id] + ':' + msg);
    }
    else if (isNight == 2) {
      io.in(socket.id).emit('chat message', users[socket.id], msg);
      var findP = -1;
      if (msg.substr(0, 6) == "/find ") {
        for (var i = 0; i < num.length; i++) {
          if (msg.substr(6, msg.length - 6) == users[num[i]]) {
            io.in(socket.id).emit('findPeople', users[num[i]], userID[num[i]]);
            findP = 0;
            isNight = 4;
            io.emit('server', "預言家請閉眼，女巫請睜眼。");
            for (var m = 0; m < num.length; m++) {
              if (userID[num[m]] == 4) {
                if (killPeople != "0") {
                  io.in(num[m]).emit('savePeople', users[killPeople]);
                }
              }
            }
          }
        }
      }
      if (findP == "-1") {
        io.in(socket.id).emit('server', "沒有此人，請重新輸入。");
      }
      console.log(users[socket.id] + ':' + msg);
    }
    else if (isNight == 4) {
      io.in(socket.id).emit('chat message', users[socket.id], msg);
      if (msg.substr(0, 6) == "/kill " && witchKill != "-1") {
        var killP = -1;
        for (var i = 0; i < num.length; i++) {
          if (msg.substr(6, msg.length - 6) == users[num[i]]) {
            witchKill = num[i];
            isNight = -1;
            killP = 0;
            io.emit('server', "天亮了。");
            nightEnd();
            break;
          }
        }
        if (killP == -1) {
          io.in(socket.id).emit('server', "沒有此人，或此人並沒受到攻擊，請重新輸入。");
        }
      }
      if (msg.substr(0, 6) == "/save " && witchSave != "-1") {
        var saveP = -1;
        for (var i = 0; i < num.length; i++) {
          if (msg.substr(6, msg.length - 6) == users[num[i]] && num[i] == killPeople) {
            killPeople = 0;
            witchSave = -1;
            isNight = -1;
            saveP = 0;
            io.emit('server', "天亮了。");
            nightEnd();
            break;
          }
        }
        if (saveP == -1) {
          io.in(socket.id).emit('server', "沒有此人，或此人並沒受到攻擊，請重新輸入。");
        }
      }
      if (msg.substr(0, 5) == "/notDo") {
        isNight = -1;
        io.emit('server', "天亮了。");
        nightEnd();
      }
      console.log(users[socket.id] + ':' + msg);
    }
    else if (msg.length > 30) {
      console.log(users[socket.id] + ':' + msg);
      console.log(users[socket.id] + '輸入超過最大上限!');
      io.in(socket.id).emit('server', '您超過輸入字元最大上限(30字)!!');
    }
    else if (msg == "" || msg == " ") {
      io.in(socket.id).emit('server', '輸入不可為空。');
    }
    else if (msg.substr(0, 6) == "/vote ") {
      console.log(users[socket.id] + ':' + msg);
      var voteNum = 0;
      console.log(voteNum);
      io.emit('chat message', users[socket.id], msg);
      for (var i = 0; i < num.length; i++) {
        if (msg.substr(6, msg.length - 6) == users[num[i]]) {
          vote[num]++;
          io.emit('server', users[num[i]] + "被" + users[socket.id] + "投了一票。");
          break;
        }
        voteNum += vote[num];
      }
      var idNum = 0;
      for (var t = 0; t < id.length; t++) {
        if (id[t] != -1) {
          idNum++;
        }
      }
      console.log(voteNum);
      io.emit('server', "目前投票人數: " + voteNum + " / " + idNum);
      if (voteNum == idNum) {
        for (var i = 0; i < num.length; i++) {
          if (vote[votePeople] < vote[num[i]]) {
            votePeople = num[i];
          }
        }
        io.emit('server', user[votePeople] + "被投票出去。");
        votePeople = 0;
        isNight = 1;
        io.emit('server', '天黑請閉眼，狼人請睜眼。');
      }
    }
    else {
      console.log(users[socket.id] + ':' + msg);
      io.emit('chat message', users[socket.id], msg);
    }
  });
  //code before the pause
  setTimeout(function () {
    //do what you need here
    if (count == 9 && gameStatus == 0) {
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
        for (var i = 0; i < clients.length; i++) {
          io.in(clients[i]).emit('giveID', id[i]);
          userID[clients[i]] = id[i];
          num[i] = clients[i];
          console.log(clients[i] + " is " + id[i]);
        }
      });
      setTimeout(function () {

        isNight = 1;
        io.emit('server', '天黑請閉眼，狼人請睜眼。');
      }, 1000);
    }
    else if (gameStatus == 1 && userID[socket.id] == undefined) {
      io.in(socket.id).emit('server', "遊戲已開始，您為觀戰狀態。");
      userID[socket.id] = -1;
    }
    else if (count < 9 && gameStatus == 0) {
      io.emit('server', "遊戲人數未到達!請耐心等待遊戲開始!(" + count + "/9)");
    }
  }, 1000);
  function nightEnd() {
    if (killPeople == "0" || witchKill == "0") {
      io.emit('server', "昨晚是個平安夜。");
      io.emit('server', "請辯論後，投票出你們認為的狼人。");
    }
    else if (killPeople == "0") {
      witchKill = -1;
      io.emit('server', users[witchKill] + "昨晚被殺了。");
      userID[witchKill] = -1;
      killPeople = -1;
      io.emit('server', "請辯論後，投票出你們認為的狼人。");
    }
    else {
      io.emit('server', users[killPeople] + "昨晚被殺了。");
      userID[killPeople] = -1;
      killPeople = -1;
      io.emit('server', "請辯論後，投票出你們認為的狼人。");
    }
  }
});
http.listen(3000, function () {
  console.log('listening on *:3000');
});