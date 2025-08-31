import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-group-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Group Admin Dashboard</h1>
    <p>Manage your group members and chats here.</p>
  `
})
export class GroupDashboardComponent {}
