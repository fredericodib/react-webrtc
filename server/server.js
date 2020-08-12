const express = require("express");
const http = require("http");
const cors = require("cors");
const app = express();

app.use(cors());
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

app.get("/", function (req, res, next) {
  res.json({ msg: "OK!" });
});

io.origins("*:*");
io.on("connection", function (socket) {
  socket.on("join", (roomID) => {
    socket.join(roomID);
    const room = io.sockets.adapter.rooms[roomID];

    io.to(roomID).emit(
      "user-joined",
      socket.id,
      room.length,
      Object.keys(room.sockets)
    );
  });

  socket.on("signal", (toId, message) => {
    io.to(toId).emit("signal", socket.id, message);
  });

  socket.on("disconnect", function () {
    io.sockets.emit("user-left", socket.id);
  });
});

server.listen(8081, () => console.log("server is running on port 8000"));
