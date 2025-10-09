import {
  Component, OnInit, ViewChild, ElementRef, Input, OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import Peer, { MediaConnection } from 'peerjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @Input({ required: true }) groupId!: string;
  @Input() userRole: 'admin' | 'group_admin' | 'chat_user' = 'chat_user';

  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideosContainer', { static: false }) remoteVideosContainer!: ElementRef<HTMLDivElement>;

  socket!: Socket;
  peer!: Peer;
  localStream!: MediaStream;
  peers: { [id: string]: MediaConnection } = {};

  isMuted: boolean = false;
  callStarted: boolean = true;

  constructor(private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit(): void {
    setTimeout(() => {
        this.autoStartCall();
    }, 0);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // --- Call Control Methods ---

  autoStartCall(): void {
    this.initVideoCall();

    if (this.socket) {
        this.socket.emit('call-started', this.groupId, 'A user has started a video call.');
    }
  }

  endCall(): void {
    console.log('Ending call and cleaning up resources.');

    this.cleanup();

    let redirectToPath: string;

    switch (this.userRole) {
        case 'admin':
            redirectToPath = '/admin-dashboard';
            break;
        case 'group_admin':
            redirectToPath = '/group-dashboard';
            break;
        case 'chat_user':
        default:
            redirectToPath = '/chat';
            break;
    }

    this.router.navigate([redirectToPath]).catch(err => {
        console.error(`Failed to navigate to ${redirectToPath}, attempting redirect to home:`, err);
        this.router.navigate(['/']);
    });
  }

  toggleAudioMute(): void {
    if (!this.localStream) {
      console.warn('Cannot toggle mute: Local stream is not available.');
      return;
    }

    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('No audio tracks found in the local stream.');
      return;
    }

    this.isMuted = !this.isMuted;
    audioTracks.forEach(track => {
      track.enabled = !this.isMuted;
    });
  }

  // --- Internal Call Management ---

  private async initVideoCall(): Promise<void> {
    this.socket = io('http://localhost:3000');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (this.localVideo) {
        this.localVideo.nativeElement.srcObject = this.localStream;
        await this.localVideo.nativeElement.play();
      }

    } catch (err) {
      console.error('Error accessing camera/microphone:', err);
      this.cleanup();
      return;
    }

    this.peer = new Peer({
      host: 'localhost',
      port: 3000,
      path: '/peerjs',
    });

    this.peer.on('call', (call: MediaConnection) => {
      // 🔑 LOGGING: Confirm this user is answering an incoming call
      console.log(`[PeerJS] Peer ${this.peer.id} received call from: ${call.peer}. Answering...`);
      call.answer(this.localStream);
      this.setupRemoteStreamListeners(call);
    });

    this.peer.on('open', (id: string) => {
      console.log(`[PeerJS] Peer ID established: ${id}`);
      this.socket.emit('join-room', this.groupId, id);
    });

    this.socket.on('user-connected', (peerId: string) => {
      // 🔑 LOGGING: Confirm this user knows about a new peer
      console.log(`[Socket.io] New user connected: ${peerId}. Initiating outbound call...`);
      this.callNewUser(peerId, this.localStream);
    });

    this.socket.on('user-disconnected', (peerId: string) => {
      console.log(`[Socket.io] User disconnected: ${peerId}`);
      if (this.peers[peerId]) {
        this.peers[peerId].close();
        delete this.peers[peerId];
      }
    });
  }

  private cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    for (const peerId in this.peers) {
      if (this.peers.hasOwnProperty(peerId)) {
        this.peers[peerId].close();
      }
    }
    this.peers = {};

    if (this.peer) {
        if (this.socket) {
            this.socket.emit('leave-room', this.groupId, this.peer.id);
        }
        this.peer.destroy();
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.callStarted = false;
    this.cdr.detectChanges();
  }

  callNewUser(peerId: string, stream: MediaStream): void {
    const call = this.peer.call(peerId, stream);
    this.setupRemoteStreamListeners(call);
  }

  private setupRemoteStreamListeners(call: MediaConnection): void {
    const peerId = call.peer;

    if (this.peers[peerId]) {
        this.peers[peerId].close();
    }

    const videoEl = document.createElement('video');
    videoEl.muted = false;
    videoEl.autoplay = true;
    videoEl.id = `video-${peerId}`;
    videoEl.classList.add('remote-stream-video');

    call.on('stream', (remoteStream: MediaStream) => {
      // 🔑 LOGGING: Confirm the remote stream data has actually arrived
      console.log(`[WebRTC] Stream received successfully from: ${peerId}. Attaching to DOM.`);
      videoEl.srcObject = remoteStream;
      if (this.remoteVideosContainer?.nativeElement && !this.remoteVideosContainer.nativeElement.contains(videoEl)) {
        this.remoteVideosContainer.nativeElement.appendChild(videoEl);
        // Force change detection here to ensure Angular picks up the external DOM manipulation
        this.cdr.detectChanges();
      }
    });

    call.on('close', () => {
      console.log(`[WebRTC] Connection closed for: ${peerId}`);
      videoEl.remove();
      delete this.peers[peerId];
      this.cdr.detectChanges();
    });

    call.on('error', (err) => {
        console.error(`[WebRTC] Error on call from ${peerId}:`, err);
    });

    this.peers[peerId] = call;
  }
}
