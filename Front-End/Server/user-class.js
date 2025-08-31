class User {
  constructor(id, username, email, roles = [], groups = []) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.roles = roles;
    this.groups = groups;
    this.valid = false;
  }
}

module.exports = User;
