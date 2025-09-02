# 3813ICT_VideoChatSystem

## Table of Contents
1. [Project Overview](#project-overview)
2. [Git Repository Organization](#git-repository-organization)
3. [Data Structures](#data-structures)
4. [Angular Architecture](#angular-architecture)
5. [Node Server Architecture](#node-server-architecture)
6. [Server Routes](#server-routes)
7. [Client-Server Interaction](#client-server-interaction)

## Project Overview
This project implements a **text and video chat system** with real-time messaging. Users can:
- Communicate in **groups and channels**
- Use text chat and video chat
- Have different **permission levels** (Admin, Moderator, User)

The frontend is implemented using **Angular** and the backend uses **Node.js with Express**. **Socket.io** is used for real-time communication

## Git Repository Organization
When organizing my Git repository I decided to keep it under one branch to make it easier for when committing changes. I made sure to every few days update the repository with the latest version

## Data Structures

**User Interface**
interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  groups: string[];
  online?: boolean;
}

This interface represents an individual user

**Fields**
- id: string - unique user identifier
- username: string - Display name
- email: string - login information
- roles: string[] - User permissions
- groups: string[] - List of group IDs the member is a part of
- Online?: boolean - To track of the user is online or offline

**Usage**
**Server:**
- Stores users in the database with their roles and groups
- Uses roles for enforcing user permissions for the API
- Tracks online state via WebSocket connection for real-time update

**Client:**
- Display user lists in channels and groups
- Display online/offline status
- Show role badge/display admins/mods

**Group Interface**
interface Group {
  id: number;
  name: string;
  channels: string[];
}

This represents the collection of users and channels associated with the user

**Fields**
- id: number - Group unique identifier
- name: string - Display name of group
- channels: string[] - Channel name array for group and represents separate chat rooms

**Usage**
**Server:**
- Manage group membership and channel
- Allows ability to add/remove users from a group
- Use channels to route messages to specific channels via WebSockets.

**Client:**
- Render list of groups the user belongs to
- Show the available channels inside each group
- Navigate channels for message viewing and posting

## Angular Architecture
**Components:**
- LoginComponent - Authentication
- DashboardComponent - List groups and channels
- ChatComponent - Text chat interface
- VideoChatComponent - Real-time video chat (not added till Phase 2)

**Services:**
- AuthService - User authentication
- ChatService - Manages messages and channels
- VideoService - Handles video streaming and signaling (Not added till Phase 2)

**Models:**
- User, Group, Channel, Message

**Routes:**
- /login - LoginComponent
- /dashboard - DashboardComponent
- /group/:id/channel/:id - ChatComponent
- /group/:id/channel/:id/video - VideoChatComponent (Not added till Phase 2)

## Node Server Architecture
**Modules:**
- Controllers/
- routes/
- models/
- utils/

**Global Variables**
- app - Express instance
- io - Socket.io server instance
- PORT - Server port

**Server.js**
- Sets up Express, SOckets.io, connects to MongoDB, defines middleware, starts server (MongoDB, not added till Phase 2)

## Server-Side Routes

The server handles **user login**, **group management**, and **roles**. There are three roles: **Chat User**, **Group Admin**, and **Super Admin**.

## Authentication
**POST `/auth/login`**  
- Input: `email` and `password`  
- Output: `token` and `user` info  
- Purpose: Log in as user and get a session token  

## User Management
**GET `/users/:id`**  
- Input: `user ID`  
- Output: `user` info  
- Accessible by: Super Admin  
- Purpose: Get details of a user  

**POST `/users/:id/role`**  
- Input: new `role`  
- Output: success message and updated `user`  
- Accessible by: Super Admin  
- Purpose: Change a user’s role  

## Group Management
**GET `/groups`**  
- Output: list of groups the user belongs to  
- Purpose: See all your groups  

**POST `/groups`**  
- Input: `group name`  
- Output: created group info  
- Accessible by: Group Admin, Super Admin  
- Purpose: Create a new group  

**GET `/groups/:groupId`**  
- Input: `group ID`  
- Output: group details  
- Accessible by: Group Admin, Super Admin  

**POST `/groups/:groupId/join`**  
- Input: `group ID`  
- Output: success message  
- Purpose: Add a user to a group  

**POST `/groups/:groupId/leave`**  
- Input: `group ID`  
- Output: success message  
- Purpose: Leave a group  

**DELETE `/groups/:groupId`**  
- Input: `group ID`  
- Output: success message  
- Accessible by: Group Admin, Super Admin  
- Purpose: Delete a group  

### Roles
**Chat User:** 
- Can see and leave groups

**Group Admin:** 
- Can manage groups and users within their groups

**Super Admin:** 
- Full control over all users and groups  
