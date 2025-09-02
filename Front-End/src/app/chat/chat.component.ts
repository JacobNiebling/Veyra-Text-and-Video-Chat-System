import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { io, Socket } from 'socket.io-client';

interface Message {
  sender: string;
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  username: string = '';
  loginInput: string = '';
  currentGroup: string | null = null;
  currentChannel: string | null = null;
  messages: Message[] = [];
  newMessage: string = '';

  groups = ['Tech Group', 'Gaming Group'];
  channels: { [key: string]: string[] } = {
    'Tech Group': ['General', 'Frontend', 'Backend'],
    'Gaming Group': ['General', 'MMORPG', 'FPS']
  };

  private socket!: Socket;

  ngOnInit() {
    this.socket = io('http://localhost:3000');

    // Listen for previous messages
    this.socket.on('previousMessages', (msgs: Message[]) => {
      this.messages = msgs;
    });

    // Listen for new messages
    this.socket.on('receiveMessage', (msg: Message) => {
      this.messages.push(msg);
    });
  }

  login() {
    if (this.loginInput.trim()) {
      this.username = this.loginInput.trim();
      this.loginInput = '';
    }
  }

  selectGroup(group: string) {
    this.currentGroup = group;
    this.currentChannel = null;
    this.messages = [];
  }

  selectChannel(channel: string) {
    if (!this.username || !this.currentGroup) return;

    this.currentChannel = channel;
    this.messages = [];

    // Join room on server
    this.socket.emit('join', { group: this.currentGroup, channel: this.currentChannel });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.username || !this.currentGroup || !this.currentChannel) return;

    this.socket.emit('sendMessage', {
      group: this.currentGroup,
      channel: this.currentChannel,
      sender: this.username,
      text: this.newMessage
    });

    this.newMessage = '';
  }

  logout() {
    this.username = '';
    this.currentGroup = null;
    this.currentChannel = null;
    this.messages = [];
  }
}
