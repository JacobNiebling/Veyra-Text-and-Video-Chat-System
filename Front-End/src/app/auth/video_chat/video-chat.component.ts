import { Component, OnInit, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';

interface Message {
  sender: string;
  text: string;
  avatar?: string;
  timestamp: Date;
}

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss']
})
export class VideoChatComponent implements OnInit, OnDestroy {
  socket!: Socket;
  peer!: Peer;
  myStream!: MediaStream;
  peers: { [id: string]: MediaStream } = {};
  messages: Message[] = [];
  username = 'User_' + Math.floor(Math.random() * 1000);
  group = 'general';
  channel = 'main';
  muted = false;

  constructor() {}

  async ngOnInit() {
    // 1️⃣ Get user media
    this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.addVideo(this.myStream, this.username);

    // 2️⃣ Setup Socket.IO
    this.socket = io('http://localhost:3000');

    // 3️⃣ Setup PeerJS
    this.peer = new Peer({
      host: 'localhost',
      port: 3000,
      path: '/peerjs'
    });

    this.peer.on('open', (id) => {
      console.log('My peer ID:', id);
      // Join room
      this.socket.emit('join', { group: this.group, channel: this.channel, username: this.username });
    });

    // Receive call
    this.peer.on('call', (call) => {
      call.answer(this.myStream);
      call.on('stream', (remoteStream) => this.addVideo(remoteStream, call.peer));
    });

    // Socket.IO events
    this.socket.on('userJoined', ({ username }) => console.log(username, 'joined'));
    this.socket.on('previousMessages', (msgs: Message[]) => this.messages.push(...msgs));
    this.socket.on('receiveMessage', (msg: Message) => this.messages.push(msg));
    this.socket.on('userLeft', ({ username }) => console.log(username, 'left'));

    // Connect to new peers
    this.socket.on('userJoined', ({ username, peerId }) => {
      this.connectToNewUser(peerId, this.myStream);
    });
  }

  ngOnDestroy() {
    this.peer.destroy();
    this.socket.disconnect();
  }

  // ------------------- Video -------------------
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
    }
  }

  connectToNewUser(peerId: string, stream: MediaStream) {
    const call = this.peer.call(peerId, stream);
    call.on('stream', (remoteStream) => this.addVideo(remoteStream, peerId));
  }

  // ------------------- Chat -------------------
  sendMessage(input: HTMLInputElement) {
    if (!input.value) return;
    const msg: Message = { sender: this.username, text: input.value, timestamp: new Date() };
    this.socket.emit('sendMessage', { group: this.group, channel: this.channel, sender: this.username, text: input.value });
    this.messages.push(msg);
    input.value = '';
  }

  // ------------------- Controls -------------------
  toggleMute() {
    this.myStream.getAudioTracks()[0].enabled = this.muted;
    this.muted = !this.muted;
  }

  async shareScreen() {
    const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
    this.addVideo(screenStream, 'screen-share');
    // Optional: Replace your video stream for peer calls
    Object.values(this.peers).forEach(peerStream => {
      // TODO: Replace stream in calls if needed
    });
  }
}
