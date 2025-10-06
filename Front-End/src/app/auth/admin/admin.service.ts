import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  _id?: string;
  username: string;
  email: string;
  roles: string[];
  groups: string[];
}

export interface Group {
  _id?: string;
  name: string;
  members: User[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = 'http://localhost:3000/api'; // your backend URL

  constructor(private http: HttpClient) {}

  // USERS
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  addUser(user: User & { password: string }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  removeUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  updateUserRoles(userId: string, roles: string[]): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${userId}/roles`, { roles });
  }

  // GROUPS
  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/groups`);
  }

  addGroup(group: { name: string; adminId?: string }): Observable<Group> {
    return this.http.post<Group>(`${this.apiUrl}/groups`, group);
  }

  addUserToGroup(groupId: string, userId: string): Observable<Group> {
    return this.http.patch<Group>(`${this.apiUrl}/groups/${groupId}/addUser`, { userId });
  }
}
