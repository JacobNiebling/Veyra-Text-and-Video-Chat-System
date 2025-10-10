import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClientModule, HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {

  // Object bound to the form inputs via ngModel
  loginData = { email: '', password: '' };

  // Error messages display in template
  errorMessage = '';

  // Base URL for backend API
  private readonly API_BASE_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private router: Router) {}

  // Called when form in submitted
  onSubmit() {
    //login POST request is sent to backen
    this.http.post<any>(`${this.API_BASE_URL}/login`, this.loginData).subscribe({
      next: (res) => {
        console.log('Login response:', res);

        // Check if valid login
        if (res.valid) {
          // Save user info in localStorage
          localStorage.setItem('userId', res.id);
          localStorage.setItem('username', res.username);
          localStorage.setItem('email', res.email);
          localStorage.setItem('roles', JSON.stringify(res.roles));

          // Redirect based on role
          if (res.roles.includes("super_admin")) {
            this.router.navigate(['/admin-dashboard']);
          } else if (res.roles.includes("group_admin")) {
            this.router.navigate(['/group-dashboard']);
          } else if (res.roles.includes("chat_user")) {
            this.router.navigate(['/chat']);
          }
        } else {
          this.errorMessage = res.error || "Login failed";
        }
      },
      error: (err) => {
        console.error('Login HTTP error:', err);
        this.errorMessage = "Server error";
      }
    });
  }
}
