import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3000/api';

interface Group {
  _id: string;
  name: string;
  channels: string[];
  users: { _id: string; username: string; email: string; avatar?: string }[];
  admins: string[];
}

interface Message {
  sender: string;
  text?: string;
  timestamp: Date;
  avatar?: string;
  image?: string;
  system?: boolean;
  group?: string;
  channel?: string;
}

@Component({
  selector: 'app-group-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupDashboardComponent implements OnInit {
  username = localStorage.getItem('username') || 'Admin';
  userId = localStorage.getItem('id') || '';
  avatar = localStorage.getItem('avatar') || '';

  newMessage = '';
  selectedFile: File | null = null;
  newGroupName = '';
  currentChannel: string | null = null;
  currentGroup: Group | null = null;

  groups: Group[] = [];
  messages: Record<string, Record<string, Message[]>> = {};

  statusMessage: string | null = null;
  isError: boolean = false;

  private socket!: Socket;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.username = user.username || this.username;
      this.userId = user._id || this.userId;
      this.avatar = user.avatar || this.avatar;
    }

    this.loadUserGroups();
    this.initSocket();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private setStatus(message: string, isError: boolean = false): void {
    this.statusMessage = message;
    this.isError = isError;
    if (!isError) setTimeout(() => (this.statusMessage = null), 3000);
  }

  // ------------------ Backend Calls ------------------
  loadUserGroups() {
    const email = localStorage.getItem('email');
    if (!email) return this.setStatus('Cannot detect user email', true);

    this.http
      .get<Group[]>(`${API_BASE_URL}/groups?email=${encodeURIComponent(email)}`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: groups => {
          this.groups = groups || [];
          this.groups.forEach(group => {
            const groupId = group._id;
            if (!this.messages[groupId]) this.messages[groupId] = {};
            (group.channels || []).forEach(channel => {
              if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
            });
          });
        },
        error: err => this.setStatus('Failed to load groups', true)
      });
  }

  addGroup(groupName: string) {
    const trimmedName = groupName.trim();
    if (!trimmedName) return this.setStatus('Group name cannot be empty', true);

    const creatorEmail = localStorage.getItem('email');
    if (!creatorEmail) return this.setStatus('Cannot detect creator email', true);

    const payload = { name: trimmedName, creatorEmail };
    this.http.post<Group>(`${API_BASE_URL}/groups`, payload, { headers: this.getAuthHeaders() }).subscribe({
      next: group => {
        if (!group) return;
        this.groups.push(group);
        this.selectGroup(group);
        this.newGroupName = '';
        this.setStatus(`Group "${group.name}" created successfully!`);
      },
      error: err => this.setStatus(err.error?.error || 'Failed to create group', true)
    });
  }

  addUserToGroup(email: string) {
    if (!email || !this.currentGroup) return this.setStatus('Please select a group and enter an email.', true);

    this.http
      .post(`${API_BASE_URL}/groups/${this.currentGroup._id}/add-user`, { email }, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (res: any) => {
          this.currentGroup!.users = res?.users || [];
          this.setStatus(`User ${email} added successfully!`);
        },
        error: err => this.setStatus(err.error?.error || 'Failed to add user', true)
      });
  }

  // ------------------ Socket.IO ------------------
  private initSocket() {
    if (this.socket) return;
    this.socket = io('http://localhost:3000');

    this.socket.on('previousMessages', (msgs: Message[]) => {
      if (this.currentGroup && this.currentChannel) {
        const groupId = this.currentGroup._id;
        const channel = this.currentChannel;
        if (!this.messages[groupId]) this.messages[groupId] = {};
        this.messages[groupId][channel] = msgs || [];
      }
    });

    this.socket.on('receiveMessage', (msg: Message) => {
      if (!msg || !this.currentGroup || !this.currentChannel) return;
      if (msg.group === this.currentGroup.name && msg.channel === this.currentChannel) {
        const groupId = this.currentGroup._id;
        const channel = this.currentChannel;
        if (!this.messages[groupId]) this.messages[groupId] = {};
        if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
        this.messages[groupId][channel].push(msg);
      }
    });

    this.socket.on('userJoined', ({ username }) => {
      if (!username || !this.currentGroup || !this.currentChannel) return;
      const groupId = this.currentGroup._id;
      const channel = this.currentChannel;
      if (!this.messages[groupId]) this.messages[groupId] = {};
      if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
      this.messages[groupId][channel].push({
        sender: username,
        text: `${username} joined the channel.`,
        timestamp: new Date(),
        system: true
      });
    });

    this.socket.on('userLeft', ({ username }) => {
      if (!username || !this.currentGroup || !this.currentChannel) return;
      const groupId = this.currentGroup._id;
      const channel = this.currentChannel;
      if (!this.messages[groupId]) this.messages[groupId] = {};
      if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
      this.messages[groupId][channel].push({
        sender: username,
        text: `${username} left the channel.`,
        timestamp: new Date(),
        system: true
      });
    });
  }

  private joinChannel(groupName: string, channel: string) {
    if (!groupName || !channel) return;
    this.socket.emit('join', { group: groupName, channel, username: this.username });
  }

  private leaveChannel(groupName: string, channel: string) {
    if (!groupName || !channel) return;
    this.socket.emit('leave', { group: groupName, channel, username: this.username });
  }

  selectGroup(group: Group) {
    if (this.currentGroup && this.currentChannel) {
      this.leaveChannel(this.currentGroup.name, this.currentChannel);
    }

    this.currentGroup = group;
    const channels = group?.channels || [];
    this.currentChannel = channels[0] || null;

    const groupId = group._id;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    channels.forEach(ch => {
      if (!this.messages[groupId][ch]) this.messages[groupId][ch] = [];
    });

    if (this.currentChannel) this.joinChannel(group.name, this.currentChannel);
  }

  selectChannel(channel: string) {
    if (!this.currentGroup || !channel) return;

    if (this.currentChannel) this.leaveChannel(this.currentGroup.name, this.currentChannel);

    this.currentChannel = channel;
    const groupId = this.currentGroup._id;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
    this.joinChannel(this.currentGroup.name, channel);
  }

  deleteGroup(groupId: string) {
    if (!groupId) return;

    this.http
      .delete(`${API_BASE_URL}/groups/${groupId}`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: () => {
          // Remove the group locally
          this.groups = this.groups.filter(g => g._id !== groupId);
          // Clear currentGroup if deleted
          if (this.currentGroup?._id === groupId) {
            this.currentGroup = null;
            this.currentChannel = null;
          }
          this.setStatus('Group deleted successfully!');
        },
        error: err => this.setStatus(err.error?.error || 'Failed to delete group', true)
      });
  }


  // ------------------ Sending Messages ------------------
  sendMessage() {
    if ((!this.newMessage.trim() && !this.selectedFile) || !this.currentGroup || !this.currentChannel) return;

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);

      this.http.post<{ path: string }>(`${API_BASE_URL}/upload`, formData).subscribe({
        next: res => {
          this.emitMessage(this.newMessage, res?.path);
          this.newMessage = '';
          this.selectedFile = null;
        },
        error: err => this.setStatus('Failed to upload image', true)
      });
    } else {
      this.emitMessage(this.newMessage);
      this.newMessage = '';
    }
  }

  private emitMessage(text: string, image?: string) {
    if (!this.currentGroup || !this.currentChannel) return;

    const groupId = this.currentGroup._id;
    const channel = this.currentChannel;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];

    const msg: Message = {
      sender: this.username,
      text,
      avatar: this.avatar,
      timestamp: new Date(),
      image,
      group: this.currentGroup.name,
      channel
    };

    this.messages[groupId][channel].push(msg);
    this.socket.emit('sendMessage', msg);
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files?.[0] || null;
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  isAdminOfGroup(group: Group | null): boolean {
    return !!(group?.admins?.includes(this.userId));
  }
}
