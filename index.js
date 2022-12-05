const express = require('express');
const path = require('path')
const http = require('http');
const { Server } = require("socket.io");
const nodeCron = require("node-cron");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {cors: {
  origin: ["*", "http://localhost:3000", "https://weareplanning.vercel.app/", "https://planningpoker.anhlamweb.com/"],
  credentials: true
}});

app.use('/', express.static(path.join(__dirname, 'public')))

const positions = ["BOTTOM", "TOP", "LEFT", "RIGHT"]
var roomData = {};

const job = nodeCron.schedule("0 3 * * *", function cleanRoomData() {
   console.log('Cleaning room');
   roomData = {};
});

io.on('connection', (socket) => {
    socket.on("JOIN_ROOM", ({ roomId, player }) => {
        let playerWithId = {...player, id: (new Date()).getTime(), socketId: socket.id, position: positions[0]}
        try{
          if (!!roomData[roomId]?.players) {
            for (let i=0; i < positions.length; i++) {
              if (roomData[roomId]?.players?.[roomData[roomId]?.players?.length - 1]?.position === "RIGHT"){
                break;
              }
              if (roomData[roomId]?.players?.[roomData[roomId]?.players?.length - 1]?.position === positions[i]) {
                playerWithId = { ...playerWithId, position: positions[i + 1]};
              }
            }
            roomData[roomId]?.players.push(playerWithId);
          }else {
            // roomData[roomId] = { players: [], openCard: false}; 
            // roomData[roomId]['players'] = [playerWithId];
            socket.emit("ROOM_NOT_FOUND");
            return;
          }
          console.log(roomData[roomId])
          console.log(roomData[roomId]['players'])
          socket.join(roomId);
          socket.join(socket.id);
          let players = roomData[roomId]['players'];
          let total = 0;
          let count = 0;
          if (!!players){
            players.forEach((o) => {
              if (o.point > 0) {
                console.log(Number(o.point))
                total+=Number(o.point);
                count++;
              }
            })
          }
          let av = (total / count).toFixed(1);
          io.to(roomId).emit("REFRESH_ROOM", {...roomData[roomId], average: av})
        }catch(e){
          console.log(e);
        }

        socket.on('CHOOSE_CARD_NUMBER', ({id, point})=>{
          const players = roomData?.[roomId]?.players;
          if (!!players){
            let result = players.map((o) => {
              console.log(o.id, id)
              if (o.id === id) {
                console.log(id, point)
                return {...o, point};
              }
              return o;
            })
            roomData[roomId]['players'] = [...result];
            console.log(roomData[roomId]['players'])
            console.log('Result', result)
            io.to(roomId).emit("REFRESH_ROOM", {...roomData[roomId]});
          }
        })
        socket.on('REVEAL_CARD', () => {
          roomData[roomId]['openCard'] = true;
          console.log(  roomData[roomId])
          const players = roomData?.[roomId]?.players;
          let total = 0;
          let count = 0;
          if (!!players){
            players.forEach((o) => {
              if (o.point > 0) {
                console.log(Number(o.point))
                total+=Number(o.point);
                count++;
              }
            })
          }
          let av = (total / count).toFixed(1);
          io.to(roomId).emit("REFRESH_ROOM", {...roomData[roomId], average: av});
        })
        socket.on('START_NEW_VOTING', () => {
          const players = roomData?.[roomId]?.players;
          if (!!players){
            roomData[roomId]['openCard'] = false;
            let result = players.map((o) => {
              return {...o,  point: ''};
            })
            roomData[roomId]['players'] = [...result];
            io.to(roomId).emit("REFRESH_ROOM", {...roomData[roomId]});
          }
        })
        socket.on('CHANGE_PLAYER_NAME', ({id, name}) => {
          const players = roomData?.[roomId]?.players;
          if (!!players){
            let result = players.map((o) => {
              if (o.id === id) {
                return {...o,  name};
              }
              return o;
            })
            roomData[roomId]['players'] = [...result];
            io.to(roomId).emit("CHANGE_PLAYER_NAME_SUCCESSFULLY", {...roomData[roomId]});
          }
        })
       
        socket.on('disconnect', () => {
          const players = roomData?.[roomId]?.players;
          if (!!players){
            let result = players.filter((o) => {
              return o.socketId !== socket.id;
            })
            roomData[roomId]['players'] = [...result];
            if (result.length == 0) {
                //delete roomData[roomId]
            }else {
              io.to(roomId).emit("CLIENT_DISCONNECTED", {...roomData[roomId]});
            }
          }
        });
    });

    socket.on('CREATE_ROOM', (data) => {
      roomData[data.roomId] = { players: [], openCard: false, average: 0, ...data}; 
    });
      
   
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
 });

server.listen(process.env.PORT || 5000, () => {
  job.start();
  console.log('listening on ', PORT);
});