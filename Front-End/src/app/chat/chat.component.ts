import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Message {
  sender: string;
  text?: string;
  timestamp: Date;
  image?: string;
}

interface Group {
  _id: string;
  name: string;
  channels: string[];
  users: string[]; // array of user IDs or emails
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
  userId: string = '';
  currentGroup: Group | null = null;
  currentChannel: string | null = null;
  messages: Message[] = [];
  newMessage: string = '';
  selectedFile: File | null = null;

  groups: Group[] = [];
  channels: { [groupName: string]: string[] } = {}; // maps group name to channels

  private socket!: Socket;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    // Load user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      this.username = user.username;
      this.userId = user._id;
      this.loadUserGroups();
    }

    // Initialize socket connection
    this.socket = io('http://localhost:3000');

    this.socket.on('previousMessages', (msgs: Message[]) => {
      this.messages = msgs;
    });

    this.socket.on('receiveMessage', (msg: Message) => {
      this.messages.push(msg);
    });
  }

  // ------------------ LOAD USER GROUPS ------------------
  loadUserGroups() {
    if (!this.userId) return;

    this.http.get<Group[]>(`http://localhost:3000/api/groups/user/${this.userId}`)
      .subscribe({
        next: (groups) => {
          this.groups = groups;
          groups.forEach(g => {
            this.channels[g.name] = g.channels;
          });
        },
        error: (err) => console.error('Failed to load user groups', err)
      });
  }

  // ------------------ GROUP & CHANNEL SELECTION ------------------
  selectGroup(group: Group) {
    this.currentGroup = group;
    this.currentChannel = null;
    this.messages = [];
  }

  selectChannel(channel: string) {
    if (!this.username || !this.currentGroup) return;

    this.currentChannel = channel;
    this.messages = [];
    this.socket.emit('join', {
      group: this.currentGroup.name,
      channel: this.currentChannel
    });
  }

  // ------------------ MESSAGE SENDING ------------------
  sendMessage() {
    if ((!this.newMessage.trim() && !this.selectedFile) || !this.username || !this.currentGroup || !this.currentChannel) return;

    if (this.selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        this.socket.emit('sendMessage', {
          group: this.currentGroup?.name,
          channel: this.currentChannel,
          sender: this.username,
          image: reader.result, // base64 image
          text: this.newMessage || ''
        });
        this.newMessage = '';
        this.selectedFile = null;
      };
      reader.readAsDataURL(this.selectedFile);
    } else {
      this.socket.emit('sendMessage', {
        group: this.currentGroup?.name,
        channel: this.currentChannel,
        sender: this.username,
        text: this.newMessage
      });
      this.newMessage = '';
    }
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  // ------------------ SIGN OUT ------------------
  signOut() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
