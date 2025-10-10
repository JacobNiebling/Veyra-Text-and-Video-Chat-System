import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';

// Message strcuture interface
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

// Group structure interface
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

  // User info
  username = '';
  userId = '';
  avatarUrl = '/assets/avatar.png';
  selectedAvatar: File | null = null;

  // Group info
  groups: Group[] = [];
  channels: { [groupId: string]: string[] } = {};
  currentGroup: Group | null = null;
  currentChannel = '';

  // Message info
  messages: { [groupId: string]: { [channel: string]: Message[] } } = {};
  messagesView: Message[] = [];

  newMessage = '';
  selectedFile: File | null = null;

  // Socket
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

  // User setup
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

  // Load user groups
  private loadUserGroups() {
    // Fetch all groups that logged in user belongs to
    this.http.get<Group[]>(`${this.API_BASE_URL}/groups/user/${this.userId}`).subscribe({
      next: groups => {
        // Initialize channels for each group
        this.groups = groups || [];
        this.groups.forEach(g => {
          this.channels[g._id] = g.channels?.length ? g.channels : ['general'];
        });
        // Auto select first group if a group exists
        if (this.groups.length > 0) this.selectGroup(this.groups[0]);
      },
      error: err => console.error('Failed to load groups', err)
    });
  }

  // Start video call
  startCall(groupId: string) {
    this.router.navigate(['/video_chat', groupId]);
  }

  private initSocket() {
    this.socket = io('http://localhost:3000');

    // Listen for live messages
    this.socket.on('receiveMessage', (msg: Message & { group: string; channel: string }) => {
      msg.senderAvatar = msg.senderAvatar || '/assets/avatar.png';
      this.addMessageToChannel(msg.group, msg.channel, msg);
    });

    // Listen for live system messages
    this.socket.on('userJoinedChannel', ({ username, channel, group }: any) => {
      this.addSystemMessage(group, channel, `${username} joined ${channel}`);
    });
    this.socket.on('userLeftChannel', ({ username, channel, group }: any) => {
      this.addSystemMessage(group, channel, `${username} left ${channel}`);
    });

    // Receive and store previous messages for channels
    this.socket.on('previousMessages', (msgs: Message[] & { group: string; channel: string }[]) => {
      if (!msgs.length) return;
      const groupId = msgs[0].group!;
      const channel = msgs[0].channel!;
      msgs.forEach(msg => msg.senderAvatar = msg.senderAvatar || '/assets/avatar.png');

      this.messages[groupId] = this.messages[groupId] || {};
      this.messages[groupId][channel] = msgs.slice(-50); // Keep last 50 only

      // Update current view if relevant
      if (this.currentGroup?._id === groupId && this.currentChannel === channel) {
        this.messagesView = [...this.messages[groupId][channel]];
        this.scrollToBottom(true);
      }
    });
  }

  // Add system message
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

  // Add message to channel
  private addMessageToChannel(groupId: string, channel: string, msg: Message) {
    this.messages[groupId] = this.messages[groupId] || {};
    this.messages[groupId][channel] = this.messages[groupId][channel] || [];

    // Prevent duplicate messages based on timestamp and sender
    const exists = this.messages[groupId][channel].some(
      m => new Date(m.timestamp).getTime() === new Date(msg.timestamp).getTime() && m.sender === msg.sender
    );
    if (!exists) {
      this.messages[groupId][channel].push(msg);

      // Keep last 50 messages
      if (this.messages[groupId][channel].length > 50) {
        this.messages[groupId][channel] = this.messages[groupId][channel].slice(-50);
      }
    }

    // Update displayed messages if in current channel
    if (this.currentGroup?._id === groupId && this.currentChannel === channel) {
      this.messagesView = [...this.messages[groupId][channel]];
      this.scrollToBottom(true);
    }
  }

  // Select group
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

    // Join new channel
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

  // Scroll chat
  private scrollToBottom(smooth = false) {
    if (!this.messagesContainer) return;
    const container = this.messagesContainer.nativeElement;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  // Leave channel
  leaveChannel() {
    if (!this.currentGroup || !this.currentChannel) return;
    this.socket.emit('leave', { group: this.currentGroup._id, channel: this.currentChannel, username: this.username });
  }

  // Send message
  async sendMessage() {
    // If no message, file, group or channel is selected fo nothing
    if (!this.newMessage.trim() && !this.selectedFile) return;
    if (!this.currentGroup || !this.currentChannel) return;

    let imageUrl: string | undefined;

    // Handle file ipload if file was selected
    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      try {
        //Upload file to server
        const res: any = await this.http.post(`${this.API_BASE_URL}/upload`, formData).toPromise();
        imageUrl = `http://localhost:3000${res.path}`;
      } catch (err) {
        console.error('File upload failed', err);
      }
    }

    // Constuct message object and include optional image
    const msg: Message & { group: string; channel: string } = {
      sender: this.username,
      senderAvatar: this.avatarUrl,
      text: this.newMessage || undefined,
      image: imageUrl,
      timestamp: new Date(),
      group: this.currentGroup._id,
      channel: this.currentChannel
    };

    // send message to server via socket
    this.socket.emit('sendMessage', msg);
    // Clear input fields
    this.newMessage = '';
    this.selectedFile = null;
  }

  // File and avatar selection
  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  onAvatarSelected(event: any) {
    this.selectedAvatar = event.target.files[0];
  }

  // Upload avatar
  async uploadAvatar() {
    if (!this.selectedAvatar || !this.userId) return;
    const formData = new FormData();
    // Send userId along with file
    formData.append('file', this.selectedAvatar);
    formData.append('userId', this.userId);

    try {
      // Upload avatar to server
      const res: any = await this.http.post(`${this.API_BASE_URL}/upload/avatar`, formData).toPromise();
      // Set new avatar URL and persist avatar locally
      this.avatarUrl = `http://localhost:3000${res.path}`;
      localStorage.setItem('avatar', this.avatarUrl);

      // Notify other clients about avatar update via socket
      this.socket.emit('updateAvatar', { userId: this.userId, avatar: this.avatarUrl });

      // Reset selected avatar
      this.selectedAvatar = null;
    } catch (err) {
      console.error('Avatar upload failed', err);
    }
  }
}
