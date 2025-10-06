const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;


// MongoDB Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: { type: [String], default: ['chat_user'] },
  groups: { type: [String], default: [] }
});

const MessageSchema = new mongoose.Schema({
  group: String,
  channel: String,
  sender: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/chat_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/api/groups', require('./group'));

// Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ valid: false, error: "Missing credentials" });

    const foundUser = await User.findOne({ email });
    if (!foundUser) return res.json({ valid: false, error: "Invalid email or password" });

    const match = await bcrypt.compare(password, foundUser.password);
    if (!match) return res.json({ valid: false, error: "Invalid email or password" });

    res.json({
      id: foundUser._id,
      username: foundUser.username,
      email: foundUser.email,
      roles: foundUser.roles,
      groups: foundUser.groups,
      valid: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Registration Endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, error: "All fields required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.json({ success: true, user: { id: newUser._id, username: newUser.username, email: newUser.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async ({ group, channel }) => {
    socket.join(`${group}_${channel}`);
    console.log(`${socket.id} joined room ${group}_${channel}`);

    const previousMessages = await Message.find({ group, channel }).sort({ timestamp: 1 });
    socket.emit('previousMessages', previousMessages);
  });

  socket.on('sendMessage', async ({ group, channel, sender, text }) => {
    const msg = new Message({ group, channel, sender, text });
    await msg.save();
    io.to(`${group}_${channel}`).emit('receiveMessage', msg);
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
