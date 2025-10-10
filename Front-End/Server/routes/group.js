const express = require('express');
const router = express.Router();
const Group = require('../group');
const User = require('../user-class');

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, creatorEmail } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing group name' });
    if (!creatorEmail) return res.status(400).json({ error: 'Missing creator email' });

    const user = await User.findOne({ email: creatorEmail });
    if (!user) return res.status(404).json({ error: 'Creator not found' });

    const newGroup = new Group({
      name,
      channels: ['General'],
      users: [user._id],
      admins: [user._id],
      createdBy: user._id
    });

    await newGroup.save();
    await newGroup.populate('users', 'username email');

    res.status(201).json(newGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});


// Add channel
router.post('/:groupId/add-channel', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { channel } = req.body;

    if (!channel) return res.status(400).json({ error: 'Missing channel name' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.channels.includes(channel)) {
      group.channels.push(channel);
      await group.save();
    }

    res.json({ success: true, channels: group.channels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add channel' });
  }
});

// Add user to group
router.post('/:groupId/add-user', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!group.users.includes(user._id)) {
      group.users.push(user._id);
      await group.save();
    }

    await group.populate('users', 'username email');
    res.json({ success: true, users: group.users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// Delete channel
router.delete('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    await Group.findByIdAndDelete(groupId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await Group.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});



module.exports = router;
