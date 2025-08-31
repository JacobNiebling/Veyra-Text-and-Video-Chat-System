import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  groups: string[];
}

interface Group {
  id: string;
  name: string;
  members: User[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminDashboardComponent {
  pages = ['Users', 'Groups', 'Settings'];
  currentPage = 'Users';

  users: User[] = [
    { id: '1', username: 'super', email: 'superadmin@test.com', roles: ['super_admin'], groups: ['all'] },
    { id: '2', username: 'groupadmin', email: 'groupadmin@test.com', roles: ['group_admin'], groups: ['group1'] },
    { id: '3', username: 'chatuser', email: 'chatuser@test.com', roles: ['chat_user'], groups: ['group1','group2'] }
  ];

  groups: Group[] = [
    { id: '1', name: 'Group 1', members: [this.users[1], this.users[2]] },
    { id: '2', name: 'Group 2', members: [this.users[2]] }
  ];

  selectedUser: User | null = null;
  selectedGroup: Group | null = null;

  newUser = { username: '', email: '', password: '', role: 'chat_user' };
  newGroup = { name: '' };
  errorMessage = '';
  successMessage = '';

  selectedRole: { [key: string]: string } = {}; // For role dropdowns

  // SETTINGS VARIABLES
  settings = {
    theme: 'light', // 'light' or 'dark'
    emailNotifications: true,
    defaultUserRole: 'chat_user'
  };

  // PAGE SELECTION
  selectPage(page: string) {
    this.currentPage = page;
    this.selectedUser = null;
    this.selectedGroup = null;
  }

  // USER SELECTION
  selectUser(user: User) {
    this.selectedUser = user;
  }

  // GROUP SELECTION
  selectGroup(group: Group) {
    this.selectedGroup = group;
  }

  // ADD/REMOVE USERS
  addUser() {
    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      this.showError('Please fill all fields');
      return;
    }
    const id = (this.users.length + 1).toString();
    this.users.push({
      id,
      username: this.newUser.username,
      email: this.newUser.email,
      roles: [this.newUser.role],
      groups: []
    });
    this.showSuccess(`${this.newUser.username} added`);
    this.newUser = { username: '', email: '', password: '', role: 'chat_user' };
  }

  removeUser(user: User) {
    this.users = this.users.filter(u => u !== user);
    if(this.selectedUser === user) this.selectedUser = null;
    this.groups.forEach(g => g.members = g.members.filter(m => m !== user));
    this.showSuccess(`${user.username} removed`);
  }

  // PROMOTE/REMOVE ROLE
  promoteUser(user: User, role: string) {
    if (!user.roles.includes(role)) {
      user.roles.push(role);
      this.showSuccess(`${user.username} promoted to ${role.replace('_',' ')}`);
    }
  }

  downgradeUserRole(user: User, role: string) {
    user.roles = user.roles.filter(r => r !== role);
    this.showSuccess(`${role.replace('_',' ')} removed from ${user.username}`);
    this.selectedRole[user.id] = '';
  }

  // ADD GROUP
  addGroup() {
    if(!this.newGroup.name) {
      this.showError('Please enter group name');
      return;
    }
    const id = (this.groups.length + 1).toString();
    this.groups.push({ id, name: this.newGroup.name, members: [] });
    this.showSuccess(`Group "${this.newGroup.name}" added`);
    this.newGroup.name = '';
  }

  // SETTINGS METHODS
  toggleTheme() {
    this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
    this.showSuccess(`Theme changed to ${this.settings.theme}`);
  }

  toggleEmailNotifications() {
    this.settings.emailNotifications = !this.settings.emailNotifications;
    this.showSuccess(`Email notifications ${this.settings.emailNotifications ? 'enabled' : 'disabled'}`);
  }

  changeDefaultRole(role: string) {
    this.settings.defaultUserRole = role;
    this.showSuccess(`Default new user role set to ${role.replace('_',' ')}`);
  }

  // UTILITIES
  getUsernames(users: User[] | undefined): string {
    if(!users || users.length === 0) return 'None';
    return users.map(u => u.username).join(', ');
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    setTimeout(() => this.successMessage='', 3000);
  }

  showError(msg: string) {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage='', 3000);
  }

  constructor(private router: Router) {}
  signOut() {
    // Optional: clear session/local storage
    localStorage.clear();

    // Redirect to login page
    this.router.navigate(['/login']);
  }

}
