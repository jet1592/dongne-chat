const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e4 });

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (req, res) => res.send("ok"));

const BAD = /시발|씨발|병신/g; // 필요하면 단어를 더 추가하세요

function cleanRegion(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!s || !/^[가-힣a-zA-Z0-9() ]+$/.test(s)) return null;
  return s.replace(/ /g, "");
}

function sendCount(room, minus = 0) {
  const size = (io.sockets.adapter.rooms.get(room)?.size || 0) - minus;
  io.to(room).emit("count", Math.max(size, 0));
}

io.on("connection", (socket) => {
  const nick = "익명" + Math.floor(1000 + Math.random() * 9000);
  let room = null;
  let last = 0;

  socket.on("join", (raw, ack) => {
    const name = cleanRegion(raw);
    if (!name) return ack && ack({ ok: false });
    if (room) {
      const old = room;
      socket.leave(old);
      room = null;
      sendCount(old);
    }
    room = "r:" + name;
    socket.join(room);
    sendCount(room);
    if (ack) ack({ ok: true, nick, id: socket.id });
  });

  socket.on("msg", (t) => {
    if (!room || typeof t !== "string") return;
    const now = Date.now();
    if (now - last < 800) return; // 도배 방지
    last = now;
    t = t.trim().slice(0, 200).replace(BAD, "**");
    if (!t) return;
    io.to(room).emit("msg", { n: nick, t, s: socket.id });
  });

  socket.on("disconnecting", () => {
    if (room) sendCount(room, 1);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("listening on " + PORT));
