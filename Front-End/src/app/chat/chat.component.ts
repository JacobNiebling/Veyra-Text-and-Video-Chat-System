import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';

interface Message {
  sender: string;
  text?: string;
  timestamp: string | Date;
  image?: string;
  system?: boolean;
  senderAvatar?: string;
  group?: string;
  channel?: string;
}

interface Group {
  _id: string;
  name: string;
  members: { _id: string; username: string; avatar?: string }[];
  admins?: { _id: string; username: string }[];
  channels?: string[];
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy {
  username = '';
  userId = '';
  avatarUrl = '/assets/avatar.png';
  selectedAvatar: File | null = null;

  groups: Group[] = [];
  channels: { [groupId: string]: string[] } = {};
  currentGroup: Group | null = null;
  currentChannel = '';

  messages: { [groupId: string]: { [channel: string]: Message[] } } = {};
  messagesView: Message[] = [];

  newMessage = '';
  selectedFile: File | null = null;

  socket!: Socket;
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  private joinedChannels: Set<string> = new Set();
  private readonly API_BASE_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadUserFromLocalStorage();
  }

  ngOnDestroy() {
    this.leaveChannel();
    this.socket.disconnect();
  }

  private loadUserFromLocalStorage() {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const avatar = localStorage.getItem('avatar');

    if (!userId || !username) {
      alert('User not logged in.');
      this.router.navigate(['/login']);
      return;
    }

    this.userId = userId;
    this.username = username;
    this.avatarUrl = avatar || '/assets/avatar.png';

    this.loadUserGroups();
    this.initSocket();
  }

  private loadUserGroups() {
    this.http.get<Group[]>(`${this.API_BASE_URL}/groups/user/${this.userId}`).subscribe({
      next: groups => {
        this.groups = groups || [];
        this.groups.forEach(g => {
          this.channels[g._id] = g.channels?.length ? g.channels : ['general'];
        });

        if (this.groups.length > 0) this.selectGroup(this.groups[0]);
      },
      error: err => console.error('Failed to load groups', err)
    });
  }

  startCall(groupId: string) {
    this.router.navigate(['/video_chat', groupId]);
  }

  private initSocket() {
    this.socket = io('http://localhost:3000');

    // Live messages
    this.socket.on('receiveMessage', (msg: Message & { group: string; channel: string }) => {
      msg.senderAvatar = msg.senderAvatar || '/assets/avatar.png';
      this.addMessageToChannel(msg.group, msg.channel, msg);
    });

    // System messages
    this.socket.on('userJoinedChannel', ({ username, channel, group }: any) => {
      this.addSystemMessage(group, channel, `${username} joined ${channel}`);
    });
    this.socket.on('userLeftChannel', ({ username, channel, group }: any) => {
      this.addSystemMessage(group, channel, `${username} left ${channel}`);
    });

    // Previous messages
    this.socket.on('previousMessages', (msgs: Message[] & { group: string; channel: string }[]) => {
      if (!msgs.length) return;
      const groupId = msgs[0].group!;
      const channel = msgs[0].channel!;
      msgs.forEach(msg => msg.senderAvatar = msg.senderAvatar || '/assets/avatar.png');

      this.messages[groupId] = this.messages[groupId] || {};
      this.messages[groupId][channel] = msgs.slice(-50); // Keep last 50 only

      if (this.currentGroup?._id === groupId && this.currentChannel === channel) {
        this.messagesView = [...this.messages[groupId][channel]];
        this.scrollToBottom(true);
      }
    });
  }

  private addSystemMessage(groupId: string, channel: string, text: string) {
    const sysMsg: Message = {
      sender: 'System',
      text,
      timestamp: new Date(),
      system: true,
      group: groupId,
      channel
    };
    this.addMessageToChannel(groupId, channel, sysMsg);
  }

  private addMessageToChannel(groupId: string, channel: string, msg: Message) {
    this.messages[groupId] = this.messages[groupId] || {};
    this.messages[groupId][channel] = this.messages[groupId][channel] || [];

    // Prevent duplicates
    const exists = this.messages[groupId][channel].some(
      m => new Date(m.timestamp).getTime() === new Date(msg.timestamp).getTime() && m.sender === msg.sender
    );
    if (!exists) {
      this.messages[groupId][channel].push(msg);

      // Keep last 50
      if (this.messages[groupId][channel].length > 50) {
        this.messages[groupId][channel] = this.messages[groupId][channel].slice(-50);
      }
    }

    if (this.currentGroup?._id === groupId && this.currentChannel === channel) {
      this.messagesView = [...this.messages[groupId][channel]];
      this.scrollToBottom(true);
    }
  }

  selectGroup(group: Group) {
    this.leaveChannel();
    this.currentGroup = group;
    this.currentChannel = group.channels?.[0] || this.channels[group._id]?.[0] || '';
    if (this.currentChannel) this.selectChannel(this.currentChannel);
  }

  selectChannel(ch: string) {
    if (!this.currentGroup) return;

    // Leave previous channel
    const prevChannelKey = `${this.currentGroup._id}:${this.currentChannel}`;
    if (this.currentChannel && this.joinedChannels.has(prevChannelKey)) {
      this.socket.emit('leave', { group: this.currentGroup._id, channel: this.currentChannel, username: this.username });
      this.joinedChannels.delete(prevChannelKey);
    }

    this.currentChannel = ch;
    const groupId = this.currentGroup._id;
    const channelKey = `${groupId}:${ch}`;

    this.messages[groupId] = this.messages[groupId] || {};
    this.messages[groupId][ch] = this.messages[groupId][ch] || [];
    this.messagesView = [...this.messages[groupId][ch]];

    if (!this.joinedChannels.has(channelKey)) {
      this.socket.emit('join', { group: groupId, channel: ch, username: this.username });
      this.joinedChannels.add(channelKey);
    }

    this.socket.emit('getChannelHistory', { group: groupId, channel: ch });
    this.scrollToBottom(true);
  }

  private scrollToBottom(smooth = false) {
    if (!this.messagesContainer) return;
    const container = this.messagesContainer.nativeElement;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  leaveChannel() {
    if (!this.currentGroup || !this.currentChannel) return;
    this.socket.emit('leave', { group: this.currentGroup._id, channel: this.currentChannel, username: this.username });
  }

  async sendMessage() {
    if (!this.newMessage.trim() && !this.selectedFile) return;
    if (!this.currentGroup || !this.currentChannel) return;

    let imageUrl: string | undefined;
    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      try {
        const res: any = await this.http.post(`${this.API_BASE_URL}/upload`, formData).toPromise();
        imageUrl = `http://localhost:3000${res.path}`;
      } catch (err) {
        console.error('File upload failed', err);
      }
    }

    const msg: Message & { group: string; channel: string } = {
      sender: this.username,
      senderAvatar: this.avatarUrl,
      text: this.newMessage || undefined,
      image: imageUrl,
      timestamp: new Date(),
      group: this.currentGroup._id,
      channel: this.currentChannel
    };

    this.socket.emit('sendMessage', msg);
    this.newMessage = '';
    this.selectedFile = null;
  }

  onFileSelected(event: any) { this.selectedFile = event.target.files[0]; }
  onAvatarSelected(event: any) { this.selectedAvatar = event.target.files[0]; }

  async uploadAvatar() {
    if (!this.selectedAvatar || !this.userId) return;
    const formData = new FormData();
    formData.append('file', this.selectedAvatar);
    formData.append('userId', this.userId);

    try {
      const res: any = await this.http.post(`${this.API_BASE_URL}/upload/avatar`, formData).toPromise();
      this.avatarUrl = `http://localhost:3000${res.path}`;
      localStorage.setItem('avatar', this.avatarUrl);
      this.socket.emit('updateAvatar', { userId: this.userId, avatar: this.avatarUrl });
      this.selectedAvatar = null;
    } catch (err) {
      console.error('Avatar upload failed', err);
    }
  }
}
