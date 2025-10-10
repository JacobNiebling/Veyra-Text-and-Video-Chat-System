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
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  channels: { type: [String], default: ['General'] },
});

const MessageSchema = new mongoose.Schema({
  group: String,
  channel: String,
  sender: String,
  avatar: String,
  text: String,
  image: String,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Group = mongoose.model('Group', GroupSchema);
const Message = mongoose.model('Message', MessageSchema);

// ------------------ MongoDB Connection ------------------
mongoose
  .connect('mongodb://127.0.0.1:27017/chat_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ------------------ HTTP & PeerJS Server ------------------
const server = http.createServer(app);
const peerServer = ExpressPeerServer(server, { debug: true, path: '/peerjs' });
app.use('/peerjs', peerServer);

// ------------------ Socket.IO ------------------
const io = new Server(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"]
    },
    path: "/socket.io/"
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async ({ group, channel, username }) => {
    const room = `${group}_${channel}`;
    socket.join(room);

    const joinMessage = new Message({
      group,
      channel,
      sender: 'System',
      text: `${username} joined the channel.`,
      avatar: '/assets/system.png',
      timestamp: new Date(),
    });
    await joinMessage.save();

    io.to(room).emit('receiveMessage', joinMessage);

    const previousMessages = await Message.find({ group, channel }).sort({ timestamp: 1 });
    socket.emit('previousMessages', previousMessages);
  });

  socket.on('leave', async ({ group, channel, username }) => {
    const room = `${group}_${channel}`;
    socket.leave(room);

    const leaveMessage = new Message({
      group,
      channel,
      sender: 'System',
      text: `${username} left the channel.`,
      avatar: '/assets/system.png',
      timestamp: new Date(),
    });
    await leaveMessage.save();
    io.to(room).emit('receiveMessage', leaveMessage);
  });

  socket.on('sendMessage', async ({ group, channel, sender, avatar, text, image }) => {
    const msg = new Message({
      group,
      channel,
      sender,
      avatar: avatar || '/assets/avatar.png',
      text,
      image,
      timestamp: new Date(),
    });
    await msg.save();
    io.to(`${group}_${channel}`).emit('receiveMessage', msg);
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// ------------------ Multer Upload ------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname),
});
const upload = multer({ storage });
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  res.json({ success: true, path: `/uploads/${req.file.filename}` });
});

// ------------------ Helper ------------------
function getUserAvatar(user) {
  if (!user.avatar) return '/assets/avatar.png';
  return user.avatar.startsWith('http') ? user.avatar : `/uploads/${user.avatar}`;
}

// ------------------ Auth ------------------
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: 'All fields required' });

    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword, avatar });
    await newUser.save();

    res.json({
      success: true,
      user: { _id: newUser._id, username, email, avatar: getUserAvatar(newUser) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ valid: false, error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ valid: false, error: 'Invalid email or password' });

    res.json({
      valid: true,
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: getUserAvatar(user),
      roles: user.roles,
      groups: user.groups,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('_id username email avatar roles groups');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ------------------ Get user by ID ------------------
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('groups', '_id name channels');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// ------------------ Groups API ------------------

// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar');
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch groups', error: err.message });
  }
}); // Get all groups for a specific user

app.get('/api/groups/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const groups = await Group.find({ members: new mongoose.Types.ObjectId(userId) })
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar')
      .populate('createdBy', '_id username email');
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load user groups' });
  }
});
// Add a channel to a group
app.post('/api/groups/:id/add-channel', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Channel name required' });

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.channels.includes(name)) {
      group.channels.push(name);
      await group.save();
    }

    const populatedGroup = await Group.findById(id)
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar');

    res.json({ success: true, group: populatedGroup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add channel' });
  }
});

// Add user to group
app.post('/api/groups/:groupId/add-user', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Add user to group and group to user if not already added
    if (!group.members.includes(user._id)) group.members.push(user._id);
    if (!user.groups.includes(groupId)) user.groups.push(groupId);

    await group.save();
    await user.save();

    const populatedGroup = await Group.findById(groupId)
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar');

    res.json({ success: true, user, group: populatedGroup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add user to group' });
  }
});

// Remove user from group
app.post('/api/groups/:groupId/remove-user', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    group.members = group.members.filter((id) => id.toString() !== userId);
    user.groups = user.groups.filter((id) => id.toString() !== groupId);

    await group.save();
    await user.save();

    const populatedGroup = await Group.findById(groupId)
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar');

    res.json({ success: true, group: populatedGroup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove user from group' });
  }
});

// Delete a group
app.delete('/api/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Group.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Group not found' });

    // Remove group from all users
    await User.updateMany({ groups: id }, { $pull: { groups: id } });

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Create a new group
app.post('/api/groups', async (req, res) => {
  try {
    const { name, creatorEmail } = req.body;

    if (!name || !creatorEmail)
      return res.status(400).json({ error: 'Group name and creatorEmail required' });

    // Find the user creating the group
    const user = await User.findOne({ email: creatorEmail });
    if (!user) return res.status(404).json({ error: 'Creator not found' });

    // Create the group
    const group = new Group({
      name,
      createdBy: user._id,
      members: [user._id],
      admins: [user._id],
      channels: ['General'],
    });

    await group.save();

    // Add the group to the user's groups array
    user.groups.push(group._id);
    await user.save();

    // Populate members and admins for response
    const populatedGroup = await Group.findById(group._id)
      .populate('members', '_id username email avatar')
      .populate('admins', '_id username email avatar');

    res.json(populatedGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ------------------ Socket.IO ------------------
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a group/channel
  socket.on('join', async ({ group, channel, username }) => {
    const room = `${group}_${channel}`;
    socket.join(room);

    // System message: user joined
    const joinMessage = new Message({
      group,
      channel,
      sender: 'System',
      text: `${username} joined the channel.`,
      avatar: '/assets/system.png',
      timestamp: new Date(),
    });
    await joinMessage.save();

    // Emit to the room and to the joining user
    io.to(room).emit('receiveMessage', joinMessage);

    // Send previous messages to the joining user
    const previousMessages = await Message.find({ group, channel }).sort({ timestamp: 1 });
    socket.emit('previousMessages', previousMessages);
  });

  // Leave a group/channel
  socket.on('leave', async ({ group, channel, username }) => {
    const room = `${group}_${channel}`;
    socket.leave(room);

    // System message: user left
    const leaveMessage = new Message({
      group,
      channel,
      sender: 'System',
      text: `${username} left the channel.`,
      avatar: '/assets/system.png',
      timestamp: new Date(),
    });
    await leaveMessage.save();

    // Notify everyone in the room
    io.to(room).emit('receiveMessage', leaveMessage);
  });

  // Sending normal chat messages
  socket.on('sendMessage', async ({ group, channel, sender, avatar, text, image }) => {
    const msg = new Message({
      group,
      channel,
      sender,
      avatar: avatar ? `/uploads/${avatar}` : '/assets/avatar.png',
      text,
      image: image ? `/uploads/${image}` : '',
      timestamp: new Date(),
    });

    await msg.save();
    io.to(`${group}_${channel}`).emit('receiveMessage', msg);
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// ------------------ Start Server ------------------
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
