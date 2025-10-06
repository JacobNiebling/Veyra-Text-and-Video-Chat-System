import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

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
  successMessage = '';

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = "Passwords do not match";
      return;
    }

    this.http.post<any>('http://localhost:3000/api/register', this.registerData).subscribe({
      next: (res) => {
        if (res.success) {
          this.successMessage = "Registration successful! Redirecting to login...";
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else {
          this.errorMessage = res.error || "Registration failed";
        }
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.error || "Server error during registration";
      }
    });
  }
}
