import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const PORT = 3000;

// HTTP server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // allow all origins for dev
});

app.use(cors());
app.use(bodyParser.json());

// Example user database
let users = [
  { id: "1", username: "super", email: "superadmin@test.com", password: bcrypt.hashSync("123", 10), roles: ["super_admin"], groups: ["all"] },
  { id: "2", username: "groupadmin", email: "groupadmin@test.com", password: bcrypt.hashSync("groupadmin", 10), roles: ["group_admin"], groups: ["group1"] },
  { id: "3", username: "chatuser", email: "chatuser@test.com", password: bcrypt.hashSync("chatuser", 10), roles: ["chat_user"], groups: ["group1", "group2"] }
];

// Store messages by group + channel
let messages = {}; // { group: { channel: [ { sender, text, timestamp } ] } }

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ valid: false, error: "Missing credentials" });

  const foundUser = users.find(u => u.email === email);
  if (!foundUser) return res.json({ valid: false, error: "Invalid email or password" });

  const match = await bcrypt.compare(password, foundUser.password);
  if (!match) return res.json({ valid: false, error: "Invalid email or password" });

  res.json({
    id: foundUser.id,
    username: foundUser.username,
    email: foundUser.email,
    roles: foundUser.roles,
    groups: foundUser.groups,
    valid: true
  });
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a group & channel room
  socket.on('join', ({ group, channel }) => {
    socket.join(`${group}_${channel}`);
    console.log(`${socket.id} joined room ${group}_${channel}`);

    // Send previous messages to the user
    if (messages[group]?.[channel]) {
      socket.emit('previousMessages', messages[group][channel]);
    }
  });

  // Handle new messages
  socket.on('sendMessage', ({ group, channel, sender, text }) => {
    const msg = { sender, text, timestamp: new Date() };

    // Store message
    if (!messages[group]) messages[group] = {};
    if (!messages[group][channel]) messages[group][channel] = [];
    messages[group][channel].push(msg);

    // Broadcast to all users in the room
    io.to(`${group}_${channel}`).emit('receiveMessage', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
