const express = require('express');
const router = express.Router();
const Group = require('../group');
const User = require('../user-class');

// Create new group
router.post('/', async (req, res) => {
  const { name, adminId } = req.body;

  if (!name || !adminId) {
    return res.status(400).json({ error: 'Missing name or adminId' });
  }

  try {
    // Ensure the admin user exists
    const admin = await User.findById(adminId);
    if (!admin) return res.status(404).json({ error: 'Admin user not found' });

    // Create the group
    const group = new Group({
      name: name,
      admins: [adminId],   // automatically set the creator as admin
      users: [adminId],    // add the creator as a member
      channels: []         // empty channels by default
    });

    await group.save();
    await group.populate('users', 'username email'); // optional, for frontend display

    res.status(201).json(group);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find().populate('users', 'username email');
    res.json(groups);
  } catch (err) {
    console.error('Fetch groups error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add user to group
router.post('/:groupId/add-user', async (req, res) => {
  const { groupId } = req.params;
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.users.includes(user._id)) {
      group.users.push(user._id);
      await group.save();
    }

    await group.populate('users', 'username email');
    res.json(group);
  } catch (err) {
    console.error('Add user to group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group channels
router.put('/:groupId/update-channels', async (req, res) => {
  const { groupId } = req.params;
  const { channels } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    group.channels = channels;
    await group.save();

    res.json(group);
  } catch (err) {
    console.error('Update channels error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group
router.delete('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    await Group.findByIdAndDelete(groupId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
