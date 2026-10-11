import { prisma, io, getReceiverSocketId } from '../index.js';
import cloudinary from '../lib/cloudinary.js';

export const getUnreadCounts = async (req, res) => {
  try {
    const myId = req.user.id;
    
    // Group all unread messages by sender to get a count for each user
    const unreadCounts = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        receiverId: myId,
        isRead: false
      },
      _count: {
        id: true
      }
    });

    // Format the database result into a clean object: { "userId": 3, "otherUserId": 1 }
    const formattedCounts = {};
    unreadCounts.forEach(item => {
      formattedCounts[item.senderId] = item._count.id;
    });

    res.status(200).json(formattedCounts);
  } catch (error) {
    console.error("Error getting unread counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const myId = req.user.id;

    // Change all false isRead statuses to true for this specific chat
    await prisma.message.updateMany({
      where: {
        senderId: senderId,
        receiverId: myId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user.id;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId }
        ]
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user.id;

    let fileUrl = null;

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      fileUrl = uploadResponse.secure_url;
    }

    const newMessage = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        text,
        fileUrl,
      }
    });

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};