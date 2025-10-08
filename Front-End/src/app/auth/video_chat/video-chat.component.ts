import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';

interface Participant {
  id: string;
  stream: MediaStream;
  speaking?: boolean;
}

@Component({
  selector: 'app-video-chat',
  templateUrl: './video-chat.component.html',
  styleUrls: ['./video-chat.component.scss']
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @ViewChild('videoGrid') videoGrid!: ElementRef<HTMLDivElement>;

  socket!: Socket;
  peer!: Peer;
  myStream!: MediaStream;
  participants: Participant[] = [];
  muted = false;

  ngOnInit() {
    this.initVideo();
  }

  ngOnDestroy() {
    this.peer?.destroy();
    this.socket?.disconnect();
  }

  async initVideo() {
    this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.addVideo(this.myStream, 'me');

    this.socket = io('http://localhost:3000');
    this.peer = new Peer({ host: 'localhost', port: 3000, path: '/peerjs' });

    this.peer.on('open', (id) => {
      console.log('Peer ID:', id);
      // join room logic
    });

    this.peer.on('call', (call) => {
      call.answer(this.myStream);
      call.on('stream', (stream) => this.addVideo(stream, call.peer));
    });

    this.socket.on('userJoined', ({ peerId }) => {
      this.connectToNewUser(peerId, this.myStream);
    });
  }

  addVideo(stream: MediaStream, id: string) {
    const videoEl = document.createElement('video');
    videoEl.srcObject = stream;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    const wrapper = document.createElement('div');
    wrapper.classList.add('video-wrapper');
    wrapper.id = id;
    wrapper.appendChild(videoEl);

    this.videoGrid.nativeElement.querySelector('.participants')?.appendChild(wrapper);

    this.participants.push({ id, stream });
  }

  connectToNewUser(peerId: string, stream: MediaStream) {
    const call = this.peer.call(peerId, stream);
    call.on('stream', (remoteStream) => this.addVideo(remoteStream, peerId));
  }

  toggleMute() {
    if (this.myStream) {
      const audioTrack = this.myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.muted = !audioTrack.enabled;
      }
    }
  }
}
