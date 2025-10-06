import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Group {
  _id: string;
  name: string;
  channels: string[];
  users: { _id: string; username: string; email: string }[];
  admins: string[];
}

@Component({
  selector: 'app-group-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupDashboardComponent {
  username = localStorage.getItem('username') || 'Admin';
  userId = localStorage.getItem('id') || '';
  newMessage = '';
  currentChannel: string | null = null;
  currentGroup: Group | null = null;

  groups: Group[] = [];
  messages: Record<string, Record<string, { sender: string; text: string; timestamp: Date }[]>> = {};

  constructor(private router: Router, private http: HttpClient) {
    this.loadGroups();
  }

  // ------------------ Backend Calls ------------------

  loadGroups() {
    this.http.get<Group[]>('/api/groups').subscribe({
      next: groups => {
        this.groups = groups;
        // Initialize messages storage
        groups.forEach(group => {
          if (!this.messages[group._id]) this.messages[group._id] = {};
          group.channels.forEach(ch => {
            if (!this.messages[group._id][ch]) this.messages[group._id][ch] = [];
          });
        });
      },
      error: err => console.error('Failed to load groups', err)
    });
  }

  addGroup(groupName: string) {
    const trimmedName = groupName.trim();
    if (!trimmedName) return alert('Group name cannot be empty');

    this.http.post<Group>('http://localhost:3000/api/groups', {
      name: trimmedName,
      admins: [this.userId]   // send as array
    }).subscribe({
      next: group => {
        this.groups.push(group);
        this.currentGroup = group;
        this.currentChannel = group.channels[0] || null;
      },
      error: err => {
        console.error('Failed to create group', err);
        alert(err.error?.error || 'Failed to create group');
      }
    });
  }



  addUserToGroup(email: string) {
    if (!email || !this.currentGroup) return;

    this.http.post(`/api/groups/${this.currentGroup._id}/add-user`, { email }).subscribe({
      next: (res: any) => {
        this.currentGroup!.users = res.users;
        alert(`User ${email} added successfully!`);
      },
      error: err => alert(err.error?.error || 'Failed to add user')
    });
  }

  deleteGroup(group: Group) {
    this.http.delete(`/api/groups/${group._id}`).subscribe({
      next: () => {
        this.groups = this.groups.filter(g => g._id !== group._id);
        if (this.currentGroup?._id === group._id) this.currentGroup = null;
      },
      error: err => console.error(err)
    });
  }

  addChannel(group: Group, channelName: string) {
    const ch = channelName.trim();
    if (!ch || group.channels.includes(ch)) return;

    this.http.post(`/api/groups/${group._id}/add-channel`, { channel: ch }).subscribe({
      next: () => {
        group.channels.push(ch);
        if (!this.messages[group._id][ch]) this.messages[group._id][ch] = [];
      },
      error: err => console.error(err)
    });
  }

  deleteChannel(group: Group, channel: string) {
    this.http.post(`/api/groups/${group._id}/delete-channel`, { channel }).subscribe({
      next: () => {
        group.channels = group.channels.filter(ch => ch !== channel);
        if (this.currentChannel === channel) this.currentChannel = group.channels[0] || null;
        delete this.messages[group._id][channel];
      },
      error: err => console.error(err)
    });
  }

  selectGroup(group: Group) {
    this.currentGroup = group;
    this.currentChannel = group.channels[0] || null;

    if (!this.messages[group._id]) this.messages[group._id] = {};
    group.channels.forEach(ch => {
      if (!this.messages[group._id][ch]) this.messages[group._id][ch] = [];
    });
  }

  selectChannel(channel: string) {
    if (!this.currentGroup) return;
    this.currentChannel = channel;
    if (!this.messages[this.currentGroup._id][channel]) {
      this.messages[this.currentGroup._id][channel] = [];
    }
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentGroup || !this.currentChannel) return;

    this.messages[this.currentGroup._id][this.currentChannel].push({
      sender: this.username,
      text: this.newMessage.trim(),
      timestamp: new Date()
    });

    this.newMessage = '';
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  isAdminOfGroup(group: Group | null): boolean {
    return group ? group.admins.includes(this.userId) : false;
  }
}
