# Veyra Text and Video-Chat System

## Table of Contents
1. [Project Overview](#project-overview)
2. [Git Repository Organization](#git-repository-organization)
3. [Data Structures](#data-structures)
4. [Angular Architecture](#angular-architecture)
5. [Node Server Architecture](#node-server-architecture)
6. [Server Routes](#server-routes)
7. [Client-Server Interaction](#client-server-interaction)
8. [Client-Server Responsibilities](#client-server-responsibilities)
9. [Interaction Between Client and Server](#Interaction-Between-Client-and-Server)

## Project Overview
This project implements a **text and video chat system** with real-time messaging. Users can:
- Communicate in **groups and channels**
- Use text chat and video chat
- Have different **permission levels** (Admin, Moderator, User)
- Git Repo: https://github.com/JacobNiebling/Veyra-Text-and-Video-Chat-System

The frontend is implemented using **Angular** and the backend uses **Node.js with Express**. **Sockets.io** is used for real-time communication

## Git Repository Organization
When organizing my Git repository I decided to keep it under one branch to make it easier for when committing changes. I made sure to every few days update the repository with the latest version to ensure that all progress was saved. During development of this application, I used Git to track every major change in both the client and server code. Which included updates, new routes and any component modifications made. This allowed me to revert back to any previous version if needed be and maintain a history of this projects development.

## Data Structures

**User Interface**
```
interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  roles: string[];
  groups: string[];
  online?: boolean;
}
```
This interface represents an individual user

**Fields**
- id: string - unique user identifier
- username: string - Display name
- email: string - login information
- avatar: string - avatar image for profile
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
```
interface Group {
  _id: string;
  name: string;
  channels: string[];
  users: { _id: string; username: string; email: string; avatar?: string }[];
  admins: string[];
}
```
This represents the collection of users and channels associated with the user

**Fields**
- id: number - Group unique identifier
- name: string - Display name of group
- channels: string[] - Channel name array for group and represents separate chat rooms
- users: string[] - List of users per group
- admins: string[] - List of admins per group

**Usage**
**Server:**
- Manage group membership and channel
- Allows ability to add/remove users from a group
- Use channels to route messages to specific channels via WebSockets.

**Client:**
- Render list of groups the user belongs to
- Show the available channels inside each group
- Navigate channels for message viewing and posting

**UserSchema**
```
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  roles: { type: [String], default: ['chat_user'] },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
});
```
This represents a user and stores their username, email, password, avatar, roles and groups they belong to.

**GroupSchema**
```
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  channels: { type: [String], default: ['General'] },
});
```
This represents a group chat and stores the groups name, the creator, lists of members/admins and the names of the group's channels.

**MessageSchema**
```
const MessageSchema = new mongoose.Schema({
  group: String,
  channel: String,
  sender: String,
  avatar: String,
  text: String,
  image: String,
  timestamp: { type: Date, default: Date.now },
});
```
This represents a message sent within a group's channel, includes the group and channel it belongs to, sender information, avatar/images, message text and a timestamp.

## Angular Architecture
**Components:**
- LoginComponent - Authentication
- RegisterComponent - Account registration
- GroupDashboardComponent - List groups and channels
- AdminDashboardComponent - List users and groups
- ChatComponent - Text chat interface
- VideoChatComponent - Real-time video chat

**Services:**
- AuthService - User authentication
- ChatService - Manages messages and channels
- VideoService - Handles video streaming and signaling 

**Models:**
- User, Group, Channel, Message

**Routes:**
- /login - LoginComponent
- /group-dashboard - GroupDashboardComponent
- /admin-dashboard - AdminDashboardComponent
- /chat - ChatComponent
- /group/:id/channel/:id - ChatComponent
- /group/:id/channel/:id/video - VideoChatComponent

## Node Server Architecture
**Modules:**
- Controllers/
- routes/
- models/
- utils/

**Global Variables**
- app - Express instance
- io - Sockets.io server instance
- PORT - Server port

**Server.js**
- Sets up Express, Sockets.io, connects to MongoDB, defines middleware, starts server 

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

## Client Server Interaction
The client communicates with the server using **HTTP requests** for all actions such as login, viewing groups, and managing roles. The server responds with JSON data, which the Angular components use to update the UI dynamically.

## Login
- When a user enters their email and password in the **LoginComponent**, the client sends a `POST /auth/login` request to the server.  
- If the credentials are valid, the server returns a JWT token and user info.  
- The client stores the token and updates the UI to show the **DashboardComponent**, displaying the user’s groups.

## Viewing Groups
- The **DashboardComponent** requests the user’s groups with `GET /groups`.  
- The server returns a list of groups the user belongs to.  
- The component displays each group in a list. Any changes, like joining or leaving a group, trigger a refresh of this list.

## Creating a Group
- In **DashboardComponent**, when a Group Admin or Super Admin submits a new group name, the client sends `POST /groups` to the server.  
- The server creates the group in the database and returns the group details.  
- The component adds the new group to the displayed list without needing a full page reload.

## Joining or Leaving a Group
- When a user joins a group (`POST /groups/:groupId/join`) or leaves (`POST /groups/:groupId/leave`), the server updates the group membership in the database.  
- The client automatically updates the group list in **DashboardComponent** to reflect the change.

## Managing User Roles
- In the **UserManagementComponent**, when a Super Admin changes a user’s role via `POST /users/:id/role`, the server updates the role in the database.  
- The component then refreshes the displayed list of users and their roles to reflect the update immediately.

In all cases, the client ensures that the **data displayed in the Angular components always reflects the current server state**, providing a responsive and up-to-date user interface.

## client-server-responsibilities
**Server**

**REST API (JSON-based)**
- Has endpoints such as /api/login, /api/group, /api/users/:id, and returns JSON output.

**Authentication and Security**
- Handles user registration, password hashing via bcrypt.

**Database Management**
- Uses MongoDB with Mongoose models (User, Group, Message) to persist users, roles, group membership, channels and chat logs.

**Role Enforcement**
- Processes requests with role logic - chat_user, group_admin, super_admin and restricts access to certain endpoints that certain roles shouldn't have access to.

**Real-Time Communication**
- Uses Sockets.io for broadcasting messages, notify join/leave events and pushes live updates to connected Angular clients.

**Video Streaming**
- PeerJS server is integrated for peer-to-peer video chat.

**File Uploading**
- Uses Multer to handle the uploading of user avatars and images, avatars are served from /assets and images are served from /uploads.

**Client**

**UI Rendering**
- Displays the login screen, dashboards, groups, and chat messages via components such as LoginComponent, GroupDashboardComponent and ChatComponent etc.

**API**
- Uses Angular Services such as AuthService, Chatservice to perform HTTP requests to the server and handle responses.

**Routing and Navigation**
- Navigates via routes e.g. /group/:id/channel/:id without reloading the pages by using Angular Router.

**Local Session Storage**
- Stores authentication tokens and user identity for maintaining the session state.

**Real-Time Events**
Listens to Sockets.IO events and updates the UI live when a new message is sent.

**Video Streaming**
- Establishes a PeerJS connection for video chat session but relies on the server for signalling.

**File Upload**
- Sends avatar/chat image uploads using the /api/upload endpoint then displays them in chat.

**Client-side Filtering and Rendering**
- Handles UI changes without waiting for a full refresh.

**Summary**
- Server looks after the Data Logic, Security, Persistence, Real-Time Events
> REST API, WebSocket, Static Files
- Client looks after the UI, Interaction, Display and Navigation.
> JSON, WebSocket Events, Streams

**Testing**
Below I have listed the steps I took to do the Unit and integration testing:
- To set up the testing I first ran: npm install mocha, npm install chai on my back end, then on the front end I ran npm install Karma and npm install Jasmine then I did npm install cypress for the end-to-end testing.
- I then created a folder under my routes folder called test then created a group.test.js and a users.test.js file.
- Afterwards I ran npm test.
- For the unit testing I ran ng test.
- For the end-to-end testing I ran npm cypress:open then followed by npm run cypress:run.

## Interaction Between Client and Server
**Interaction Between Client and Server**
The server handles all data management related tasks, authentication, file uploads and real-time messaging, while the Client side (Angular) focuses on displaying the dynamic interfaces and sending requests. When a user interacts with any component e.g. DashboardComponent or ChatComponent, the client then sends a HTTP request to the server. Which then updates the MongoDB collections - User, Group, Message, and returns JSON. Sockets.IO broadcasts messages and any membership changes to all connected clients, which then updates their views in real time by using observables and component state changes. Files upload via /api/upload and are saved to the server.

:copyright: Jacob Niebling 2025
