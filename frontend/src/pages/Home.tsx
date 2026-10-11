import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import styles from './Home.module.css';

export default function Home() {
  const { authUser, logout, users, getUsers, onlineUsers, updateProfile } = useAuthStore();
  const { 
    messages, selectedUser, getMessages, sendMessage, setSelectedUser,
    connectSocket, disconnectSocket, subscribeToMessages, unsubscribeFromMessages,
    startTyping, stopTyping, typingUsers, getUnreadCounts, markAsRead, unreadCounts, socket
  } = useChatStore();
  
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  // --- NEW: Image Upload State ---
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getUsers();
    getUnreadCounts();
    connectSocket();
    return () => disconnectSocket();
  }, [getUsers, getUnreadCounts, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (socket) {
      subscribeToMessages();
    }
    return () => unsubscribeFromMessages();
  }, [socket, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser.id);
      markAsRead(selectedUser.id);
    }
  }, [selectedUser?.id, getMessages, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    startTyping();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  // --- NEW: Handle Image Selection ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    
    // Pass both text and the base64 image to the store
    await sendMessage({
      text: text.trim(),
      image: imagePreview
    });
    
    setText(""); 
    removeImage();
    
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleOpenProfile = () => {
    setNewUsername(authUser?.username || "");
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    const success = await updateProfile({ username: newUsername });
    if (success) {
      setIsProfileModalOpen(false);
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const filteredUsers = safeUsers.filter(user => 
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {isProfileModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Edit Profile</h2>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Username</label>
              <input 
                type="text" 
                className={styles.modalInput} 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
              />
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setIsProfileModalOpen(false)}
              >
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleSaveProfile}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Chats</h2>
        </div>

        <div className={styles.searchContainer}>
          <input 
            type="text" 
            placeholder="Search users..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.userList} style={{ padding: 0 }}>
          {filteredUsers.length === 0 ? (
            <p style={{ padding: '24px', color: '#64748b' }}>No users found.</p>
          ) : (
            filteredUsers.map((user) => {
              const isOnline = onlineUsers.includes(user.id);
              const isTyping = typingUsers.includes(user.id);
              const unreadCount = unreadCounts[user.id];
              
              return (
                <div 
                  key={user.id} 
                  className={`${styles.userItem} ${selectedUser?.id === user.id ? styles.activeUser : ''}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className={styles.userAvatar}>
                    {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.username || 'Unknown User'}</span>
                    <span className={`${styles.userStatus} ${isOnline && !isTyping ? styles.onlineText : ''} ${isTyping ? styles.typingText : ''}`}>
                      {isTyping ? 'Typing...' : (isOnline ? 'Online' : 'Offline')}
                    </span>
                  </div>
                  {unreadCount > 0 && selectedUser?.id !== user.id && (
                    <div className={styles.unreadBadge}>{unreadCount}</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className={styles.profileBar}>
          <button className={styles.profileBtn} onClick={handleOpenProfile}>Edit Profile</button>
          <button onClick={logout} className={styles.logoutBtn}>Log Out</button>
        </div>
      </div>

      {!selectedUser ? (
        <div className={styles.noChatSelected}>
          <h2 className={styles.noChatTitle}>Welcome, {authUser?.username || 'User'}!</h2>
          <p>Select a user from the sidebar to start messaging.</p>
        </div>
      ) : (
        <div className={styles.chatArea}>
          <div className={styles.chatHeader}>
            {selectedUser.username || 'Unknown User'}
            {typingUsers.includes(selectedUser.id) && (
              <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px', fontWeight: 'normal' }}>
                is typing...
              </span>
            )}
          </div>
          
          <div className={styles.messageList}>
            {safeMessages.map((message) => {
              const isSentByMe = message.senderId === authUser?.id;
              return (
                <div 
                  key={message.id} 
                  className={`${styles.messageWrapper} ${isSentByMe ? styles.messageSent : styles.messageReceived}`}
                >
                  <div className={styles.messageBubble}>
                    {/* --- NEW: Render Image if it exists --- */}
                    {message.fileUrl && (
                      <img src={message.fileUrl} alt="Attachment" className={styles.messageImage} />
                    )}
                    {message.text && <span>{message.text}</span>}
                  </div>
                  <div className={styles.messageTime}>
                    {message.createdAt 
                      ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* --- NEW: Image Preview Bar --- */}
          {imagePreview && (
            <div className={styles.imagePreviewContainer}>
              <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
              <button type="button" onClick={removeImage} className={styles.removeImageBtn}>✕</button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className={styles.messageInputArea}>
            {/* --- NEW: Hidden file input and attach button --- */}
            <input
              type="file"
              accept="image/*"
              hidden
              ref={fileInputRef}
              onChange={handleImageChange}
            />
            <button 
              type="button" 
              className={styles.attachBtn} 
              onClick={() => fileInputRef.current?.click()}
              title="Attach Image"
            >
              📎
            </button>
            
            <input 
              type="text" 
              placeholder="Type your message..." 
              className={styles.messageInputField}
              value={text}
              onChange={handleTyping}
            />
            <button type="submit" className={styles.sendBtn} disabled={!text.trim() && !imagePreview}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}