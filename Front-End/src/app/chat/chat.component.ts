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
  messages: Message[] = [];
  newMessage = '';
  selectedFile: File | null = null;

  errorMessage = ''; // user-visible errors
  debugLogs: string[] = []; // internal debug

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
    if (this.videoCallStarted) {
      this.peer.destroy();
      this.socket.disconnect();
      this.myStream.getTracks().forEach(track => track.stop());
    }
  }

  // ---------------- Debug ----------------
  logDebug(msg: string) {
    console.log('[Chat Debug]', msg);
    this.debugLogs.push(msg);
  }

  // ---------------- User functions ----------------
  loadUserFromLocalStorage() {
    this.logDebug('Loading user from localStorage');
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
    this.logDebug('Refreshing groups...');
    this.loadUserGroups();
  }

  loadUserGroups() {
    if (!this.userId) {
      this.errorMessage = 'Cannot load groups: no user ID';
      console.error(this.errorMessage);
      return;
    }

    this.logDebug(`Fetching groups for userId=${this.userId}`);
    this.http.get<Group[]>(`${this.API_BASE_URL}/groups/user/${this.userId}`).subscribe({
      next: (res) => {
        if (!res || res.length === 0) {
          this.errorMessage = 'No groups found for this user';
          console.warn(this.errorMessage);
        } else {
          this.errorMessage = '';
        }

        this.groups = res || [];
        this.groups.forEach(g => {
          this.channels[g._id] = g.channels?.length ? g.channels : ['general', 'random', 'media'];
          this.logDebug(`Loaded group: ${g.name}, channels: ${this.channels[g._id].join(', ')}`);
        });

        if (this.groups.length > 0) this.selectGroup(this.groups[0]);
      },
      error: (err) => {
        this.errorMessage = 'Failed to load groups from server';
        console.error(this.errorMessage, err);
        this.logDebug(`Error loading groups: ${JSON.stringify(err)}`);
      }
    });
  }

  signOut() {
    this.logDebug('Signing out');
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  // ---------------- Socket ----------------
  initSocket() {
    this.logDebug('Initializing Socket.io');
    this.socket = io('http://localhost:3000');
    this.socket.on('connect', () => this.logDebug('Socket connected: ' + this.socket.id));
    this.socket.on('connect_error', (err) => this.logDebug('Socket connection error: ' + JSON.stringify(err)));
  }

  // ---------------- Chat functions ----------------
  selectGroup(group: Group) {
    this.logDebug(`Selecting group: ${group.name}`);
    this.currentGroup = group;
    this.currentChannel = group.channels?.[0] || this.channels[group._id]?.[0] || '';
    this.messages = [];
  }

  selectChannel(ch: string) {
    if (!this.currentGroup) return;
    this.logDebug(`Selecting channel: ${ch} in group ${this.currentGroup.name}`);
    this.currentChannel = ch;
    this.messages = [];

    this.socket?.emit('join', {
      group: this.currentGroup._id,
      channel: this.currentChannel,
      username: this.username
    });

    this.socket?.once('previousMessages', (msgs: Message[]) => {
      this.logDebug(`Received ${msgs?.length || 0} previous messages`);
      this.messages = msgs || [];
    });
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
        this.logDebug('File uploaded: ' + imageUrl);
      } catch (err) {
        console.error('Upload failed:', err);
        this.logDebug('Upload failed: ' + JSON.stringify(err));
      }
    }

    const msg: Message = {
      sender: this.username,
      text: this.newMessage || undefined,
      image: imageUrl || undefined,
      timestamp: new Date()
    };

    this.socket?.emit('sendMessage', {
      group: this.currentGroup._id,
      channel: this.currentChannel,
      sender: this.username,
      text: this.newMessage,
      image: imageUrl
    });

    this.messages.push(msg);
    this.newMessage = '';
    this.selectedFile = null;
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    this.logDebug(`File selected: ${this.selectedFile?.name}`);
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
