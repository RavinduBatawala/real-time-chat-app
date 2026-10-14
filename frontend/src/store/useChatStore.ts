import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  messages: any[];
  selectedUser: any | null;
  groups: any[];
  selectedGroup: any | null;
  selectedChatType: "user" | "group";
  isMessagesLoading: boolean;
  socket: Socket | null;
  typingUsers: string[];
  unreadCounts: Record<string, number>;
  connectSocket: () => void;
  disconnectSocket: () => void;
  subscribeToMessages: () => void;
  unsubscribeFromMessages: () => void;
  getMessages: (id: string) => Promise<void>;
  sendMessage: (messageData: { text?: string; fileData?: string | null; fileType?: string | null }) => Promise<void>;
  setSelectedUser: (user: any | null) => void;
  setSelectedGroup: (group: any | null) => void;
  getGroups: () => Promise<void>;
  createGroup: (name: string, memberIds: string[]) => Promise<boolean>;
  addMembersToGroup: (groupId: string, memberIds: string[]) => Promise<boolean>;
  startTyping: () => void;
  stopTyping: () => void;
  getUnreadCounts: () => Promise<void>;
  markAsRead: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  selectedUser: null,
  groups: [],
  selectedGroup: null,
  selectedChatType: "user",
  isMessagesLoading: false,
  socket: null,
  typingUsers: [],
  unreadCounts: {},

  setSelectedUser: (user) => set({ selectedUser: user, selectedGroup: null, selectedChatType: "user" }),
  
  setSelectedGroup: (group) => set({ selectedGroup: group, selectedUser: null, selectedChatType: "group" }),

  getGroups: async () => {
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  },

  createGroup: async (name: string, memberIds: string[]) => {
    try {
      const res = await axiosInstance.post("/groups", { name, memberIds });
      set((state) => ({ groups: [...state.groups, res.data] }));
      return true;
    } catch (error) {
      console.error("Error creating group:", error);
      return false;
    }
  },

  addMembersToGroup: async (groupId: string, memberIds: string[]) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}/members`, { memberIds });
      set((state) => ({ 
        groups: state.groups.map(g => g.id === groupId ? res.data : g),
        selectedGroup: state.selectedGroup?.id === groupId ? res.data : state.selectedGroup
      }));
      return true;
    } catch (error) {
      console.error("Error adding members:", error);
      return false;
    }
  },

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

    socket.on("userOffline", ({ userId, lastSeen }) => {
      useAuthStore.getState().updateUserLastSeen(userId, lastSeen);
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
      const { selectedUser, selectedChatType, unreadCounts } = get();
      const isMessageSentFromSelectedUser = selectedChatType === "user" && newMessage.senderId === selectedUser?.id;
      
      if (isMessageSentFromSelectedUser) {
        set({ messages: [...get().messages, newMessage] });
        axiosInstance.put(`/messages/mark-read/${newMessage.senderId}`);
      } else {
        const currentCount = unreadCounts[newMessage.senderId] || 0;
        set({ unreadCounts: { ...unreadCounts, [newMessage.senderId]: currentCount + 1 } });
      }
    });

    socket.on("newGroupMessage", (newMessage) => {
      const { selectedGroup, selectedChatType } = get();
      if (selectedChatType === "group" && newMessage.groupId === selectedGroup?.id) {
        set((state) => ({ messages: [...state.messages, newMessage] }));
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
      socket.off("newGroupMessage");
      socket.off("typing");
      socket.off("stopTyping");
    }
  },

  startTyping: () => {
    const { socket, selectedUser, selectedChatType } = get();
    if (socket && selectedUser && selectedChatType === "user") {
      socket.emit("typing", { receiverId: selectedUser.id });
    }
  },

  stopTyping: () => {
    const { socket, selectedUser, selectedChatType } = get();
    if (socket && selectedUser && selectedChatType === "user") {
      socket.emit("stopTyping", { receiverId: selectedUser.id });
    }
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
      const updatedCounts = { ...get().unreadCounts };
      delete updatedCounts[userId];
      set({ unreadCounts: updatedCounts });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  },

  getMessages: async (id) => {
    set({ isMessagesLoading: true });
    try {
      const { selectedChatType } = get();
      const endpoint = selectedChatType === "group" ? `/messages/group/${id}` : `/messages/${id}`;
      const res = await axiosInstance.get(endpoint);
      set({ messages: res.data });
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChatType, selectedUser, selectedGroup, messages } = get();
    const id = selectedChatType === "group" ? selectedGroup?.id : selectedUser?.id;
    if (!id) return;

    try {
      const endpoint = selectedChatType === "group" ? `/messages/group/${id}` : `/messages/send/${id}`;
      const res = await axiosInstance.post(endpoint, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
}));