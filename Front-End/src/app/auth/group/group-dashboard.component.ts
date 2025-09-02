import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Group {
  id: number;
  name: string;
  channels: string[];
}

@Component({
  selector: 'app-group-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupDashboardComponent {
  username = 'Admin'; // For header display
  newMessage = '';
  currentChannel: string | null = null;
  currentGroup: Group | null = null;

  // Groups the admin has access to
  groups: Group[] = [
    { id: 1, name: 'Developers', channels: ['Frontend', 'Backend'] },
    { id: 2, name: 'Designers', channels: ['UI', 'UX'] }
  ];

  // Messages storage
  messages: Record<number, Record<string, { sender: string; text: string; timestamp: Date }[]>> = {};

  // ----------------- Template Methods -----------------
  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  isAdminOfGroup(group: Group | null): boolean {
    return true; // Replace with real admin logic
  }

  selectGroup(group: Group) {
    this.currentGroup = group;
    this.currentChannel = group.channels[0] || null;

    if (!this.messages[group.id]) this.messages[group.id] = {};
    group.channels.forEach(ch => {
      if (!this.messages[group.id][ch]) this.messages[group.id][ch] = [];
    });
  }

  selectChannel(channel: string) {
    this.currentChannel = channel;
    if (this.currentGroup && !this.messages[this.currentGroup.id][channel]) {
      this.messages[this.currentGroup.id][channel] = [];
    }
  }

  addGroup(groupName: string) {
    if (!groupName.trim()) return;
    const newGroup: Group = { id: Date.now(), name: groupName.trim(), channels: [] };
    this.groups.push(newGroup);
  }

  deleteGroup(group: Group) {
    this.groups = this.groups.filter(g => g.id !== group.id);
    if (this.currentGroup?.id === group.id) this.currentGroup = null;
  }

  addChannel(group: Group, channelName: string) {
    if (!channelName.trim()) return;
    group.channels.push(channelName.trim());
    if (!this.messages[group.id][channelName.trim()]) this.messages[group.id][channelName.trim()] = [];
  }

  deleteChannel(group: Group, channel: string) {
    group.channels = group.channels.filter(ch => ch !== channel);
    if (this.currentChannel === channel) this.currentChannel = group.channels[0] || null;
    delete this.messages[group.id][channel];
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.currentGroup || !this.currentChannel) return;

    this.messages[this.currentGroup.id][this.currentChannel].push({
      sender: this.username,
      text: this.newMessage.trim(),
      timestamp: new Date()
    });

    this.newMessage = '';
  }

  constructor(private router: Router) {}
}
