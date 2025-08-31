import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ChatComponent } from './chat/chat.component';
import { AdminDashboardComponent } from './auth/admin/admin-dashboard.component';
import { GroupDashboardComponent } from './auth/group/group-dashboard.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'chat', component: ChatComponent },
  { path: 'admin-dashboard', component: AdminDashboardComponent },
  { path: 'group-dashboard', component: GroupDashboardComponent },
  { path: '**', redirectTo: '' }
];
