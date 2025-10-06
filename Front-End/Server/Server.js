// ------------------ Imports ------------------
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { ExpressPeerServer } = require('peer');
const multer = require('multer');

// ------------------ App & Config ------------------
const app = express();
const PORT = 3000;

// ------------------ Middleware ------------------
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------ MongoDB Models ------------------
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  roles: { type: [String], default: ['chat_user'] },
  groups: { type: [String], default: [] }
});

const MessageSchema = new mongoose.Schema({
  group: String,
  channel: String,
  sender: String,
  avatar: String,
  text: String,
  image: String,
  timestamp: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
  name: String,
  members: { type: [String], default: [] }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Group = mongoose.model('Group', GroupSchema);

// ------------------ MongoDB Connection ------------------
mongoose.connect('mongodb://127.0.0.1:27017/chat_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// ------------------ HTTP Server ------------------
const server = http.createServer(app);

// ------------------ PeerJS Server ------------------
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs'
});
app.use('/peerjs', peerServer);

// ------------------ Socket.IO ------------------
const io = new Server(server, {
  cors: { origin: "http://localhost:4200", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async ({ group, channel, username }) => {
    const room = `${group}_${channel}`;
    socket.join(room);
    console.log(`${username} joined room ${room}`);

    socket.to(room).emit('userJoined', { username });
    const previousMessages = await Message.find({ group, channel }).sort({ timestamp: 1 });
    socket.emit('previousMessages', previousMessages);
  });

  socket.on('sendMessage', async ({ group, channel, sender, avatar, text, image }) => {
    const msg = new Message({ group, channel, sender, avatar, text, image });
    await msg.save();
    io.to(`${group}_${channel}`).emit('receiveMessage', msg);
  });

  socket.on('leave', ({ group, channel, username }) => {
    socket.leave(`${group}_${channel}`);
    socket.to(`${group}_${channel}`).emit('userLeft', { username });
    console.log(`${username} left room ${group}_${channel}`);
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// ------------------ Multer Upload ------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});

const upload = multer({ storage });
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
  res.json({ success: true, path: `/uploads/${req.file.filename}` });
});

// ------------------ User Auth ------------------
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: "All fields required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword, avatar });
    await newUser.save();

    res.json({ success: true, user: { id: newUser._id, username, email, avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ valid: false, error: "Missing credentials" });

    const foundUser = await User.findOne({ email });
    if (!foundUser) return res.json({ valid: false, error: "Invalid email or password" });

    const match = await bcrypt.compare(password, foundUser.password);
    if (!match) return res.json({ valid: false, error: "Invalid email or password" });

    res.json({
      id: foundUser._id,
      username: foundUser.username,
      email: foundUser.email,
      avatar: foundUser.avatar,
      roles: foundUser.roles,
      groups: foundUser.groups,
      valid: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------ Groups API ------------------
app.get('/api/groups', async (req, res) => {
  const groups = await Group.find();
  res.json(groups);
});

app.post('/api/groups', async (req, res) => {
  const { name, members } = req.body;
  const newGroup = new Group({ name, members });
  await newGroup.save();
  res.json({ success: true, group: newGroup });
});

// ------------------ Start Server ------------------
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
