import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, User, Group } from './admin.service';

interface Settings {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  defaultUserRole: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  pages = ['Users', 'Groups', 'Settings'];
  currentPage = 'Users';

  users: User[] = [];
  groups: Group[] = [];

  selectedUser: User | null = null;
  selectedGroup: Group | null = null;

  settings: Settings = {
    theme: 'light',
    emailNotifications: true,
    defaultUserRole: 'chat_user',
  };

  newUser = { username: '', email: '', password: '', roles: ['chat_user'], groups: [] };
  newGroup = { name: '', adminId: '' };

  errorMessage = '';
  successMessage = '';
  selectedRole: { [key: string]: string } = {};

  constructor(private router: Router, private adminService: AdminService) {}

  ngOnInit() {
    this.loadUsers();
    this.loadGroups();
    this.loadSettings();
  }

  // ------------------ LOAD DATA ------------------
  loadUsers() {
    this.adminService.getUsers().subscribe({
      next: (data: User[]) => {
        console.log('Loaded users:', data);
        this.users = data;
      },
      error: () => this.showError('Failed to load users'),
    });
  }

  loadGroups() {
    this.adminService.getGroups().subscribe({
      next: (data: Group[]) => {
        // Force users array
        this.groups = data.map((g) => ({ ...g, users: g.users || [] }));
        console.log('Loaded groups:', this.groups);
      },
      error: () => this.showError('Failed to load groups'),
    });
  }

  loadSettings() {
    console.log('Settings loaded (mock)');
  }

  // ------------------ USER METHODS ------------------
  addUser() {
    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      return this.showError('Please fill all fields');
    }

    const userToAdd: User & { password: string } = {
      username: this.newUser.username,
      email: this.newUser.email,
      password: this.newUser.password,
      roles: this.newUser.roles,
      groups: this.newUser.groups,
    };

    this.adminService.addUser(userToAdd).subscribe({
      next: (user: User) => {
        this.users.push(user);
        this.showSuccess(`${user.username} added`);
        this.newUser = { username: '', email: '', password: '', roles: ['chat_user'], groups: [] };
      },
      error: () => this.showError('Failed to add user'),
    });
  }

  removeUser(user: User) {
    if (!user._id) return;
    this.adminService.removeUser(user._id).subscribe({
      next: () => {
        this.users = this.users.filter((u) => u._id !== user._id);
        this.groups.forEach((g: Group) => {
          g.users = (g.users || []).filter((m: User) => m._id !== user._id);
        });
        this.showSuccess(`${user.username} removed`);
      },
      error: () => this.showError('Failed to remove user'),
    });
  }

  promoteUser(user: User, role: string) {
    if (!user._id) return;
    const roles = [...user.roles];
    if (!roles.includes(role)) roles.push(role);

    this.adminService.updateUserRoles(user._id, roles).subscribe({
      next: (u: User) => {
        const index = this.users.findIndex((us) => us._id === u._id);
        if (index > -1) this.users[index] = u;
        this.showSuccess(`${u.username} promoted to ${role}`);
      },
      error: () => this.showError('Failed to promote user'),
    });
  }

  downgradeUserRole(user: User, role: string) {
    if (!user._id) return;
    const roles = user.roles.filter((r) => r !== role);
    this.adminService.updateUserRoles(user._id, roles).subscribe({
      next: (u: User) => {
        const index = this.users.findIndex((us) => us._id === u._id);
        if (index > -1) this.users[index] = u;
        this.showSuccess(`${role} removed from ${u.username}`);
        this.selectedRole[user._id!] = '';
      },
      error: () => this.showError('Failed to remove role'),
    });
  }

  // ------------------ GROUP METHODS ------------------
  addGroup() {
    if (!this.newGroup.name) return this.showError('Please enter group name');

    this.adminService
      .addGroup({ name: this.newGroup.name, adminId: this.newGroup.adminId })
      .subscribe({
        next: (group: Group) => {
          this.groups.push(group);
          this.showSuccess(`Group "${group.name}" added`);
          this.newGroup = { name: '', adminId: '' };
        },
        error: () => this.showError('Failed to add group'),
      });
  }

  addUserToGroup(group: Group | null, userId: string | undefined) {
    if (!group?._id || !userId) return; // exit if undefined

    this.adminService.addUserToGroup(group._id, userId).subscribe({
      next: (updatedGroup: Group) => {
        const index = this.groups.findIndex((g) => g._id === updatedGroup._id);
        if (index > -1) this.groups[index] = { ...updatedGroup, users: updatedGroup.users || [] };
        this.showSuccess(`User added to ${updatedGroup.name}`);
      },
      error: () => this.showError('Failed to add user to group'),
    });
  }

  deleteGroup(group: Group) {
    if (!group._id) return;
    if (!confirm(`Are you sure you want to delete group "${group.name}"?`)) return;

    this.adminService.deleteGroup(group._id).subscribe({
      next: () => {
        this.groups = this.groups.filter((g) => g._id !== group._id);
        this.showSuccess(`Group "${group.name}" deleted successfully`);
      },
      error: () => this.showError('Failed to delete group'),
    });
  }

  // ------------------ SETTINGS ------------------
  toggleTheme() {
    this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
    this.showSuccess(`Theme switched to ${this.settings.theme}`);
  }

  toggleEmailNotifications() {
    this.settings.emailNotifications = !this.settings.emailNotifications;
    const status = this.settings.emailNotifications ? 'enabled' : 'disabled';
    this.showSuccess(`Email notifications ${status}`);
  }

  changeDefaultRole(role: string) {
    this.settings.defaultUserRole = role;
    this.showSuccess(`Default role set to ${role}`);
  }

  // ------------------ UTILITIES ------------------
  selectPage(page: string) {
    this.currentPage = page;
    this.selectedUser = null;
    this.selectedGroup = null;
  }
  selectUser(user: User) {
    this.selectedUser = user;
  }
  selectGroup(group: Group) {
    this.selectedGroup = group;
  }

  getUsernames(users: (User | string)[] | undefined): string {
    if (!users || users.length === 0) return 'No members';

    return users.map((u) => (typeof u === 'string' ? u : u.username)).join(', ');
  }

  getUserGroups(user: User): string {
    if (!user || !this.groups) return 'None';
    const userGroups = this.groups.filter((g: Group) =>
      g.users?.some((u: User) => u._id === user._id)
    );
    return userGroups.length ? userGroups.map((g: Group) => g.name).join(', ') : 'None';
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => (this.successMessage = ''), 3000);
  }
  showError(msg: string) {
    this.errorMessage = msg;
    this.successMessage = '';
    setTimeout(() => (this.errorMessage = ''), 3000);
  }

  signOut() {
    localStorage.removeItem('id');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('roles');
    this.router.navigate(['/login']);
  }

  // ------------------ TRACK BY ------------------
  trackByUserId(index: number, user: User) {
    return user._id;
  }
  trackByGroupId(index: number, group: Group) {
    return group._id;
  }
}
