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

  // Media Attachment State
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'document' | 'audio' | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NEW: Voice Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    if (file.type.startsWith('video/')) {
      setFileType('video');
    } else if (file.type.startsWith('image/')) {
      setFileType('image');
    } else {
      setFileType('document');
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setIsAttachMenuOpen(false);
  };

  const removeFile = () => {
    setFilePreview(null);
    setFileType(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !filePreview) return;
    
    await sendMessage({
      text: text.trim(),
      fileData: filePreview,
      fileType: fileType
    });
    
    setText(""); 
    removeFile();
    
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // --- NEW: Audio Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          // Send the voice message immediately upon stopping
          sendMessage({ text: "", fileData: base64Audio, fileType: "audio" });
        };
        // Stop the microphone tracks to free up the hardware
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access your microphone. Please check your browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleOpenProfile = () => {
    setNewUsername(authUser?.username || "");
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    const success = await updateProfile({ username: newUsername });
    if (success) setIsProfileModalOpen(false);
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const isToday = date.toDateString() === new Date().toDateString();
    
    if (isToday) return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `Last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const filteredUsers = safeUsers.filter(user => 
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUser = selectedUser 
    ? (safeUsers.find(u => u.id === selectedUser.id) || selectedUser) 
    : null;

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
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsProfileModalOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSaveProfile}>Save Changes</button>
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

      {!activeUser ? (
        <div className={styles.noChatSelected}>
          <h2 className={styles.noChatTitle}>Welcome, {authUser?.username || 'User'}!</h2>
          <p>Select a user from the sidebar to start messaging.</p>
        </div>
      ) : (
        <div className={styles.chatArea}>
          
          <div className={styles.chatHeader}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
                  {activeUser.username || 'Unknown User'}
                </span>
                {typingUsers.includes(activeUser.id) && (
                  <span style={{ fontSize: '13px', color: '#2563eb', fontStyle: 'italic', marginLeft: '12px', fontWeight: '500' }}>
                    is typing...
                  </span>
                )}
              </div>
              
              {!typingUsers.includes(activeUser.id) && (
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '400', marginTop: '4px' }}>
                  {onlineUsers.includes(activeUser.id) 
                    ? <span style={{ color: '#10b981', fontWeight: '500' }}>Online</span> 
                    : formatLastSeen(activeUser.lastSeen)}
                </span>
              )}
            </div>
          </div>
          
          <div className={styles.messageList}>
            {safeMessages.map((message) => {
              const isSentByMe = message.senderId === authUser?.id;
              const renderType = message.fileType || (message.fileUrl ? 'image' : null);
              
              return (
                <div 
                  key={message.id} 
                  className={`${styles.messageWrapper} ${isSentByMe ? styles.messageSent : styles.messageReceived}`}
                >
                  <div className={styles.messageBubble}>
                    {renderType === 'image' && <img src={message.fileUrl} alt="Attachment" className={styles.messageImage} />}
                    {renderType === 'video' && <video src={message.fileUrl} controls className={styles.messageVideo} />}
                    {/* --- NEW: Render Audio Player --- */}
                    {renderType === 'audio' && <audio src={message.fileUrl} controls className={styles.messageAudio} />}
                    {renderType === 'document' && (
                      <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.messageDocument}>
                        📄 Document File
                      </a>
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

          {filePreview && (
            <div className={styles.filePreviewContainer}>
              {fileType === 'image' && <img src={filePreview} alt="Preview" className={styles.imagePreview} />}
              {fileType === 'video' && <video src={filePreview} className={styles.imagePreview} />}
              {fileType === 'document' && <div className={styles.filePreviewText}>📄 {fileName}</div>}
              <button type="button" onClick={removeFile} className={styles.removeImageBtn}>✕</button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className={styles.messageInputArea}>
            <input
              type="file"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <div className={styles.attachWrapper}>
              {isAttachMenuOpen && (
                <div className={styles.attachmentMenu}>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('image/*')}>📷 Photo</button>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('video/*')}>🎥 Video</button>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('.pdf,.doc,.docx,.txt,.csv')}>📄 Document</button>
                </div>
              )}
              <button 
                type="button" 
                className={styles.attachBtn} 
                onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                title="Attach File"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
            </div>

            {/* --- NEW: Microphone Button & Recording Indicator --- */}
            {isRecording ? (
              <div className={styles.recordingIndicator}>
                <span className={styles.pulseDot}>🔴</span> Recording... Click to Stop
              </div>
            ) : (
              <input 
                type="text" 
                placeholder="Type your message..." 
                className={styles.messageInputField}
                value={text}
                onChange={handleTyping}
              />
            )}

            <button 
              type="button" 
              className={`${styles.micBtn} ${isRecording ? styles.recordingBtn : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? "Stop Recording" : "Send Voice Message"}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
            
            <button type="submit" className={styles.sendBtn} disabled={(!text.trim() && !filePreview) || isRecording}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}