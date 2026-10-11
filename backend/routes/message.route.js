import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { getMessages, sendMessage, getUnreadCounts, markMessagesAsRead } from '../controllers/message.controller.js';

const router = express.Router();

// Fetch counts and mark read routes (must be placed before /:id)
router.get('/unread', protectRoute, getUnreadCounts);
router.put('/mark-read/:id', protectRoute, markMessagesAsRead);

// Standard messaging routes
router.get('/:id', protectRoute, getMessages);
router.post('/send/:id', protectRoute, sendMessage);

export default router;