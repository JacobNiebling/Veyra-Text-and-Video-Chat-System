import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDashboardComponent } from './admin-dashboard.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    AdminDashboardComponent
  ],
  exports: [
    AdminDashboardComponent
  ]
})
export class AdminModule {}
