import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Check if fields are populated, if not throw 400 error
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  try {
    // Check if user already exists and if it does throw 400 error
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // New user class
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      roles: ['chat_user'],
      groups: []
    });

    // Save new user
    await newUser.save();

    res.json({ success: true, user: { id: newUser._id, username: newUser.username, email: newUser.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
