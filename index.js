const e = require('express');
var express = require('express');
var app = express();
var isNight = 0; //遊戲階段
var id = [0, 0, 0, 1, 1, 1, 2, 3, 4]; //0是村民,1是狼人,2是預言家,3是獵人,4是女巫，作為亂數分配職業用
var gamer; //目前的玩家
var gamers = []; //全部的玩家
var users = {}; //房間人員
var gameStatus = 0;
var killPeople = -1;
var witchKill = -1;
var witchSave = -1;
var witchUse = 0;
var hunterUse = 0;
var findPeople = 0;
var votePeople = "";
var hunterId = -1;
var firstNight = 0;
var vote = [0, 0, 0, 0, 0, 0, 0, 0, 0]; //被投票的數量
var hasVote = [0, 0, 0, 0, 0, 0, 0, 0, 0]; //是否投票過
var count; //房間人數
var http = require('http').createServer(app);
var io = require('socket.io')(http);
http.listen(3000, function () {
    console.log('listening on *:3000');
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use(express.static(__dirname + '/image'));

io.on('connection', function (socket) {
    var url = socket.request.headers.referer;
    var splited = url.split('/');
    var roomID = splited[splited.length - 1];
    if (roomID == '') {
        roomID = 'index';
    }
    socket.on('join', function (userName) {
        socket.join(roomID);
        count = io.nsps['/'].adapter.rooms[roomID].length;
        users[socket.id] = userName;
        io.emit('newGamer', users[socket.id], count);
        console.log('目前連線人數: ' + count);
        console.log('新玩家進入: ' + users[socket.id]);
        console.log(socket.id);
    });
    socket.on('disconnect', function () {
        count--;
        console.log('目前連線人數: ' + count);
        io.emit('gamerDisconnect', users[socket.id], count);
        console.log(users[socket.id] + '已離開');
    });

    function start() {
        if (count == 9 && gameStatus == 0) {
            io.emit('server', "遊戲開始");
            gameStatus = 1; //數值初始化
            killPeople = -1;
            witchKill = -1;
            witchSave = -1;
            witchUse = 0;
            hunterUse = 0;
            findPeople = 0;
            votePeople = "";
            hunterId = -1;
            firstNight = 0;
            for (var i = 0; i < id.length; i++) { //隨機分配職業(id)
                var iRand = parseInt(id.length * Math.random());
                var temp = id[i];
                id[i] = id[iRand];
                id[iRand] = temp;
            }
            io.clients((error, clients) => {
                if (error) throw error;
                for (var i = 0; i < 9; i++) { //物件建立
                    if (id[i] == 0) {
                        gamers[i] = new Gamer(users[clients[i]], id[i], i + 1, clients[i]);
                    } else if (id[i] == 1) {
                        gamers[i] = new Wolf(users[clients[i]], id[i], i + 1, clients[i]);
                    } else if (id[i] == 2) {
                        gamers[i] = new Prophet(users[clients[i]], id[i], i + 1, clients[i]);
                    } else if (id[i] == 3) {
                        gamers[i] = new Hunter(users[clients[i]], id[i], i + 1, clients[i]);
                    } else if (id[i] == 4) {
                        gamers[i] = new Witch(users[clients[i]], id[i], i + 1, clients[i]);
                    } else {
                        //預計用作非遊玩人員的職業判斷(旁觀者)，如要新增需修改上方「count == 9」的判斷
                    }
                    console.log(gamers[i].name + " is " + gamers[i].id);
                    io.emit('server', gamers[i].name + " 的號碼是：" + gamers[i].id);
                }
                for (var i = 0; i < 9; i++) {
                    io.in(gamers[i].client).emit('giveGamer', gamers[i]); //回傳身分&號碼
                }
                nightStart();
            });
        } else if (gameStatus == 1 && gamer.id == undefined) {
            io.in(gamer.client).emit('server', "遊戲已開始，您為觀戰狀態。");
            gamer.id = -1;
        } else if (count < 9 && gameStatus == 0) {
            io.emit('server', "遊戲人數未到達!請耐心等待遊戲開始!(" + count + "/9)");
        }
    }

    socket.on('chat message', function (msg) {
        if (msg.length > 30) {
            console.log(users[socket.id] + ':' + msg);
            console.log(users[socket.id] + '輸入超過最大上限!');
            io.in(socket.id).emit('server', '您超過輸入字元最大上限(30字)!!'); //為避免超過介面，規定不超過30字
        } else if (msg == "" || msg == " ") {
            io.in(socket.id).emit('server', '輸入不可為空。');
        } else if (msg.substr(0, 6) == "/start") {
            start();
        } else if (gameStatus == 1) {
            for (var i = 0; i < gamers.length; i++) {
                if (gamers[i].client == socket.id) {
                    gamer = gamers[i];
                }
            }
            if (gamer.id == -1) {
                io.in(gamer.client).emit('server', '您為觀戰狀態，不能講話。'); //玩家已死，userID設為-1，即觀戰狀態。
            } else if (isNight != gamer.id && isNight != 0) { //isnight==0時，為白天狀態，任何未死玩家都能說話；
                io.in(gamer.client).emit('server', '現在是夜晚，還不到你講話的時間。');

                /*isnight!=0時，為黑夜狀態，平民 userID為0，所以只能在白天(isnight==0)說話；
                其他職業要在isnight對應到自己職業的userID時，才能發言。*/

            } else if (msg.substr(0, 6) == "/vote ") {
                console.log(gamer.name + ':' + msg);
                io.in(gamer.client).emit('server', gamer.name + "（" + gamer.num + "號）" + ":" + msg);
                var voteNum = 0;
                if (gameStatus == 1 && isNight == 0) { //因為投票是白天狀態(isNight == 0)唯一能做的遊戲功能，所以用gameStatus表示遊戲是否開始，如果未開始就不能用投票功能。
                    for (var i = 0; i < gamers.length; i++) {
                        if (msg.substr(6, msg.length - 6) == gamers[i].num) {
                            if (gamers[i].id == -1) {
                                io.in(gamer.client).emit('server', "此人已死亡");
                                break;
                            } else if (hasVote[gamer.num - 1] == 0) {
                                vote[gamers[i].num - 1]++;
                                console.log(vote);
                                io.emit('server', gamers[i].name + "（" + gamers[i].num + "號）" + "被" + gamer.name + "（" + gamer.num + "號）" + "投了一票。");
                                hasVote[gamer.num - 1] = 1;
                                break;
                            } else {
                                console.log(gamer.name + '已經投過票');
                                io.in(gamer.client).emit('server', "你已經投過票了。");
                                break;
                            }
                        } else if (i == gamers.length - 1) {
                            io.in(gamer.client).emit('server', "沒有此人");
                        }
                    }
                    for (var j = 0; j < gamers.length; j++) {
                        voteNum += vote[j];
                    }
                }
                var idNum = 0;
                for (var t = 0; t < 9; t++) {
                    if (gamers[t].id != -1) {
                        idNum++;
                    }
                }
                console.log(hasVote);
                console.log("目前投票人數: " + voteNum + " / " + idNum);
                io.emit('server', "目前投票人數: " + voteNum + " / " + idNum);
                if (voteNum == idNum) {
                    var temp = 0;
                    for (var i = 0; i < gamers.length; i++) {
                        if (vote[temp] < vote[i]) {
                            temp = i;
                        }
                    }
                    votePeople = temp + 1;
                    for (var i = 0; i < gamers.length; i++) {
                        if (gamers[i].num == votePeople) {
                            if (gamers[i].id == 3) {
                                hunterId = i;
                            } else {
                                gamers[i].id = -1;
                            }
                            break;
                        }
                    }
                    io.emit('server', gamers[temp].name + "（" + gamers[temp].num + "號）" + "被投票出去。");
                    for (var i = 0; i < gamers.length; i++) {
                        hasVote[i] = 0;
                        vote[i] = 0;
                    }
                    votePeople = 0;
                    isNight = 3;
                    io.emit('server', "現在有30秒鐘的時間可以開技能。");
                    setTimeout(function () {
                        if (hunterId != -1) {
                            if (isNight == 3) {
                                gamers[hunterId].id = -1;
                            }
                        }
                        if (gameRule() != "") {
                            io.emit('server', gameRule());
                            gameStatus = 0;
                        } else {
                            nightStart();
                        }
                    }, 30000);
                }
            } else if (isNight == 1) { //狼人時間，只有狼人能說話，且只有狼人看得見
                for (var j = 0; j < gamers.length; j++) {
                    if (gamers[j].id == 1) {
                        io.in(gamers[j].client).emit('chat message', gamer.name + "（" + gamer.num + "號）", msg);
                    }
                }
                if (msg.substr(0, 6) == "/kill ") {
                    gamer.kill(msg);
                }
            } else if (isNight == 2) { //預言家時間，只有預言家能說話
                io.in(gamer.client).emit('chat message', gamer.name + "（" + gamer.num + "號）", msg);
                if (msg.substr(0, 6) == "/find ") {
                    gamer.find(msg);
                }
            } else if (isNight == 3) { //獵人時間，只有獵人可以看到
                io.in(gamer.client).emit('chat message', gamer.name + "（" + gamer.num + "號）", msg);
                if (hunterId > -1) {
                    if (msg.substr(0, 6) == "/kill " && gamers[hunterId].id == 3 && hunterUse == 0) {
                        gamer.kill(msg);
                    } else if (msg.substr(0, 6) == "/kill ") {
                        io.in(gamer.client).emit('server', "您的技能被封印了。");
                    }
                } else if (msg.substr(0, 6) == "/kill " && hunterUse == 1) {
                    io.in(gamer.client).emit('server', "您已開過槍");
                } else if (msg.substr(0, 6) == "/kill ") {
                    io.in(gamer.client).emit('server', "您的技能被封印了。");
                }
            } else if (isNight == 4) { //女巫&判斷時間，只有女巫能說話
                io.in(gamer.client).emit('chat message', gamer.name + "（" + gamer.num + "號）", msg);
                if (msg.substr(0, 6) == "/kill " && witchKill == -1 && witchUse == 0) {
                    gamer.kill(msg);
                } else if (msg.substr(0, 6) == "/kill " && witchKill != -1 && witchUse == 1) {
                    io.in(gamer.client).emit('server', "此輪已使用技能。");
                } else if (msg.substr(0, 6) == "/kill " && witchKill == -2) {
                    io.in(gamer.client).emit('server', "您已使用過毒藥。");
                }

                if (msg.substr(0, 6) == "/save " && witchSave == -1 && witchUse == 0) {
                    gamer.save(msg);
                } else if (msg.substr(0, 6) == "/save " && witchSave != -1 && witchUse == 1) {
                    io.in(gamer.client).emit('server', "此輪已使用技能。");
                } else if (msg.substr(0, 6) == "/save" && witchSave == -2) {
                    io.in(gamer.client).emit('server', "您已使用過解藥");
                }
            } else {
                console.log(gamer.name + ':' + msg);
                io.emit('chat message', gamer.name + "（" + gamer.num + "號）", msg);
            }
        } else {
            console.log(users[socket.id] + ':' + msg);
            io.emit('chat message', users[socket.id], msg);
            // io.emit('chat message', users[socket.id]+"（"+userNum[socket.id]+"號）", msg);
        }
    });

    function nightStart() {
        isNight = 1;
        io.emit('server', '天黑請閉眼，狼人請睜眼。');
        vote = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
});

class Gamer {
    constructor(name, id, num, client) { //玩家的class，也是村民的建構函式，給其他職業繼承用
        this.name = name;
        this.id = id;
        this.num = num;
        this.client = client;
        let msg;
    }
    kill() { }
    find() { }
    save() { }
}

class Wolf extends Gamer {
    constructor(name, id, num, client) {
        super(name, id, num, client);
    }
    kill(msg) {
        for (var i = 0; i < gamers.length; i++) {
            if (msg.substr(6, msg.length - 6) == gamers[i].num && gamers[i].id != -1) {
                killPeople = i;
                gameThread();
                break;
            } else if (msg.substr(6, msg.length - 6) == "not") {
                killPeople = -2;
                gameThread();
                break;
            } else if (msg.substr(6, msg.length - 6) == gamers[i].num && gamers[i].id == -1) {
                io.in(this.client).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
        if (killPeople == -1) {
            io.in(this.client).emit('server', "沒有此人，請重新輸入。");
        }
    }
}

class Prophet extends Gamer {
    constructor(name, id, num, client) {
        super(name, id, num, client);
    }
    find(msg) {
        var findP = -1;
        if (findPeople == 0) {
            for (var i = 0; i < gamers.length; i++) {
                if (msg.substr(6, msg.length - 6) == gamers[i].num) {
                    io.in(this.client).emit('findPeople', gamers[i].name + "（" + gamers[i].num + "號）", gamers[i].id);
                    findP = 0;
                    findPeople = -1;
                }
            }
        } else if (findPeople == -1) {
            findP = 0;
            io.in(this.client).emit('server', "此輪已使用技能。");
        }
        if (findP == -1) {
            io.in(this.client).emit('server', "沒有此人，請重新輸入。");
        }
    }
}

class Witch extends Gamer {
    constructor(name, id, num, client) {
        super(name, id, num, client);
    }

    kill(msg) {
        var killP = -1;
        for (var i = 0; i < gamers.length; i++) {
            if (msg.substr(6, msg.length - 6) == gamers[i].num && gamers[i].id != -1) {
                witchKill = i;
                killP = 0;
                witchUse = 1;
                io.in(this.client).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == gamers[i].name && gamers[i].id == -1) {
                io.in(this.client).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
        if (killP == -1) {
            io.in(this.client).emit('server', "沒有此人，請重新輸入。");
        }
    }

    save(msg) {
        var saveP = -1;
        for (var i = 0; i < gamers.length; i++) {
            if (msg.substr(6, msg.length - 6) == gamers[i].num && i == killPeople && gamers[i].id != 4) {
                killPeople = 0;
                witchSave = -1;
                saveP = 0;
                witchUse = 1;
                io.in(this.client).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == gamers[i].num && i == killPeople && gamers[i].id == 4 && firstNight == 0) {
                killPeople = 0;
                witchSave = -1;
                saveP = 0;
                witchUse = 1;
                io.in(this.client).emit('server', "您已成功執行技能。");
                break;
            } else if (msg.substr(6, msg.length - 6) == gamers[i].num && i == killPeople && gamers[i].id == 4 && firstNight != 0) {
                io.in(this.client).emit('server', "您不能自救");
                saveP = 0;
                break;
            }
        }
        if (saveP == -1) {
            io.in(this.client).emit('server', "沒有此人，或此人並沒受到攻擊，請重新輸入。");
        }
    }
}

class Hunter extends Gamer {
    constructor(name, id, num, client) {
        super(name, id, num, client);
    }
    kill(msg) {
        var killP = -1;
        for (var i = 0; i < gamers.length; i++) {
            if (msg.substr(6, msg.length - 6) == gamers[i].num && gamers[i].id != -1) {
                gamers[i].id = -1;
                killP = 0;
                hunterUse = 1;
                io.emit('server', gamers[i].name + "（" + gamers[i].num + "號）" + "被開槍帶走了。");
                this.id = -1;
                break;
            } else if (msg.substr(6, msg.length - 6) == gamers[i].num && gamers[i].id == -1) {
                io.in(this.client).emit('server', "此人已死亡，請重新輸入。");
                break;
            }
        }
        if (killP == -1) {
            io.in(this.client).emit('server', "沒有此人，請重新輸入。");
        }
    }
}

function gameThread() { //時間間隔的事件觸發
    isNight = 4;
    io.emit('server', "狼人請閉眼，女巫請睜眼，您有30秒的時間可以執行技能。");
    for (var m = 0; m < gamers.length; m++) {
        if (gamers[m].id == 4) {
            if (killPeople != -2 && witchSave != "-2") {
                io.in(gamers[m].client).emit('savePeople', gamers[killPeople].name + "（" + gamers[killPeople].num + "號）");
            } else {
                io.in(gamers[m].client).emit('savePeople', "? ? ?");
            }
        }
    }
    setTimeout(function () {
        isNight = 2;
        io.emit('server', "女巫請閉眼，預言家請睜眼，您有30秒的時間可以執行技能。");
        setTimeout(function () {
            io.emit('server', "預言家請閉眼，獵人請睜眼。");
            for (var m = 0; m < gamers.length; m++) {
                if (gamers[m].id == 3) {
                    if (gamers[m].id == witchKill) {
                        io.in(gamers[m].client).emit('huntPeople', "不能開槍");
                    } else {
                        io.in(gamers[m].client).emit('huntPeople', "可以開槍");
                    }
                }
            }
            isNight = 0;
            io.emit('server', "天亮了。");
            nightEnd();
        }, 30000);
    }, 30000);
}

function nightEnd() { //夜晚判斷
    findPeople = 0;
    witchUse = 0;
    firstNight = 1;
    if (killPeople > -1) {
        if (witchKill > -1) {
            if (gamers[killPeople].id == 3 && gamers[witchKill].id != 3) { //判斷被殺者的職業是否為3(獵人)
                hunterId = killPeople;
            }
        } else {
            if (gamers[killPeople].id == 3) {
                hunterId = killPeople;
            }
        }
    }
    if ((killPeople == -2 || killPeople == 0) && (witchKill == -1 || witchKill == -2)) { //遊戲現況說明
        io.emit('server', "昨晚是個平安夜。");
    } else if (killPeople == -2) {
        io.emit('server', gamers[witchKill].name + "（" + gamers[witchKill].num + "號）" + "昨晚被殺了。");
        gamers[witchKill].id = -1;
        witchKill = -2;
    } else if (witchKill == -1 || witchKill == -2) {
        io.emit('server', gamers[killPeople].name + "（" + gamers[killPeople].num + "號）" + "昨晚被殺了。");
        gamers[killPeople].id = -1;
        killPeople = -1;
    } else if (killPeople == witchKill) {
        io.emit('server', gamers[killPeople].name + "（" + gamers[killPeople].num + "號）" + "昨晚被殺了。");
        gamers[witchKill].id = -1;
        witchKill = -2;
        gamers[killPeople].id = -1;
        killPeople = -1;
    } else {
        io.emit('server', gamers[witchKill].name + "（" + gamers[witchKill].num + "號）" + "和" + gamers[killPeople].name + "（" + gamers[killPeople].num + "號）" + "昨晚被殺了。");
        gamers[witchKill].id = -1;
        witchKill = -2;
        gamers[killPeople].id = -1;
        killPeople = -1;
    }
    if (gameRule() != "") {
        io.emit('server', gameRule());
        gameStatus = 0;
    }
    else {
        isNight = 3;
        if (hunterId != -1) {
            gamers[hunterId].id = 3;
        }

        io.emit('server', "有30秒鐘的時間可以開技能。"); //給獵人啟動技能用
        setTimeout(function () {
            if (gameRule() != "") {
                io.emit('server', gameRule());
                gameStatus = 0;
            } else {
                if (hunterId != -1) {
                    if (isNight == 3) {
                        gamers[hunterId].id = -1;
                        isNight = 0;
                        // lastWords();
                        io.emit('server', "請辯論後，投票出你們認為的狼人。");
                    }
                } else {
                    isNight = 0;
                    io.emit('server', "請辯論後，投票出你們認為的狼人。");
                }
            }
        }, 30000);
    }
}

function gameRule() { //判斷勝負
    var tempList = [];
    for (var i = 0; i < gamers.length; i++) {
        tempList[i] = gamers[i].id;
    }
    console.log("玩家狀態" + tempList);
    var BadPeople = 0;
    var GoodPeople = 0;
    var GodPeople = 0;
    for (var j = 0; j < gamers.length; j++) {
        if (tempList[j] == 1) {
            BadPeople = 1;
        } else if (tempList[j] == 0) {
            GoodPeople = 1;
        } else if (tempList[j] == 2 || tempList[j] == 3 || tempList[j] == 4) {
            GodPeople = 1;
        }
    }
    if (GoodPeople == 0 || GodPeople == 0) {
        return "遊戲結束，狼人獲勝。";
    } else if (BadPeople == 0) {
        return "遊戲結束，好人獲勝。";
    } else {
        return "";
    }
}