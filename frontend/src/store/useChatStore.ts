import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  messages: any[];
  selectedUser: any | null;
  isMessagesLoading: boolean;
  socket: Socket | null;
  typingUsers: string[];
  unreadCounts: Record<string, number>;
  connectSocket: () => void;
  disconnectSocket: () => void;
  subscribeToMessages: () => void;
  unsubscribeFromMessages: () => void;
  getMessages: (userId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setSelectedUser: (user: any | null) => void;
  startTyping: () => void;
  stopTyping: () => void;
  getUnreadCounts: () => Promise<void>;
  markAsRead: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  selectedUser: null,
  isMessagesLoading: false,
  socket: null,
  typingUsers: [],
  unreadCounts: {},

  setSelectedUser: (user) => set({ selectedUser: user }),

  connectSocket: () => {
    const { authUser } = useAuthStore.getState();
    if (!authUser || get().socket) return; 

    const socket = io('http://localhost:5000', {
      query: { userId: authUser.id }
    });

    socket.connect();
    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      useAuthStore.getState().setOnlineUsers(userIds);
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) socket.disconnect();
    set({ socket: null });
  },

  subscribeToMessages: () => {
    const { socket } = get();
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, unreadCounts } = get();
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser?.id;
      
      if (isMessageSentFromSelectedUser) {
        // If we are actively chatting with them, just add the message and immediately mark it as read in the DB
        set({ messages: [...get().messages, newMessage] });
        axiosInstance.put(`/messages/mark-read/${newMessage.senderId}`);
      } else {
        // If it's from someone else, increment their specific unread badge counter
        const currentCount = unreadCounts[newMessage.senderId] || 0;
        set({ unreadCounts: { ...unreadCounts, [newMessage.senderId]: currentCount + 1 } });
      }
    });

    socket.on("typing", (userId) => {
      if (!get().typingUsers.includes(userId)) {
        set({ typingUsers: [...get().typingUsers, userId] });
      }
    });

    socket.on("stopTyping", (userId) => {
      set({ typingUsers: get().typingUsers.filter((id) => id !== userId) });
    });
  },

  unsubscribeFromMessages: () => {
    const { socket } = get();
    if (socket) {
      socket.off("newMessage");
      socket.off("typing");
      socket.off("stopTyping");
    }
  },

  startTyping: () => {
    const { socket, selectedUser } = get();
    if (socket && selectedUser) socket.emit("typing", { receiverId: selectedUser.id });
  },

  stopTyping: () => {
    const { socket, selectedUser } = get();
    if (socket && selectedUser) socket.emit("stopTyping", { receiverId: selectedUser.id });
  },

  getUnreadCounts: async () => {
    try {
      const res = await axiosInstance.get('/messages/unread');
      set({ unreadCounts: res.data });
    } catch (error) {
      console.error("Error fetching unread counts:", error);
    }
  },

  markAsRead: async (userId) => {
    try {
      await axiosInstance.put(`/messages/mark-read/${userId}`);
      // Remove the badge instantly on the UI
      const updatedCounts = { ...get().unreadCounts };
      delete updatedCounts[userId];
      set({ unreadCounts: updatedCounts });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (text) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) return;

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser.id}`, { text });
      set({ messages: [...messages, res.data] });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
}));