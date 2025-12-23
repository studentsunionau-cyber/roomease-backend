# 🏠 RoomEase Backend API

Student accommodation platform API server built with Express.js and Node.js.

## 🚀 Quick Start

### Local Development
```bash
npm install
npm start
```

Server runs on: `http://localhost:3000`

## 📊 API Endpoints

### Public Endpoints

- `GET /health` - Health check
- `GET /` - API information
- `GET /api/stats` - Platform statistics
- `GET /api/properties` - List all properties
- `GET /api/properties/:id` - Get single property
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Protected Endpoints

- `POST /api/bookings` - Create booking (requires JWT)

## 🔐 Authentication

Uses JWT (JSON Web Tokens) for authentication.

### Register
```bash
POST /api/auth/register
{
  "email": "student@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "role": "student"
}
```

### Login
```bash
POST /api/auth/login
{
  "email": "student@example.com",
  "password": "securepassword"
}
```

## 🚀 Deployment

Deployed on Heroku: https://roomease-api.herokuapp.com

## 📦 Dependencies

- express - Web framework
- cors - CORS middleware
- jsonwebtoken - JWT authentication
- bcryptjs - Password hashing
- dotenv - Environment variables

## 🧪 Testing
```bash
curl https://roomease-api.herokuapp.com/health
curl https://roomease-api.herokuapp.com/api/properties
curl https://roomease-api.herokuapp.com/api/stats
```

## 📝 License

MIT
