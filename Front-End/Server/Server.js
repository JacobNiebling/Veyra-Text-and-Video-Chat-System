import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Example user database
let users = [
  {
    id: "1",
    username: "super",
    email: "superadmin@test.com",
    password: bcrypt.hashSync("123", 10), // hashed password
    roles: ["super_admin"],
    groups: ["all"]
  },
  {
    id: "2",
    username: "groupadmin",
    email: "groupadmin@test.com",
    password: bcrypt.hashSync("groupadmin", 10),
    roles: ["group_admin"],
    groups: ["group1"]
  },
  {
    id: "3",
    username: "chatuser",
    email: "chatuser@test.com",
    password: bcrypt.hashSync("chatuser", 10),
    roles: ["chat_user"],
    groups: ["group1", "group2"]
  }
];

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ valid: false, error: "Missing credentials" });
  }

  const foundUser = users.find(u => u.email === email);
  if (!foundUser) return res.json({ valid: false, error: "Invalid email or password" });

  const match = await bcrypt.compare(password, foundUser.password);
  if (!match) return res.json({ valid: false, error: "Invalid email or password" });

  // Send user object
  res.json({
    id: foundUser.id,
    username: foundUser.username,
    email: foundUser.email,
    roles: foundUser.roles,
    groups: foundUser.groups,
    valid: true
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
