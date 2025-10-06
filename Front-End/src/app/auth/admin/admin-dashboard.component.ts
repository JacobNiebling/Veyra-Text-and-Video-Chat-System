import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, User, Group } from './admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  pages = ['Users', 'Groups', 'Settings'];
  currentPage = 'Users';

  users: User[] = [];
  groups: Group[] = [];

  selectedUser: User | null = null;
  selectedGroup: Group | null = null;

  // newUser now correctly uses roles array and groups
  newUser: { username: string; email: string; password: string; roles: string[]; groups: string[] } = {
    username: '',
    email: '',
    password: '',
    roles: ['chat_user'], // default role
    groups: []
  };

  newGroup = { name: '', adminId: '' };

  errorMessage = '';
  successMessage = '';
  selectedRole: { [key: string]: string } = {};

  constructor(private router: Router, private adminService: AdminService) {}

  ngOnInit() {
    this.loadUsers();
    this.loadGroups();
  }

  // ------------------ LOAD DATA ------------------
  loadUsers() {
    this.adminService.getUsers().subscribe({
      next: (data) => this.users = data,
      error: () => this.showError('Failed to load users')
    });
  }

  loadGroups() {
    this.adminService.getGroups().subscribe({
      next: (data) => this.groups = data,
      error: () => this.showError('Failed to load groups')
    });
  }

  // ------------------ USERS ------------------
  addUser() {
    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      return this.showError('Please fill all fields');
    }

    // Build a proper User object
    const userToAdd: User & { password: string } = {
      username: this.newUser.username,
      email: this.newUser.email,
      password: this.newUser.password,
      roles: this.newUser.roles,
      groups: this.newUser.groups
    };

    this.adminService.addUser(userToAdd).subscribe({
      next: (user: User) => {
        this.users.push(user);
        this.showSuccess(`${user.username} added`);
        // Reset form
        this.newUser = { username: '', email: '', password: '', roles: ['chat_user'], groups: [] };
      },
      error: () => this.showError('Failed to add user')
    });
  }

  removeUser(user: User) {
    if (!user._id) return;
    this.adminService.removeUser(user._id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u._id !== user._id);
        this.groups.forEach(g => g.members = g.members.filter(m => m._id !== user._id));
        this.showSuccess(`${user.username} removed`);
      },
      error: () => this.showError('Failed to remove user')
    });
  }

  promoteUser(user: User, role: string) {
    if (!user._id) return;
    const roles = [...user.roles];
    if (!roles.includes(role)) roles.push(role);

    this.adminService.updateUserRoles(user._id, roles).subscribe({
      next: (u: User) => {
        user.roles = u.roles;
        this.showSuccess(`${user.username} promoted to ${role}`);
      },
      error: () => this.showError('Failed to promote user')
    });
  }

  downgradeUserRole(user: User, role: string) {
    if (!user._id) return;
    const roles = user.roles.filter(r => r !== role);
    this.adminService.updateUserRoles(user._id, roles).subscribe({
      next: (u: User) => {
        user.roles = u.roles;
        this.showSuccess(`${role} removed from ${user.username}`);
        this.selectedRole[user._id!] = '';
      },
      error: () => this.showError('Failed to remove role')
    });
  }

  // ------------------ GROUPS ------------------
  addGroup() {
    if (!this.newGroup.name) return this.showError('Please enter group name');

    this.adminService.addGroup({ name: this.newGroup.name, adminId: this.newGroup.adminId }).subscribe({
      next: (group: Group) => {
        this.groups.push(group);
        this.showSuccess(`Group "${group.name}" added`);
        this.newGroup = { name: '', adminId: '' };
      },
      error: () => this.showError('Failed to add group')
    });
  }

  addUserToGroup(group: Group, userId: string) {
    if (!group._id) return;
    this.adminService.addUserToGroup(group._id, userId).subscribe({
      next: (updatedGroup: Group) => {
        const index = this.groups.findIndex(g => g._id === updatedGroup._id);
        if (index > -1) this.groups[index] = updatedGroup;
        this.showSuccess(`User added to ${updatedGroup.name}`);
      },
      error: () => this.showError('Failed to add user to group')
    });
  }

  // ------------------ UTILITIES ------------------
  selectPage(page: string) { this.currentPage = page; this.selectedUser = null; this.selectedGroup = null; }
  selectUser(user: User) { this.selectedUser = user; }
  selectGroup(group: Group) { this.selectedGroup = group; }

  getUsernames(users: User[] | undefined): string {
    return users?.map(u => u.username).join(', ') || 'None';
  }

  showSuccess(msg: string) { this.successMessage = msg; setTimeout(() => this.successMessage = '', 3000); }
  showError(msg: string) { this.errorMessage = msg; setTimeout(() => this.errorMessage = '', 3000); }

  signOut() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
