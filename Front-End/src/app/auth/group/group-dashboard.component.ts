import { Component, OnInit, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
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
export class GroupDashboardComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  username = localStorage.getItem('username') || 'Admin';
  userId = localStorage.getItem('id') || '';
  avatar = localStorage.getItem('avatar') || '';

  groups: Group[] = [];
  currentGroup: Group | null = null;
  currentChannel: string | null = null;

  newMessage = '';
  selectedFile: File | null = null;
  newGroupName = '';
  messages: Record<string, Record<string, Message[]>> = {};

  statusMessage: string | null = null;
  isError = false;

  private socket!: Socket;

  showMembersPanel = false;
  newUserEmail = '';

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

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Scroll to bottom failed', err);
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private setStatus(message: string, isError = false) {
    this.statusMessage = message;
    this.isError = isError;
    if (!isError) setTimeout(() => (this.statusMessage = null), 3000);
  }

  private mapGroup(group: any): Group {
    return {
      ...group,
      users:
        group.members?.map((m: any) => ({
          _id: m._id,
          username: m.username,
          email: m.email,
          avatar: m.avatar || ''
        })) || [],
      admins: group.admins || [],
      channels: group.channels || ['General']
    };
  }

  loadUserGroups() {
    const email = localStorage.getItem('email');
    if (!email) return this.setStatus('Cannot detect user email', true);

    this.http
      .get<Group[]>(`${API_BASE_URL}/groups?email=${encodeURIComponent(email)}`, {
        headers: this.getAuthHeaders()
      })
      .subscribe({
        next: (groups) => {
          const previousGroupId = this.currentGroup?._id;
          const previousChannel = this.currentChannel;

          this.groups = groups.map((g) => this.mapGroup(g));

          // Initialize messages
          this.groups.forEach((group) => {
            if (!this.messages[group._id]) this.messages[group._id] = {};
            group.channels.forEach((ch) => {
              if (!this.messages[group._id][ch]) this.messages[group._id][ch] = [];
            });
          });

          // Preserve previous selection if possible
          if (previousGroupId) {
            const matchedGroup = this.groups.find((g) => g._id === previousGroupId);
            if (matchedGroup) {
              this.selectGroup(matchedGroup);
              if (previousChannel && matchedGroup.channels.includes(previousChannel)) {
                this.selectChannel(previousChannel);
              }
              return;
            }
          }

          if (this.groups.length > 0) this.selectGroup(this.groups[0]);
        },
        error: () => this.setStatus('Failed to load groups', true)
      });
  }

  refreshUserGroups() {
    this.loadUserGroups();
    this.setStatus('Groups refreshed');
  }

  startCall(groupId: string) {
    this.router.navigate(['/video_chat', groupId]);
  }

  sendMessage() {
    if (!this.currentGroup || !this.currentChannel) return;

    const sendMsg = (imageUrl?: string) => {
      if (!this.newMessage.trim() && !imageUrl) return;

      const msg: Message = {
        sender: this.username,
        text: this.newMessage.trim() || undefined,
        timestamp: new Date(),
        group: this.currentGroup!.name,
        channel: this.currentChannel!,
        avatar: this.avatar,
        image: imageUrl
      };

      this.socket.emit('sendMessage', msg);
      this.newMessage = '';
      this.selectedFile = null;
    };

    if (this.selectedFile) {
      const reader = new FileReader();
      reader.onload = () => sendMsg(reader.result as string);
      reader.readAsDataURL(this.selectedFile);
    } else {
      sendMsg();
    }
  }

  isNewMessageBlock(currentMsg: Message, previousMsg?: Message): boolean {
    if (!previousMsg) return true;
    if (currentMsg.sender !== previousMsg.sender) return true;

    const currentTime = new Date(currentMsg.timestamp).getTime();
    const previousTime = new Date(previousMsg.timestamp).getTime();
    const diffMinutes = (currentTime - previousTime) / 1000 / 60;

    return diffMinutes > 1;
  }

  addGroup(groupName: string) {
    const trimmedName = groupName.trim();
    if (!trimmedName) return this.setStatus('Group name cannot be empty', true);

    const creatorEmail = localStorage.getItem('email');
    if (!creatorEmail) return this.setStatus('Cannot detect creator email', true);

    const payload = { name: trimmedName, creatorEmail };
    this.http
      .post<Group>(`${API_BASE_URL}/groups`, payload, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (group) => {
          if (!group) return;
          const mapped = this.mapGroup(group);

          if (!mapped.users.find((u) => u._id === this.userId)) {
            mapped.users.push({ _id: this.userId, username: this.username, email: creatorEmail });
          }
          if (!mapped.admins.includes(this.userId)) mapped.admins.push(this.userId);

          this.groups.push(mapped);
          this.selectGroup(mapped);
          this.newGroupName = '';
          this.setStatus(`Group "${mapped.name}" created successfully!`);
        },
        error: (err) => this.setStatus(err.error?.error || 'Failed to create group', true)
      });
  }

  addChannel(channelName: string) {
    const name = channelName.trim();
    if (!name || !this.currentGroup?._id)
      return this.setStatus('Select a group and provide a channel name', true);

    this.http
      .post<{ group: Group }>(
        `${API_BASE_URL}/groups/${this.currentGroup._id}/add-channel`,
        { name },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (res) => {
          const updatedGroup = this.mapGroup(res.group);
          const idx = this.groups.findIndex((g) => g._id === updatedGroup._id);
          if (idx !== -1) this.groups[idx] = updatedGroup;

          this.currentGroup = updatedGroup;
          this.currentChannel = name;
          if (!this.messages[updatedGroup._id]) this.messages[updatedGroup._id] = {};
          if (!this.messages[updatedGroup._id][name]) this.messages[updatedGroup._id][name] = [];
          this.joinChannel(updatedGroup.name, name);
          this.setStatus(`Channel "${name}" added!`);
        },
        error: (err) => this.setStatus(err.error?.error || 'Failed to add channel', true)
      });
  }

  selectGroup(group: any) {
    this.currentGroup = this.mapGroup(group);
    this.currentChannel = this.currentGroup.channels[0] || null;

    const groupId = this.currentGroup._id;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    this.currentGroup.channels.forEach((ch) => {
      if (!this.messages[groupId][ch]) this.messages[groupId][ch] = [];
    });

    if (this.currentGroup && this.currentChannel) {
      this.joinChannel(this.currentGroup.name, this.currentChannel);
    }
  }

  selectChannel(channel: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!this.currentGroup || !channel) return;
    if (this.currentChannel) this.leaveChannel(this.currentGroup.name, this.currentChannel);
    this.currentChannel = channel;

    const groupId = this.currentGroup._id;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];
    this.joinChannel(this.currentGroup.name, channel);
  }

  private initSocket() {
    if (this.socket) return;

    this.socket = io('http://localhost:3000');

    this.socket.once('previousMessages', (msgs: Message[]) => {
      if (!this.currentGroup || !this.currentChannel) return;
      const groupId = this.currentGroup._id;
      if (!this.messages[groupId]) this.messages[groupId] = {};
      this.messages[groupId][this.currentChannel] = (msgs || []).slice(-50);
      this.scrollToBottom();
    });

    this.socket.off('receiveMessage');
    this.socket.on('receiveMessage', (msg: Message) => {
      if (!msg || !this.currentGroup || !this.currentChannel) return;

      const groupId = this.currentGroup._id;
      const channel = this.currentChannel;

      if (!this.messages[groupId]) this.messages[groupId] = {};
      if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];

      if (msg.group === this.currentGroup.name && msg.channel === channel) {
        this.messages[groupId][channel].push(msg);
        if (this.messages[groupId][channel].length > 50) {
          this.messages[groupId][channel] = this.messages[groupId][channel].slice(-50);
        }
        this.scrollToBottom();
      }
    });
  }

  toggleMembersPanel() {
    this.showMembersPanel = !this.showMembersPanel;
  }

  addUserToGroup(email: string) {
    if (!email || !this.currentGroup) return this.setStatus('Provide a valid email', true);

    this.http
      .post<{ group: Group }>(
        `${API_BASE_URL}/groups/${this.currentGroup._id}/add-user`,
        { email },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (res) => {
          this.currentGroup = this.mapGroup(res.group);
          const idx = this.groups.findIndex((g) => g._id === res.group._id);
          if (idx !== -1) this.groups[idx] = this.currentGroup;
          this.setStatus(`${email} added to ${this.currentGroup.name}`);
          this.newUserEmail = '';
        },
        error: (err) => this.setStatus(err.error?.error || 'Failed to add user', true)
      });
  }

  removeUserFromGroup(userId: string) {
    if (!this.currentGroup) return;

    this.http
      .post<{ group: Group }>(
        `${API_BASE_URL}/groups/${this.currentGroup._id}/remove-user`,
        { userId },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        next: (res) => {
          this.currentGroup = this.mapGroup(res.group);
          const idx = this.groups.findIndex((g) => g._id === res.group._id);
          if (idx !== -1) this.groups[idx] = this.currentGroup;
          this.setStatus('User removed');
        },
        error: (err) => this.setStatus(err.error?.error || 'Failed to remove user', true)
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

  public isAdminOfGroup(group: Group | null): boolean {
    return !!group?.admins?.includes(this.userId);
  }

  isAdmin(user: any): boolean {
    if (!this.currentGroup || !user) return false;

    const admins = this.currentGroup.admins || [];
    return admins.includes(user._id) || admins.includes(user.email);
  }

  logout() {
    localStorage.removeItem('id');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('roles');
    this.router.navigate(['/login']);
  }
}
