// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Defines shape of User object used in application
export interface User {
  username: string;
  email: string;
  roles: string[];
  groups: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:3000/api/users';

  constructor(private http: HttpClient) {}

  // Add new user and send POST request to backend then return Observable that resolves with server response
  addUser(user: User): Observable<any> {
    return this.http.post(`${this.apiUrl}/add`, user);
  }
}
