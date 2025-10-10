import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  roles: [String],
  groups: [String],
});

const User = mongoose.model('User', userSchema);

mongoose.connect('mongodb://127.0.0.1:27017/chat_app')
  .then(async () => {
    await User.deleteMany({});
    await User.insertMany([
      { username: 'super', email: 'superadmin@test.com', password: bcrypt.hashSync('123', 10), roles: ['super_admin'], groups: [''] },
      { username: 'groupadmin', email: 'groupadmin@test.com', password: bcrypt.hashSync('groupadmin', 10), roles: ['group_admin'], groups: [''] },
      { username: 'chatuser', email: 'chatuser@test.com', password: bcrypt.hashSync('chatuser', 10), roles: ['chat_user'], groups: [''] }
    ]);
    console.log('Users seeded');
    mongoose.connection.close();
  })
  .catch(err => console.error(err));
