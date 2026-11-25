# 💬 Real-Time Chat App

A full-stack real-time chat application with one-to-one messaging, group chats, file sharing, and peer-to-peer video calls. Built with **React + TypeScript** on the frontend and **Node.js + Express + Socket.IO + PostgreSQL (Prisma)** on the backend.

---

## ✨ Features

- 🔐 **Authentication**: register and log in with JWT (7-day tokens) and bcrypt-hashed passwords
- ⚡ **Real-time messaging**: instant 1-to-1 messages over Socket.IO
- 👥 **Group chats**: create groups, add members, and chat in Socket.IO rooms
- 📎 **File sharing**: send images, videos, and documents (uploaded to Cloudinary)
- 📹 **Video calls**: peer-to-peer WebRTC calls using `simple-peer`, with Socket.IO for signaling
- 🟢 **Online status & last seen**: live online indicator and "Last seen today at…" timestamps
- ✍️ **Typing indicators**: see when the other person is typing
- 🔔 **Unread message counts**: per-chat unread badges that clear when a chat is opened
- 🔍 **Search**: filter users and groups from the sidebar
- 👤 **Edit profile**: change your username (checked so it stays unique)
- 🖼️ **Custom chat wallpaper**: set your own background image

---

## 🛠️ Tech Stack

| Layer      | Technologies |
|------------|--------------|
| Frontend   | React 19, TypeScript, Vite, Zustand, React Router, Axios, Socket.IO Client, simple-peer, Lucide icons, CSS Modules |
| Backend    | Node.js, Express, Socket.IO, Prisma ORM, JWT, bcryptjs |
| Database   | PostgreSQL |
| Media      | Cloudinary |

---

## 📁 Project Structure

```
real-time-chat-app/
├── backend/
│   ├── controllers/        # auth, user, message, group logic
│   ├── routes/             # Express route definitions
│   ├── middleware/         # JWT auth middleware (protectRoute)
│   ├── lib/cloudinary.js   # Cloudinary config
│   ├── prisma/schema.prisma
│   └── index.js            # Express + Socket.IO server entry point
└── frontend/
    └── src/
        ├── pages/          # Login, SignUp, Home (chat UI)
        ├── store/          # Zustand stores (useAuthStore, useChatStore)
        ├── lib/axios.ts    # Axios instance with JWT interceptor
        └── App.tsx         # Routes
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [PostgreSQL](https://www.postgresql.org/) database (local, or hosted such as Supabase or Neon)
- A free [Cloudinary](https://cloudinary.com/) account for file uploads

### 1. Clone the repository

```bash
git clone https://github.com/RavinduBatawala/real-time-chat-app.git
cd real-time-chat-app
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/chatapp"
JWT_SECRET="your_jwt_secret"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
PORT=5000
```

Create the database tables and generate the Prisma client:

```bash
npx prisma migrate dev --name init
# or, without migration files:
# npx prisma db push
```

Start the server:

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

### 3. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

> 💡 To try messaging and video calls, open the app in two different browsers (or one normal window and one incognito window) and log in as two different users.

---

## 📡 API Endpoints

All routes except `/api/auth/*` need an `Authorization: Bearer <token>` header.

### Auth
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| POST   | `/api/auth/register` | Create an account (`username`, `email`, `password`) |
| POST   | `/api/auth/login`    | Log in (`username`, `password`) |

### Users
| Method | Endpoint             | Description |
|--------|----------------------|-------------|
| GET    | `/api/users`         | Get all other users |
| PUT    | `/api/users/profile` | Update your username |

### Messages
| Method | Endpoint                       | Description |
|--------|--------------------------------|-------------|
| GET    | `/api/messages/:id`            | Get the conversation with a user |
| POST   | `/api/messages/send/:id`       | Send a message (`text`, `fileData`, `fileType`) |
| GET    | `/api/messages/unread`         | Get unread counts per sender |
| PUT    | `/api/messages/mark-read/:id`  | Mark a user's messages as read |
| GET    | `/api/messages/group/:groupId` | Get group messages |
| POST   | `/api/messages/group/:groupId` | Send a group message |

### Groups
| Method | Endpoint                         | Description |
|--------|----------------------------------|-------------|
| POST   | `/api/groups`                    | Create a group (`name`, `memberIds`) |
| GET    | `/api/groups`                    | Get your groups |
| PUT    | `/api/groups/:groupId/members`   | Add members (`memberIds`) |

---

## 🔌 Socket.IO Events

| Event              | Direction        | Purpose |
|--------------------|------------------|---------|
| `getOnlineUsers`   | server → client  | List of online user IDs |
| `userOffline`      | server → client  | A user went offline, with their `lastSeen` time |
| `newMessage`       | server → client  | New 1-to-1 message |
| `newGroupMessage`  | server → client  | New group message |
| `typing` / `stopTyping` | both        | Typing indicator |
| `joinGroupRoom`    | client → server  | Join a group's room |
| `callUser`         | client → server  | Start a video call (WebRTC offer) |
| `incomingCall`     | server → client  | Notify the person being called |
| `answerCall` / `callAccepted` | both  | WebRTC answer signaling |
| `endCall` / `callEnded` | both        | Hang up |

---

## 🗄️ Database Schema

- **User**: `id`, `username`, `email`, `password`, `avatarUrl`, `lastSeen`, `createdAt`
- **Group**: `id`, `name`, `createdAt`, many-to-many `members`
- **Message**: `id`, `text`, `fileUrl`, `fileType` (`image` / `video` / `document`), `senderId`, `receiverId` (1-to-1) **or** `groupId` (group), `isRead`, `createdAt`

---

## 🔮 Future Improvements

- Move hard-coded URLs (`http://localhost:5000`, `http://localhost:5173`) into environment variables for deployment
- Profile picture uploads
- Read receipts and unread counts for group chats
- Group video calls
- Message editing and deletion

---

## 👨‍💻 Author

**Ravindu Batawala**
- GitHub: [@RavinduBatawala](https://github.com/RavinduBatawala)
- Email: ravindubatawala@gmail.com

---

⭐ If you like this project, give it a star!
