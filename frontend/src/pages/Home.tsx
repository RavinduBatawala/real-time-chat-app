import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import Peer from 'simple-peer'; // --- NEW: Import WebRTC Library ---
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

  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'document' | 'audio' | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [wallpaper, setWallpaper] = useState<string | null>(localStorage.getItem('chat_wallpaper'));
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- NEW: WebRTC Call State ---
  const [callState, setCallState] = useState<'idle' | 'calling' | 'active'>('idle');
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerSignal, setCallerSignal] = useState<any>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const myVideo = useRef<HTMLVideoElement>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    getUsers();
    getUnreadCounts();
    connectSocket();
    return () => disconnectSocket();
  }, [getUsers, getUnreadCounts, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (socket) {
      subscribeToMessages();
      
      // --- NEW: WebRTC Socket Listeners ---
      socket.on("incomingCall", (data) => {
        setReceivingCall(true);
        setCaller(data.from);
        setCallerName(data.callerName);
        setCallerSignal(data.signal);
      });

      socket.on("callEnded", () => {
        leaveCall(false); // Clean up without emitting endCall again
      });
    }
    return () => {
      unsubscribeFromMessages();
      if (socket) {
        socket.off("incomingCall");
        socket.off("callEnded");
      }
    };
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
    typingTimeoutRef.current = setTimeout(() => stopTyping(), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    if (file.type.startsWith('video/')) setFileType('video');
    else if (file.type.startsWith('image/')) setFileType('image');
    else setFileType('document');

    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result as string);
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
    
    await sendMessage({ text: text.trim(), fileData: filePreview, fileType: fileType });
    setText(""); 
    removeFile();
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const startRecording = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(currentStream);
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
          sendMessage({ text: "", fileData: reader.result as string, fileType: "audio" });
        };
        currentStream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access your microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setWallpaper(result);
      localStorage.setItem('chat_wallpaper', result);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenProfile = () => {
    setNewUsername(authUser?.username || "");
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    const success = await updateProfile({ username: newUsername });
    if (success) setIsProfileModalOpen(false);
  };

  // --- NEW: WebRTC Engine Methods ---
  const callUser = async (userToCallId: string, type: 'video' | 'audio') => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      setStream(currentStream);
      setCallState('calling');

      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

      peer.on("signal", (data) => {
        socket?.emit("callUser", {
          userToCall: userToCallId,
          signalData: data,
          from: authUser.id,
          callerName: authUser.username
        });
      });

      peer.on("stream", (remoteStream) => {
        if (userVideo.current) userVideo.current.srcObject = remoteStream;
      });

      socket?.once("callAccepted", (signal) => {
        setCallState('active');
        peer.signal(signal);
      });

      connectionRef.current = peer;
    } catch (error) {
      console.error("Failed to start call", error);
      alert("Could not access camera/microphone.");
      setCallState('idle');
    }
  };

  const answerCall = async () => {
    setReceivingCall(false);
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      setCallState('active');

      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });

      peer.on("signal", (data) => {
        socket?.emit("answerCall", { signal: data, to: caller });
      });

      peer.on("stream", (remoteStream) => {
        if (userVideo.current) userVideo.current.srcObject = remoteStream;
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    } catch (error) {
      console.error("Failed to answer call", error);
    }
  };

  const leaveCall = (emitEndEvent = true) => {
    if (emitEndEvent && socket) {
      const toId = caller || (activeUser ? activeUser.id : null);
      if (toId) socket.emit("endCall", { to: toId });
    }
    
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (connectionRef.current) connectionRef.current.destroy();
    
    setCallState('idle');
    setReceivingCall(false);
    setStream(null);
    setCaller("");
    setCallerName("");
    setCallerSignal(null);
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    if (date.toDateString() === new Date().toDateString()) {
      return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Last seen ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const filteredUsers = safeUsers.filter(user => user.username?.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeUser = selectedUser ? (safeUsers.find(u => u.id === selectedUser.id) || selectedUser) : null;

  return (
    <div className={styles.container}>
      
      {/* --- NEW: Incoming Call Modal --- */}
      {receivingCall && !['active', 'calling'].includes(callState) && (
        <div className={styles.incomingCallModal}>
          <div className={styles.incomingCallText}>{callerName} is calling you...</div>
          <div className={styles.incomingCallButtons}>
            <button className={styles.acceptBtn} onClick={answerCall}>Accept</button>
            <button className={styles.rejectBtn} onClick={() => leaveCall(true)}>Decline</button>
          </div>
        </div>
      )}

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
                  <div className={styles.userAvatar}>{user.username ? user.username.charAt(0).toUpperCase() : '?'}</div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.username || 'Unknown User'}</span>
                    <span className={`${styles.userStatus} ${isOnline && !isTyping ? styles.onlineText : ''} ${isTyping ? styles.typingText : ''}`}>
                      {isTyping ? 'Typing...' : (isOnline ? 'Online' : 'Offline')}
                    </span>
                  </div>
                  {unreadCount > 0 && selectedUser?.id !== user.id && <div className={styles.unreadBadge}>{unreadCount}</div>}
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
          
          {/* --- NEW: Active Call Overlay Screen --- */}
          {callState !== 'idle' && (
            <div className={styles.callOverlay}>
              <h2 style={{ marginBottom: '20px' }}>
                {callState === 'calling' ? `Calling ${activeUser.username}...` : `Call with ${callerName || activeUser.username}`}
              </h2>
              
              <div className={styles.videoContainer}>
                {callState === 'active' && <video playsInline ref={userVideo} autoPlay className={styles.mainVideo} />}
                {stream && <video playsInline muted ref={myVideo} autoPlay className={callState === 'active' ? styles.myVideoSmall : styles.mainVideo} />}
              </div>

              <div className={styles.callControls}>
                <button className={styles.endCallBtn} onClick={() => leaveCall(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                    <line x1="23" y1="1" x2="1" y2="23"></line>
                  </svg>
                  End Call
                </button>
              </div>
            </div>
          )}

          <div className={styles.chatHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
                  {activeUser.username || 'Unknown User'}
                </span>
                {typingUsers.includes(activeUser.id) && (
                  <span style={{ fontSize: '13px', color: '#2563eb', fontStyle: 'italic', marginLeft: '12px', fontWeight: '500' }}>is typing...</span>
                )}
              </div>
              
              {!typingUsers.includes(activeUser.id) && (
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '400', marginTop: '4px' }}>
                  {onlineUsers.includes(activeUser.id) ? <span style={{ color: '#10b981', fontWeight: '500' }}>Online</span> : formatLastSeen(activeUser.lastSeen)}
                </span>
              )}
            </div>

            <div className={styles.headerActions}>
              <input type="file" accept="image/*" style={{ display: 'none' }} ref={wallpaperInputRef} onChange={handleWallpaperChange} />
              
              <button className={styles.headerIconBtn} onClick={() => callUser(activeUser.id, 'audio')} title="Voice Call">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </button>

              <button className={styles.headerIconBtn} onClick={() => callUser(activeUser.id, 'video')} title="Video Call">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </button>

              <button className={styles.headerIconBtn} onClick={() => wallpaperInputRef.current?.click()} title="Change Wallpaper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
            </div>
          </div>
          
          <div className={styles.messageList} style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : 'none' }}>
            {safeMessages.map((message) => {
              const isSentByMe = message.senderId === authUser?.id;
              const renderType = message.fileType || (message.fileUrl ? 'image' : null);
              
              return (
                <div key={message.id} className={`${styles.messageWrapper} ${isSentByMe ? styles.messageSent : styles.messageReceived}`}>
                  <div className={styles.messageBubble}>
                    {renderType === 'image' && <img src={message.fileUrl} alt="Attachment" className={styles.messageImage} />}
                    {renderType === 'video' && <video src={message.fileUrl} controls className={styles.messageVideo} />}
                    {renderType === 'audio' && <audio src={message.fileUrl} controls className={styles.messageAudio} />}
                    {renderType === 'document' && <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.messageDocument}>📄 Document File</a>}
                    {message.text && <span>{message.text}</span>}
                  </div>
                  <div className={styles.messageTime}>
                    {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
            
            <div className={styles.attachWrapper}>
              {isAttachMenuOpen && (
                <div className={styles.attachmentMenu}>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('image/*')}>📷 Photo</button>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('video/*')}>🎥 Video</button>
                  <button type="button" className={styles.attachmentOption} onClick={() => triggerFileInput('.pdf,.doc,.docx,.txt,.csv')}>📄 Document</button>
                </div>
              )}
              <button type="button" className={styles.attachBtn} onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)} title="Attach File">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
            </div>

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