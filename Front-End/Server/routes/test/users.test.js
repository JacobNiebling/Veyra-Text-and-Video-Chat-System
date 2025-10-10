const express = require('express');
const router = express.Router();

const UserModel = require('../user-class');

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await UserModel.find(); // fetch all users
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
});

module.exports = router;
