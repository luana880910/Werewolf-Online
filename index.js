var express = require('express');
var app = express();
var roomID;
var isNight = 0;
var lastFlag = 0;
var id = [0, 0, 0, 1, 1, 1, 2, 3, 4]; //0是村民,1是狼人,2是預言家,3是獵人,4是女巫，作為亂數分配職業用
var users = {}; //玩家
var userID = {}; //玩家狀態(所屬職業)，id亂數分配後的結果
var userNum = {};
var wolfVote = {};
var gameStatus = 0;
var killPeople = "-1";
var witchKill = "0";
var witchSave = "0";
var witchUse = 0;
var findPeople = "0";
var votePeople = "";
var hunterId = 0;
var firstNight = 0;
var vote = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var hasVote = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //是否投票過
var num = [1, 2, 3, 4, 5, 6, 7, 8, 9];
var http = require('http').createServer(app);
var io = require('socket.io')(http);
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});
var count;
app.use(express.static(__dirname + '/image'));

io.on('connection', function(socket) {
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
    socket.on('join', function(userName) {
        socket.join(roomID);
        //console.log(io.nsps['/'].adapter.rooms);	
        count = io.nsps['/'].adapter.rooms[roomID].length;
        users[socket.id] = userName;
        userNum[socket.id] = count;
        // user = userName;
        io.emit('newGamer', users[socket.id], count);
        console.log('目前連線人數: ' + count);
        console.log('新玩家進入: ' + users[socket.id]);
        console.log(socket.id);
    });
    socket.on('disconnect', function() {
        count--;
        console.log('目前連線人數: ' + count);
        io.emit('gamerDisconnect', users[socket.id], count);
        console.log(users[socket.id] + '已離開');
    });

    socket.on('chat message', function(msg) {
        var player = gamer(users[socket.id], userID[socket.id], userNum[socket.id]);
        if (msg.length > 30) {
            console.log(users[socket.id] + ':' + msg);
            console.log(users[socket.id] + '輸入超過最大上限!');
            io.in(socket.id).emit('server', '您超過輸入字元最大上限(30字)!!'); //為避免超過介面，規定不超過30字
        } else if (msg == "" || msg == " ") {
            io.in(socket.id).emit('server', '輸入不可為空。');
        } else if (msg.substr(0, 6) == "/start") {
            start();
        } else if (gameStatus == 1) {
            if (player.id == -1) {
                io.in(socket.id).emit('server', '您為觀戰狀態，不能講話。'); //玩家已死，userID設為-1，即觀戰狀態。
            } else if (isNight != player.id && isNight != 0) { //isnight==0時，為白天狀態，任何未死玩家都能說話；
                io.in(socket.id).emit('server', '現在是夜晚，還不到你講話的時間。');
                /*isnight!=0時，為黑夜狀態，平民 userID為0，所以只能在白天(isnight==0)說話；
                其他職業要在isnight對應到自己職業的userID時，才能發言。*/
            } else if (msg.substr(0, 6) == "/vote ") {
                console.log(users[socket.id] + ':' + msg);
                io.in(socket.id).emit('server', users[socket.id] + ":" + msg);
    
                if (gameStatus == 1 && isNight == 0) { //因為投票是白天狀態(isNight == 0)唯一能做的遊戲功能，所以用gameStatus表示遊戲是否開始，如果未開始就不能用投票功能。
                    var voteNum = 0;
                    for (var i = 0; i < num.length; i++) {
                        if (msg.substr(6, msg.length - 6) == users[num[i]]) {
                            if (userID[num[i]] == -1) {
                                io.in(socket.id).emit('server', "此人已死亡");
                                break;
                            } else if (hasVote[player.num] == 0) {
                                vote[i]++;
                                console.log(vote);
                                io.emit('server', users[num[i]] + "被" + users[socket.id] + "投了一票。");
                                hasVote[player.num] = 1;
                                break;
                            } else {
                                console.log(player.name + '已經投過票');
                                io.in(socket.id).emit('server', "你已經投過票了。");
                                break;
                            }
                        } else if (i == num.length - 1) {
                            io.in(socket.id).emit('server', "沒有此人");
                        }
                    }
                    for (var i = 0; i < num.length; i++) {
                        voteNum += vote[i];
                    }
                }
                var idNum = 0;
                for (var t = 0; t < 9; t++) {
                    if (userID[num[t]] != -1) {
                        idNum++;
                    }
                }
                console.log(hasVote);
                console.log("目前投票人數: " + voteNum + " / " + idNum);
                io.emit('server', "目前投票人數: " + voteNum + " / " + idNum);
                if (voteNum == idNum) {
                    var temp = 0;
                    for (var i = 0; i < num.length; i++) {
                        if (vote[temp] < vote[i]) {
                            votePeople = num[i];
                        }
                    }
    
                    io.emit('server', users[votePeople] + "被投票出去。");
                    userID[votePeople] = -1;
                    for (var i = 0; i < num.length; i++) {
                        hasVote[i] = 0;
                        vote[i] = 0;
                    }
                    // num.splice(votePeople - 1, 1);
                    votePeople = 0;
                    if(gameRule() != ""){
                        io.emit('server', gameRule());
                        gameStatus = 0;
                    }else{
                        nightStart();
                    }
                }
            } else if (isNight == 1) { //狼人時間，只有狼人能說話，且只有狼人看得見
                wolfTime(player.name, socket.id, msg);
            } else if (isNight == 2) { //預言家時間，只有預言家能說話
                prophetTime(player.name, socket.id, msg);
            } else if (isNight == 3) { //獵人時間，只有獵人可以看到
                hunterTime(player.name, socket.id, msg);
            } else if (isNight == 4) { //女巫&判斷時間，只有女巫能說話
                witchTime(player.name, socket.id, msg);
            } else {
                console.log(users[socket.id] + ':' + msg);
                io.emit('chat message', users[socket.id], msg);
            }
        } else {
            console.log(users[socket.id] + ':' + msg);
            io.emit('chat message', users[socket.id], msg);
        }
    });
    //code before the pause
    function start() {
        //do what you need here
        if (count == 9 && gameStatus == 0) {
            io.emit('server', "遊戲開始");
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
                nightStart();
            });

        } else if (gameStatus == 1 && userID[socket.id] == undefined) {
            io.in(socket.id).emit('server', "遊戲已開始，您為觀戰狀態。");
            userID[socket.id] = -1;
        } else if (count < 9 && gameStatus == 0) {
            io.emit('server', "遊戲人數未到達!請耐心等待遊戲開始!(" + count + "/9)");
        }
    }

    function nightStart() {
        isNight = 1;
        io.emit('server', '天黑請閉眼，狼人請睜眼。');
        vote = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    // function voteCheck() {

    // }
});
http.listen(3000, function() {
    console.log('listening on *:3000');
});

function gamer(name, id, num) {
    var gamer = {};
    gamer.name = name;
    gamer.id = id;
    gamer.num = num;
    return gamer;
}

function wolfTime(name, id, msg) {
    for (var j = 0; j < num.length; j++) {
        if (userID[num[j]] == 1) {
            io.in(num[j]).emit('chat message', name, msg);
        }
    }
    if (msg.substr(0, 6) == "/kill ") {
        for (var i = 0; i < num.length; i++) {
            if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] != -1) {
                killPeople = num[i];
                gameThread();
                break;
            } else if (msg.substr(6, msg.length - 6) == "not") {
                killPeople = 0;
                gameThread();
                break;
            } else if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] == -1) {
                io.in(id).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
    }
    if (killPeople == "-1" && msg.substr(0, 6) == "/kill ") {
        io.in(id).emit('server', "沒有此人，請重新輸入。");
    }
    console.log(name + ':' + msg);
}

function gameThread() {
    isNight = 4;
    io.emit('server', "狼人請閉眼，女巫請睜眼，您有30秒的時間可以執行技能。");
    for (var m = 0; m < num.length; m++) {
        if (userID[num[m]] == 4) {
            if (killPeople != "0" && witchSave != "-1") {
                io.in(num[m]).emit('savePeople', users[killPeople]);
            } else {
                io.in(num[m]).emit('savePeople', "? ? ?");
            }
        }
    }
    setTimeout(function() {
        isNight = 2;
        io.emit('server', "女巫請閉眼，預言家請睜眼，您有30秒的時間可以執行技能。");
        setTimeout(function() {
            io.emit('server', "預言家請閉眼，獵人請睜眼。");
            for (var m = 0; m < num.length; m++) {
                if (userID[num[m]] == 3) {
                    if (num[m] == witchKill) {
                        io.in(num[m]).emit('huntPeople', "不能開槍");
                    } else {
                        io.in(num[m]).emit('huntPeople', "可以開槍");
                    }
                }
            }
            isNight = 0;
            io.emit('server', "天亮了。");
            nightEnd();
        }, 30000);
    }, 30000);


}

function prophetTime(name, id, msg) {
    io.in(id).emit('chat message', name, msg);
    var findP = -1;
    if (msg.substr(0, 6) == "/find " && findPeople == "0") {
        for (var i = 0; i < num.length; i++) {
            if (msg.substr(6, msg.length - 6) == users[num[i]]) {
                io.in(id).emit('findPeople', users[num[i]], userID[num[i]]);
                findP = 0;
                findPeople = "-1";
            }
        }
    } else if (findPeople == "-1") {
        findP = 0;
        io.in(id).emit('server', "此輪已使用技能。");
    }
    if (findP == -1) {
        io.in(id).emit('server', "沒有此人，請重新輸入。");
    }
    console.log(name + ':' + msg);
}

function hunterTime(name, id, msg) {
    io.in(id).emit('chat message', name, msg);
    if (msg.substr(0, 6) == "/kill " && userID[hunterId] == 3) {
        for (var i = 0; i < num.length; i++) {
            if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] != -1) {
                userID[num[i]] = -1;
                io.emit('server', users[num[i]] + "被開槍帶走了。");
                userID[hunterId] = -1;
                isNight = 0;
                io.emit('server', "請辯論後，投票出你們認為的狼人。");
                break;
            } else if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] == -1) {
                io.in(id).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
    } else if (msg.substr(0, 6) == "/kill " && userID[hunterId] != 3){
        io.in(id).emit('server', "您的技能被封印了。");
    }
}

function witchTime(name, id, msg) {

    io.in(id).emit('chat message', name, msg);
    if (msg.substr(0, 6) == "/kill " && witchKill == "0" && witchUse == 0) {
        var killP = -1;
        witchUse = 1;
        for (var i = 0; i < num.length; i++) {
            if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] != -1) {
                witchKill = num[i];
                killP = 0;
                io.in(id).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == users[num[i]] && userID[num[i]] == -1) {
                io.in(id).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
        if (killP == -1) {
            io.in(id).emit('server', "沒有此人，請重新輸入。");
        }
    } else if (msg.substr(0, 6) == "/kill " && witchKill == "0" && witchUse == 1) {
        io.in(id).emit('server', "此輪已使用技能。");
    } else if (msg.substr(0, 6) == "/kill " && witchKill == "-1") {
        io.in(id).emit('server', "您已使用過毒藥");
    }

    if (msg.substr(0, 6) == "/save " && witchSave == "0" && witchUse == 0) {
        var saveP = -1;
        witchUse = 1;
        for (var i = 0; i < num.length; i++) {
            if (msg.substr(6, msg.length - 6) == users[num[i]] && num[i] == killPeople && userID[killPeople] != 4) {
                killPeople = 0;
                witchSave = -1;
                saveP = 0;
                io.in(id).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == users[num[i]] && num[i] == killPeople && userID[killPeople] == 4 && firstNight == 0) {
                killPeople = 0;
                witchSave = -1;
                saveP = 0;
                io.in(id).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == users[num[i]] && num[i] == killPeople && userID[killPeople] == 4 && firstNight != 0) {
                io.in(id).emit('server', "您不能自救");
                saveP = 0;
                break;
            }
        }
        if (saveP == -1) {
            io.in(id).emit('server', "沒有此人，或此人並沒受到攻擊，請重新輸入。");
        }
    } else if (msg.substr(0, 6) == "/save " && witchSave == "0" && witchUse == 1) {
        io.in(id).emit('server', "此輪已使用技能。");
    } else if (msg.substr(0, 6) == "/save" && witchSave == "-1") {
        io.in(id).emit('server', "您已使用過解藥");
    }
    console.log(users[id] + ':' + msg);
}


function nightEnd() {
    findPeople = "0";
    witchUse = 0;
    firstNight = 1;
    if (userID[killPeople] == 3 && userID[witchKill] != 3) {
        hunterId = killPeople;
    }
    if (killPeople == "0" && (witchKill == "0" || witchKill == "-1")) {
        io.emit('server', "昨晚是個平安夜。");
    } else if (killPeople == "0") {
        io.emit('server', users[witchKill] + "昨晚被殺了。");
        // num.splice(witchKill - 1, 1);
        userID[witchKill] = -1;
        witchKill = "-1";
    } else if (witchKill == "0" || witchKill == "-1") {
        io.emit('server', users[killPeople] + "昨晚被殺了。");
        // num.splice(killPeople - 1, 1);
        userID[killPeople] = -1;
        killPeople = "0";
    } else if (killPeople == witchKill) {
        io.emit('server', users[killPeople] + "昨晚被殺了。");
        userID[witchKill] = -1;
        witchKill = "-1";
        userID[killPeople] = -1;
        killPeople = "0";
    } else {
        io.emit('server', users[witchKill] + "和" + users[killPeople] + "昨晚被殺了。");
        // num.splice(witchKill - 1, 1);
        userID[witchKill] = -1;
        witchKill = "-1";
        // num.splice(killPeople - 1, 1);
        userID[killPeople] = -1;
        killPeople = "0";
    }
    isNight = 3;
    if (hunterId != 0) {
        userID[hunterId] = 3;
    }

    io.emit('server', "有30秒鐘的時間可以開技能。");
    setTimeout(function() {
        if (isNight == 3) {
            userID[hunterId] = -1;
            isNight = 0;
            // lastWords();
            io.emit('server', "請辯論後，投票出你們認為的狼人。");
        }
    }, 30000);
    if(gameRule() != ""){
        io.emit('server', gameRule());
        gameStatus = 0;
    }

}

function gameRule() {
    var tempList = [];
    for (var i = 0; i < num.length; i++) {
        tempList[i] = userID[num[i]];
    }
    console.log(tempList);
    var BadPeople = 0;
    var GoodPeople = 0;
    var GodPeople = 0;
    for (var j = 0; j < num.length; j++) {
        if(tempList[j] == 1){
            BadPeople = 1;
        }
        else if(tempList[j] == 0) {
            GoodPeople = 1;
        }
        else if(tempList[j] == 2||tempList[j] == 3||tempList[j] == 4){
            GodPeople = 1;
        }
    }
    if (GoodPeople == 0 || GodPeople==0) {
        return "遊戲結束，狼人獲勝。";
    }
    else if(BadPeople == 0){
        return "遊戲結束，好人獲勝。";
    }
    else{
        return "";
    }
}