const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  roles: { type: [String], default: ['chat_user'] },
  groups: { type: [String], default: [] }
});

// Use existing model if already compiled
const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
