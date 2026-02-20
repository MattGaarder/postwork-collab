# Postwork Collab

A collaborative code review platform designed for university students to share projects, submit code, and receive real-time feedback from peers.

## 🚀 Project Overview

This project is a web-based platform built as a monorepo. It facilitates:
- **User Authentication**: Secure registration and login.
- **Project Management**: Users can create and manage coding projects.
- **Code Submission**: Support for multiple languages (JS, Python, Java) via Monaco Editor.
- **Collaborative Review**: Line-by-line commenting system.
- **Real-time Collaboration**: Infrastructure for real-time editing using Yjs (in progress).

### 🚧 Current Status
- **Implemented**: User Auth, Project CRUD, Version Control (basic), Commenting System.
- **Pending**: Gamification (Points, Badges, Leaderboards), Automated Testing.
- **Known Issues**: The `y-server` script path in `apps/api/package.json` may need adjustment (`src/scripts/` vs `scripts/`).

---

## 🛠 Tech Stack

The project is structured as a **Monorepo** using `npm workspaces`.

### **Frontend (`apps/web`)**
- **Framework**: [Vue 3](https://vuejs.org/)
- **UI Library**: [Quasar Framework](https://quasar.dev/) (Material Design)
- **Code Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) (VS Code core)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Collaboration**: `yjs`, `y-websocket` (Client)

### **Backend (`apps/api`)**
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Real-time**: `yjs`, `y-websocket` (Server), `ws`
- **Authentication**: JWT (JSON Web Tokens) + bcrypt

---

## 📂 Project Structure

```bash
.
├── apps
│   ├── api          # Backend Express Server & Prisma ORM
│   │   ├── prisma   # Database Schema & Seeds
│   │   └── src      # Source code Routes, Services, Server
│   └── web          # Frontend Vue/Quasar Application
│       └── src      # Components, Pages, Stores
├── docker           # Docker Compose configuration for DB
└── package.json     # Root configuration & workspace scripts
```

---

## 💾 Data Model

The database schema (`apps/api/prisma/schema.prisma`) defines:
- **User**: Stores credentials and profile info.
- **Project**: Represents a coding project, owned by a User.
- **Version**: Snapshots of code submissions for a project.
- **Comment**: Threaded feedback linked to specific lines in a Version.
- **ProjectMember**: Manages access and roles (Owner, Reviewer).

---

## ⚡️ Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Docker Desktop** (Must be running for the database)

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Database**
   Make sure Docker Desktop is running, then run:
   ```bash
   npm run db:up
   ```
   *Note: If this fails, ensure your Docker daemon is active.*

3. **Setup Database Schema**
   Apply migrations and seed initial data:
   ```bash
   npm run prisma:migrate
   npm run seed
   ```

4. **Start Development Servers**
   You can run the full stack (API + Web) or individual parts.
   
   **Run API:**
   ```bash
   npm run api
   ```
   
   **Run Frontend:**
   ```bash
   npm run web
   ```

   The web app will typically run at `http://localhost:9000` and the API at `http://localhost:3000`.

---

## 🧪 Testing

*Currently, no automated tests are implemented.*
- **Frontend**: Setup with Vitest/Jest is pending.
- **Backend**: No `.test.ts` files present in `apps/api`.

## 🏆 Gamification

*Feature Pending Implementation*
- The requirements for Points, Badges, and Leaderboards are not yet reflected in the database schema or API routes.
