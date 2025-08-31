const bcrypt = require('bcrypt');
const User = require('../user-class.js');

module.exports = {
    route: (app) => {
        // Example users database (replace with real DB)
    let users = [
        {
            id: "1",
            username: "super",
            email: "superadmin@test.com",
            password: bcrypt.hashSync("123", 10), // <-- hashed
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


        app.post('/api/login', async (req, res) => {
            const { username, email, password } = req.body;
            let foundUser = users.find(u => u.username === username || u.email === email);

            if (!foundUser) {
                return res.status(401).json({ error: "Invalid username/email or password" });
            }

            const match = await bcrypt.compare(password, foundUser.password);

            if (!match) {
                return res.status(401).json({ error: "Invalid username/email or password" });
            }

            // Return all user details
            const userResponse = {
                id: foundUser.id,
                username: foundUser.username,
                email: foundUser.email,
                roles: foundUser.roles,
                groups: foundUser.groups,
                valid: true
            };

            res.json(userResponse);
        });
    }
};
