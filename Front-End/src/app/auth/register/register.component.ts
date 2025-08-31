import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerData = { username: '', email: '', password: '', confirmPassword: '' };
  errorMessage = '';

  constructor(private http: HttpClient) {}

  onSubmit() {
    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = "Passwords do not match";
      return;
    }

    this.http.post<any>('/api/register', this.registerData).subscribe({
      next: (res) => {
        console.log("Registered:", res);
        // you might redirect to login or auto-login
      },
      error: (err) => {
        this.errorMessage = err.error?.error || "Registration failed";
      }
    });
  }
}
