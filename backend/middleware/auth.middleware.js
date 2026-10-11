import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';

export const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized - No Token Provided" });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user but exclude the hashed password from the result
    const user = await prisma.user.findUnique({ 
      where: { id: decoded.id },
      select: { id: true, username: true, email: true }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    req.user = user;
    next(); // Pass control to the next function (the controller)
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};