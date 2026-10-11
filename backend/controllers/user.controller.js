import { prisma } from '../index.js';

export const getUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const filteredUsers = await prisma.user.findMany({
      where: { id: { not: loggedInUserId } },
      select: { id: true, username: true, avatarUrl: true, lastSeen: true }
    });
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsers: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username || username.trim() === "") {
      return res.status(400).json({ error: "Username is required" });
    }

    // Check if the new username is already taken by someone else
    const existingUser = await prisma.user.findFirst({
      where: { 
        username: username.trim(), 
        id: { not: userId } 
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username: username.trim() },
      select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true } 
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};