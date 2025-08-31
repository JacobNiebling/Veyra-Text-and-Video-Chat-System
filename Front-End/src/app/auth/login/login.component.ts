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
  loginData = { email: '', password: '' };
  errorMessage = '';

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    this.http.post<any>('http://localhost:3000/api/login', this.loginData).subscribe({
      next: (res) => {
        if (res.valid) {
          // Store all user info in localStorage
          localStorage.setItem('id', JSON.stringify(res.id));
          localStorage.setItem('username', JSON.stringify(res.username));
          localStorage.setItem('email', JSON.stringify(res.email));
          localStorage.setItem('roles', JSON.stringify(res.roles));
          localStorage.setItem('groups', JSON.stringify(res.groups));
          localStorage.setItem('valid', JSON.stringify(res.valid));

          // Redirect based on role
          if (res.roles.includes("super_admin")) {
            this.router.navigate(['/admin-dashboard']);
          } else if (res.roles.includes("group_admin")) {
            this.router.navigate(['/group-dashboard']);
          } else {
            this.router.navigate(['/chat']);
          }
        } else {
          this.errorMessage = res.error || "Login failed";
        }
      },
      error: (err) => {
        this.errorMessage = "Server error";
      }
    });
  }
}
