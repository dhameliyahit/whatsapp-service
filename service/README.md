# Verifinder Backend Service

Production-ready TypeScript Express backend service for WhatsApp verification and Google OAuth identity management.

## 📁 Architecture & Folder Structure

```
service/
├── src/
│   ├── config/             # Environment variables and Database setup
│   │   ├── env.ts          # Strongly-typed environment variables
│   │   └── db.ts           # Mongoose MongoDB connection & event handlers
│   ├── controllers/        # Express route controllers
│   │   ├── auth.controller.ts # Google OAuth login, token refresh, logout
│   │   └── user.controller.ts # User profile retrieval and management
│   ├── middlewares/        # Express middlewares
│   │   ├── auth.middleware.ts # JWT authentication & role authorization
│   │   └── errorHandler.middleware.ts # Centralized JSON error handling
│   ├── models/             # Mongoose Schemas & TypeScript interfaces
│   │   └── user.model.ts   # User model (googleId, email, role, tokens, etc.)
│   ├── routes/             # API route definitions
│   │   ├── auth.routes.ts  # /api/auth endpoints
│   │   ├── user.routes.ts  # /api/users endpoints
│   │   └── index.ts        # Central router and /api/health
│   ├── services/           # Business logic layer
│   │   ├── auth.service.ts # Google token verification & session issuance
│   │   └── user.service.ts # User DB queries and profile updates
│   ├── utils/              # Helper utilities
│   │   ├── jwt.util.ts     # JWT generation and verification
│   │   └── response.util.ts# Standardized { success, data, message } responses
│   ├── app.ts              # Express application factory & security middlewares
│   └── server.ts           # Server bootstrap and graceful shutdown
├── dist/                   # Compiled JavaScript production build
├── .env                    # Environment configuration
├── .env.example            # Environment template
├── package.json            # Dependencies and npm scripts
└── tsconfig.json           # TypeScript configuration
```

## 🚀 Available Scripts

- **`npm run dev`**: Starts the development server with live reload using `tsx watch`.
- **`npm run build`**: Compiles TypeScript files into the `dist/` directory.
- **`npm start`**: Runs the compiled production server (`node dist/server.js`).

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Check service status

### Authentication
- `POST /api/auth/google` - Sign in / Register with Google ID Token
  ```json
  { "idToken": "<google_credential>" }
  ```
- `POST /api/auth/refresh` - Refresh access & refresh tokens
- `GET /api/auth/me` - Get current authenticated user (Requires Bearer token)
- `POST /api/auth/logout` - Invalidate session & clear cookies

### Users
- `GET /api/users/profile` - Fetch current user's profile
- `PUT /api/users/profile` - Update user profile information
- `GET /api/users` - List users (Admin only)
