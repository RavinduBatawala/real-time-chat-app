import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';

interface AuthState {
  authUser: any;
  users: any[];
  onlineUsers: string[];
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  getUsers: () => Promise<void>;
  setOnlineUsers: (userIds: string[]) => void;
  updateProfile: (data: { username: string }) => Promise<boolean>;
  updateUserLastSeen: (userId: string, lastSeen: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authUser: null,
  users: [],
  onlineUsers: [],
  
  register: async (data) => {
    const res = await axiosInstance.post('/auth/register', data);
    set({ authUser: res.data.user });
    localStorage.setItem('token', res.data.token);
  },

  login: async (data) => {
    const res = await axiosInstance.post('/auth/login', data);
    set({ authUser: res.data.user });
    localStorage.setItem('token', res.data.token);
  },

  logout: () => {
    set({ authUser: null, users: [], onlineUsers: [] });
    localStorage.removeItem('token');
  },

  getUsers: async () => {
    try {
      const res = await axiosInstance.get('/users');
      set({ users: res.data });
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  },

  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put('/users/profile', data);
      set({ authUser: res.data });
      return true;
    } catch (error: any) {
      alert(error.response?.data?.error || "Error updating profile");
      return false;
    }
  },

  updateUserLastSeen: (userId, lastSeen) => {
    set((state) => ({
      users: state.users.map((u) => 
        u.id === userId ? { ...u, lastSeen } : u
      )
    }));
  }
}));