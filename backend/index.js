import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.route.js';

// Load environment variables (.env)
dotenv.config();

const app = express();
const server = http.createServer(app);

// Setup Socket.io and allow requests from your Vite frontend
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

export const prisma = new PrismaClient();

// Middleware to parse JSON and enable CORS
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Basic test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', database: 'Connected' });
});

// Listen for real-time Socket.io connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});