const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  avatar: { type: String, default: '/assets/avatar.png' },
  roles: { type: [String], default: ['chat_user'] },
  groups: { type: [String], default: [] }
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = UserModel;
