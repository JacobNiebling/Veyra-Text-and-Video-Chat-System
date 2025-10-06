const express = require('express');
const router = express.Router();
const Group = require('./group');

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, admins } = req.body;
    if (!name || !admins) return res.status(400).json({ error: 'Missing name or admins' });

    const newGroup = new Group({ name, channels: [], users: [], admins });
    await newGroup.save();
    res.json(newGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

module.exports = router;
