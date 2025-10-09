import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { Router } from '@angular/router';

interface Message {
  sender: string;
  text?: string;
  timestamp: Date;
  image?: string;
  system?: boolean;
}

interface Group {
  _id: string;
  name: string;
  members: { _id: string; username: string }[];
  channels?: string[];
  createdBy?: { _id: string; username: string };
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
  avatarUrl = '/uploads/avatar.png';
  groups: Group[] = [];
  channels: { [groupId: string]: string[] } = {};
  currentGroup: Group | null = null;
  currentChannel = '';

  // Store messages per group and channel
  messages: { [groupId: string]: { [channel: string]: Message[] } } = {};
  messagesView: Message[] = [];

  newMessage = '';
  selectedFile: File | null = null;

  errorMessage = '';
  debugLogs: string[] = [];

  videoCallStarted = false;
  socket!: Socket;
  peer!: Peer;
  myStream!: MediaStream;
  peers: { [id: string]: MediaStream } = {};
  muted = false;

  private readonly API_BASE_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.logDebug('ngOnInit');
    this.loadUserFromLocalStorage();
  }

  ngOnDestroy() {
    this.logDebug('ngOnDestroy');
    this.leaveChannel();
    if (this.videoCallStarted) {
      this.peer.destroy();
      this.socket.disconnect();
      this.myStream.getTracks().forEach(track => track.stop());
    }
  }

  logDebug(msg: string) {
    console.log('[Chat Debug]', msg);
    this.debugLogs.push(msg);
  }

  loadUserFromLocalStorage() {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const avatar = localStorage.getItem('avatar');

    if (!userId || !username) {
      this.errorMessage = 'User not logged in. Redirecting...';
      console.error(this.errorMessage);
      setTimeout(() => this.router.navigate(['/login']), 1000);
      return;
    }

    this.userId = userId;
    this.username = username;
    this.avatarUrl = avatar || '/uploads/avatar.png';

    this.loadUserGroups();
    this.initSocket();
  }

  refreshUserGroups() {
    this.loadUserGroups();
  }

  loadUserGroups() {
    if (!this.userId) return;

    this.http.get<Group[]>(`${this.API_BASE_URL}/groups/user/${this.userId}`).subscribe({
      next: (res) => {
        this.groups = res || [];
        this.groups.forEach(g => {
          this.channels[g._id] = g.channels?.length ? g.channels : ['general', 'random', 'media'];
        });

        if (this.groups.length > 0) this.selectGroup(this.groups[0]);
      },
      error: (err) => {
        console.error('Failed to load groups', err);
      }
    });
  }

  signOut() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  initSocket() {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => this.logDebug('Socket connected: ' + this.socket.id));
    this.socket.on('connect_error', (err) => this.logDebug('Socket connection error: ' + JSON.stringify(err)));

    this.socket.on('userJoinedChannel', ({ username, channel, group }: any) => {
      const sysMsg: Message = {
        sender: 'System',
        text: `${username} joined channel ${channel}`,
        timestamp: new Date(),
        system: true
      };
      this.addMessageToChannel(group, channel, sysMsg);
    });

    this.socket.on('userLeftChannel', ({ username, channel, group }: any) => {
      const sysMsg: Message = {
        sender: 'System',
        text: `${username} left channel ${channel}`,
        timestamp: new Date(),
        system: true
      };
      this.addMessageToChannel(group, channel, sysMsg);
    });

    this.socket.on('receiveMessage', (msg: Message & { group: string; channel: string }) => {
      this.addMessageToChannel(msg.group, msg.channel, msg);
    });
  }

  private addMessageToChannel(groupId: string, channel: string, msg: Message) {
    if (!this.messages[groupId]) this.messages[groupId] = {};
    if (!this.messages[groupId][channel]) this.messages[groupId][channel] = [];

    // Prevent duplicates
    const exists = this.messages[groupId][channel].some(
      m => m.timestamp === msg.timestamp && m.sender === msg.sender
    );
    if (!exists) this.messages[groupId][channel].push(msg);

    if (this.currentGroup?._id === groupId && this.currentChannel === channel) {
      this.messagesView = [...this.messages[groupId][channel]];
    }
  }

  selectGroup(group: Group) {
    this.leaveChannel();
    this.currentGroup = group;
    this.currentChannel = group.channels?.[0] || this.channels[group._id]?.[0] || '';
    this.selectChannel(this.currentChannel);
  }

  selectChannel(ch: string) {
    if (!this.currentGroup) return;
    this.leaveChannel();
    this.currentChannel = ch;

    const groupId = this.currentGroup._id;
    if (!this.messages[groupId]) this.messages[groupId] = {};
    if (!this.messages[groupId][ch]) this.messages[groupId][ch] = [];

    // Display cached messages
    this.messagesView = this.messages[groupId][ch];

    // Join channel
    this.socket.emit('join', { group: groupId, channel: ch, username: this.username });

    // Fetch previous messages
    this.socket.emit('getChannelHistory', { group: groupId, channel: ch });

    this.socket.once('channelHistory', (msgs: Message[]) => {
      this.messages[groupId][ch] = msgs.map(msg => ({ ...msg, system: msg.system || false }));
      if (this.currentGroup?._id === groupId && this.currentChannel === ch) {
        this.messagesView = [...this.messages[groupId][ch]];
      }
    });
  }

  leaveChannel() {
    if (!this.currentGroup || !this.currentChannel) return;
    this.socket.emit('leave', { group: this.currentGroup._id, channel: this.currentChannel, username: this.username });
  }

  startCall(groupId: string) {
    this.router.navigate(['/video_chat', groupId]);
  }


  async sendMessage() {
    if (!this.newMessage && !this.selectedFile) return;
    if (!this.currentGroup || !this.currentChannel) return;

    let imageUrl: string | null = null;
    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      try {
        const uploadRes: any = await this.http.post(`${this.API_BASE_URL}/upload`, formData).toPromise();
        imageUrl = `http://localhost:3000${uploadRes.path}`;
      } catch (err) {
        console.error('Upload failed', err);
      }
    }

    const payload = {
      group: this.currentGroup._id,
      channel: this.currentChannel,
      sender: this.username,
      text: this.newMessage || undefined,
      image: imageUrl || undefined
    };

    this.socket.emit('sendMessage', payload);

    this.newMessage = '';
    this.selectedFile = null;
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }
  // ---------------- Video Call ----------------
  async startVideoCall() {
    if (!this.currentGroup || !this.currentChannel) {
      alert('Select a group and channel first!');
      return;
    }
    if (this.videoCallStarted) return;

    this.videoCallStarted = true;
    this.logDebug('Starting video call');

    this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.addVideo(this.myStream, this.username);

    this.peer = new Peer({ host: 'localhost', port: 3000, path: '/peerjs' });

    this.peer.on('open', (id) => {
      this.socket.emit('join', {
        group: this.currentGroup?._id,
        channel: this.currentChannel,
        username: this.username,
        peerId: id
      });
      this.logDebug('Peer opened with ID: ' + id);
    });

    this.peer.on('call', (call) => {
      call.answer(this.myStream);
      call.on('stream', (remoteStream) => this.addVideo(remoteStream, call.peer));
      this.logDebug('Incoming call handled from: ' + call.peer);
    });

    this.socket.on('userJoined', ({ peerId }) => {
      if (peerId !== this.peer.id) this.connectToNewUser(peerId, this.myStream);
    });
  }

  addVideo(stream: MediaStream, id: string) {
    const videoGrid = document.getElementById('video-grid')!;
    let videoEl = document.getElementById(id) as HTMLVideoElement;
    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.id = id;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.srcObject = stream;
      videoGrid.appendChild(videoEl);
      this.logDebug('Added video element for: ' + id);
    }
  }

  connectToNewUser(peerId: string, stream: MediaStream) {
    const call = this.peer.call(peerId, stream);
    call.on('stream', (remoteStream) => this.addVideo(remoteStream, peerId));
    this.logDebug('Connected to new user via Peer: ' + peerId);
  }

  toggleMute() {
    if (this.myStream) {
      this.myStream.getAudioTracks()[0].enabled = this.muted;
      this.muted = !this.muted;
      this.logDebug('Toggled mute: ' + this.muted);
    }
  }
}
