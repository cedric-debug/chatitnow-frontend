import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Moon, Sun, Volume2, VolumeX, X, Reply, Smile, Bell, BellOff, Trash2, AudioLines, Play, Pause, Check, CheckCheck, Paperclip, AlertTriangle, EyeOff, Loader2, Info, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import io from 'socket.io-client';
import AdUnit from './AdUnit';
import * as nsfwjs from 'nsfwjs';

// --- CONFIGURATION ---
const PROD_URL = "https://chatitnow-backend.onrender.com"; 
const ADSENSE_CLIENT_ID = "ca-pub-1806664183023369"; 

// --- AD SLOTS ---
const AD_SLOT_SQUARE = "4725306503"; 
const AD_SLOT_VERTICAL = "1701533824"; 
const AD_SLOT_TOP_BANNER = "9658354392"; 
const AD_SLOT_INACTIVITY = "2655630641"; 

const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : PROD_URL;

// --- SESSION MANAGEMENT ---
const getSessionID = () => {
  if (typeof window === 'undefined') return '';
  let sessionID = localStorage.getItem("chat_session_id");
  if (!sessionID) {
    sessionID = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("chat_session_id", sessionID);
  }
  return sessionID;
};

// --- UTILS ---
const generateMessageID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- SOCKET CONNECTION ---
const socket: any = io(SERVER_URL, { 
  transports: ['websocket'], 
  autoConnect: false,
  reconnection: true,             
  reconnectionAttempts: 50,       
  reconnectionDelay: 1000,
  auth: {
    sessionID: getSessionID()
  }
});

// --- TYPES ---
interface ReplyData {
  text: string;
  name: string;
  isYou: boolean;
  id: string; 
}

interface Message {
  id: string; 
  type: 'system' | 'you' | 'stranger' | 'warning';
  text?: React.ReactNode;
  audio?: string;
  image?: string;
  video?: string;
  isNSFW?: boolean;
  replyTo?: ReplyData;
  timestamp?: string;
  status?: 'sent' | 'read';
  reaction?: string; 
  reactions?: {
    you?: string | null;
    stranger?: string | null;
  };
  data?: { name?: string; field?: string; action?: 'connected' | 'disconnected'; isYou?: boolean; };
}

// --- MEDIA MESSAGE COMPONENT ---
const MediaMessage = ({ msg, safeMode }: { msg: Message, safeMode: boolean }) => {
  const shouldBlur = msg.type !== 'you' && (msg.isNSFW || safeMode);
  const [isRevealed, setIsRevealed] = useState(!shouldBlur);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (msg.type === 'you') {
        setIsRevealed(true);
        return;
    }
    if (safeMode) {
        setIsRevealed(false); 
    } else {
        setIsRevealed(!msg.isNSFW); 
    }
  }, [safeMode, msg.isNSFW, msg.type]);

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const willReveal = !isRevealed;
    setIsRevealed(willReveal);
    
    if (!willReveal && videoRef.current) {
        videoRef.current.pause();
    }
  };

  return (
    <div className="relative group">
      {!isRevealed && (
        <div 
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors backdrop-blur-xl"
          style={{ 
            backgroundColor: msg.isNSFW ? 'rgba(0,0,0,0.9)' : 'rgba(30, 41, 59, 0.9)' 
          }}
          onClick={toggleReveal}
        >
           {msg.isNSFW ? (
             <>
               <AlertTriangle className="text-red-500 mb-2" size={32} />
               <span className="text-red-500 font-bold text-sm uppercase tracking-wider mb-1">Sensitive Content</span>
               <span className="text-gray-400 text-xs">(NSFW / Gore)</span>
             </>
           ) : (
             <>
               <Shield className="text-blue-400 mb-2" size={32} />
               <span className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-1">Hidden Media</span>
               <span className="text-gray-400 text-xs">Safe Mode Active</span>
             </>
           )}
           <span className="text-gray-300 text-[10px] mt-4 border border-gray-600 px-3 py-1 rounded-full">Tap to view</span>
        </div>
      )}

      <div className={`${!isRevealed ? 'filter blur-xl opacity-0' : 'opacity-100'} transition-all duration-300`}>
        {msg.image && (
          <img 
            src={msg.image} 
            alt="Sent content" 
            className="max-w-[200px] sm:max-w-[300px] rounded-lg mb-1 cursor-pointer"
            onClick={() => isRevealed && window.open(msg.image)} 
          />
        )}
        
        {msg.video && (
          <video 
            ref={videoRef}
            key={msg.id} 
            src={msg.video} 
            controls
            playsInline 
            preload="metadata" 
            className="max-w-[200px] sm:max-w-[300px] rounded-lg mb-1 bg-black" 
            onError={(e) => console.error("Video Error:", e)}
          />
        )}
      </div>

      {isRevealed && (msg.isNSFW || safeMode) && (
        <button 
          onClick={toggleReveal}
          className="absolute top-2 right-2 z-30 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          title="Hide Content"
        >
          <EyeOff size={14} />
        </button>
      )}
    </div>
  );
};

// --- CUSTOM AUDIO PLAYER ---
const CustomAudioPlayer = ({ src, isOwnMessage, isDarkMode }: { src: string, isOwnMessage: boolean, isDarkMode: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Play failed", e));
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
        if(audio.duration !== Infinity && !isNaN(audio.duration)) { setDuration(audio.duration); } else { setDuration(0); }
    };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const formatTime = (t: number) => {
    if(!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const btnColor = isOwnMessage ? "text-white" : (isDarkMode ? "text-gray-200" : "text-gray-700");
  const trackBg = isOwnMessage ? "bg-purple-400/50" : (isDarkMode ? "bg-gray-600" : "bg-gray-300");
  const trackFill = isOwnMessage ? "bg-white" : (isDarkMode ? "bg-purple-400" : "bg-purple-600");
  const timeColor = isOwnMessage ? "text-purple-100" : (isDarkMode ? "text-gray-400" : "text-gray-500");

  return (
    <div className="flex items-center gap-3 min-w-[180px] py-1 select-none">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={togglePlay} className={`p-1 rounded-full transition hover:opacity-80 focus:outline-none ${btnColor}`}>
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <div className="flex-1 flex flex-col justify-center h-full pt-1">
         <div className={`h-1 w-full rounded-full ${trackBg} overflow-hidden`}>
            <div className={`h-full ${trackFill} transition-all duration-100 ease-linear`} style={{ width: `${progressPercent}%` }} />
         </div>
      </div>
      <span className={`text-[10px] font-mono w-[30px] text-right ${timeColor} pt-0.5`}>
        {formatTime(isPlaying ? currentTime : duration)}
      </span>
    </div>
  );
};

// --- SWIPEABLE COMPONENT ---
const SwipeableMessage = ({ children, onReply, isSystem, direction }: { children: React.ReactNode, onReply: () => void, isSystem: boolean, direction: 'left' | 'right'}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  
  const SWIPE_THRESHOLD = 35; 
  const MAX_DRAG = 80;

  if (isSystem) return <div>{children}</div>;

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    let finalDrag = 0;
    if (direction === 'right' && diff > 0) {
         const absDiff = Math.abs(diff);
         finalDrag = absDiff > SWIPE_THRESHOLD ? SWIPE_THRESHOLD + Math.pow(absDiff - SWIPE_THRESHOLD, 0.8) : absDiff;
         finalDrag = Math.min(finalDrag, MAX_DRAG);
    } else if (direction === 'left' && diff < 0) {
         const absDiff = Math.abs(diff);
         const resisted = absDiff > SWIPE_THRESHOLD ? SWIPE_THRESHOLD + Math.pow(absDiff - SWIPE_THRESHOLD, 0.8) : absDiff;
         finalDrag = -Math.min(resisted, MAX_DRAG);
    }
    if (finalDrag !== 0) setOffsetX(finalDrag);
  };
  const handleTouchEnd = () => { if (Math.abs(offsetX) > SWIPE_THRESHOLD) onReply(); setIsDragging(false); setOffsetX(0); };
  const handleMouseDown = (e: React.MouseEvent) => { startX.current = e.clientX; setIsDragging(true); };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX.current;
    let finalDrag = 0;
    if (direction === 'right' && diff > 0) finalDrag = Math.min(diff, MAX_DRAG);
    else if (direction === 'left' && diff < 0) finalDrag = Math.max(diff, -MAX_DRAG);
    if (finalDrag !== 0) setOffsetX(finalDrag);
  };
  const handleMouseUp = () => { if (isDragging) { if (Math.abs(offsetX) > SWIPE_THRESHOLD) onReply(); setIsDragging(false); setOffsetX(0); } };
  const handleMouseLeave = () => { if (isDragging) { setIsDragging(false); setOffsetX(0); } };

  return (
    <div 
      className="relative w-full select-none touch-pan-y"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
      onDoubleClick={onReply}
    >
      <div className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 transition-opacity duration-200 ${direction === 'right' ? 'left-2' : 'right-2'}`} style={{ opacity: Math.abs(offsetX) > 15 ? 1 : 0, transform: `translateY(-50%) scale(${Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1)})` }}>
        <Reply size={20} className={direction === 'left' ? "scale-x-[-1]" : ""} /> 
      </div>
      <div style={{ transform: `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
        {children}
      </div>
    </div>
  );
};

export default function ChatItNow() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [username, setUsername] = useState('');
  const [field, setField] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState('searching');
  const [showTerms, setShowTerms] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isNotifyMuted, setIsNotifyMuted] = useState(false);
  const [isReadReceiptsEnabled, setIsReadReceiptsEnabled] = useState(true);
  const [partnerHasReadReceipts, setPartnerHasReadReceipts] = useState(true);
  const [safeMode, setSafeMode] = useState(true);

  const [replyingTo, setReplyingTo] = useState<ReplyData | null>(null);
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 
  
  const [filePreview, setFilePreview] = useState<{ base64: string, type: 'image' | 'video', previewUrl: string } | null>(null);
  const [isNSFWMarked, setIsNSFWMarked] = useState(false);
  const [aiDetectedNSFW, setAiDetectedNSFW] = useState(false); 
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [nsfwModel, setNsfwModel] = useState<nsfwjs.NSFWJS | null>(null); 

  const audioSentRef = useRef<HTMLAudioElement | null>(null);
  const audioReceivedRef = useRef<HTMLAudioElement | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // --- FASTER MODEL LOADING ---
  useEffect(() => {
    const loadModel = async () => {
        try {
            const _model = await nsfwjs.load(); 
            setNsfwModel(_model);
            console.log("NSFW Model Loaded (Lite Version)");
        } catch (e) {
            console.error("Failed to load NSFW model", e);
        }
    };
    loadModel();
  }, []);

  // --- REGISTER SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered', reg))
        .catch(err => console.log('SW Failed', err));
    }
  }, []);

  // --- AUTO-RECONNECT ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected && isLoggedIn) {
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isLoggedIn]);

  // --- FORCE DISCONNECT ON RELOAD ---
  useEffect(() => {
    const handleBeforeUnload = () => { socket.emit('disconnect_partner'); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showSearching, setShowSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 
  
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showInactivityAd, setShowInactivityAd] = useState(false);
  const [showTabReturnAd, setShowTabReturnAd] = useState(false);
  const [formError, setFormError] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityTimerRef = useRef<number | null>(null);
  const partnerNameRef = useRef(''); 

  const fields = ['', 'Sciences & Engineering', 'Business & Creatives', 'Healthcare', 'Retail & Service Industry', 'Government', 'Legal', 'Education', 'Others'];
  const REACTIONS = ['❤️', '😆', '😮', '😢', '😡', '👍'];

  useEffect(() => {
    audioSentRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); 
    audioReceivedRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); 
    [audioSentRef.current, audioReceivedRef.current].forEach(audio => { if(audio) { audio.volume = 1.0; audio.preload = 'auto'; } });
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
        const audioElements = [audioSentRef.current, audioReceivedRef.current];
        audioElements.forEach(audio => {
            if (audio) {
                const originalVolume = audio.volume;
                audio.muted = true;
                audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = false; 
                    audio.volume = originalVolume;
                }).catch(() => {});
            }
        });
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    return () => {
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playSound = (type: 'sent' | 'received') => {
    if (isMuted) return;
    try {
      const audioMap = { sent: audioSentRef.current, received: audioReceivedRef.current };
      // @ts-ignore
      const audio = audioMap[type];
      if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
    } catch (e) { console.error("Audio play failed", e); }
  };

  const getCurrentTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping, replyingTo]); 

  const toggleReadReceipts = () => {
    const newState = !isReadReceiptsEnabled;
    setIsReadReceiptsEnabled(newState);
    if(isConnected) { socket.emit('toggle_read_receipts', newState); }
  };

  const startRecording = async () => {
    try {
      let mimeType = 'audio/webm'; 
      if (MediaRecorder.isTypeSupported('audio/mp4')) { mimeType = 'audio/mp4'; } else if (MediaRecorder.isTypeSupported('audio/aac')) { mimeType = 'audio/aac'; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) { audioChunksRef.current.push(event.data); } };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => { if (prev >= 15) { stopRecordingAndSend(); return 15; } return prev + 1; });
      }, 1000);
    } catch (err) { console.error("Error accessing microphone:", err); alert("Could not access microphone."); }
  };

  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      const mimeType = mediaRecorderRef.current.mimeType;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
         const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
         const base64Audio = await blobToBase64(audioBlob);
         handleSendAudio(base64Audio);
         if(recordingTimerRef.current) clearInterval(recordingTimerRef.current);
         mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
         setIsRecording(false);
         setRecordingDuration(0);
      };
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if(recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingDuration(0);
      audioChunksRef.current = [];
    }
  };

  // --- FAST IMAGE SCANNER (createImageBitmap + 224x224 + 5% Threshold) ---
  const checkImageContent = async (base64Data: string): Promise<boolean> => {
    if (!nsfwModel) return false;
    const res = await fetch(base64Data);
    const blob = await res.blob();
    return new Promise((resolve) => {
        createImageBitmap(blob).then(bitmap => {
            const canvas = document.createElement('canvas');
            canvas.width = 224;
            canvas.height = 224;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if(ctx) {
                ctx.drawImage(bitmap, 0, 0, 224, 224);
                nsfwModel!.classify(canvas).then(predictions => {
                    console.log("Fast Image Scan:", predictions);
                    const isNsfw = predictions.some(p => 
                        (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') 
                        && p.probability > 0.15
                    );
                    resolve(isNsfw);
                }).catch(() => resolve(false));
            } else { resolve(false); }
        }).catch(() => resolve(false));
    });
  };

  // --- ROBUST VIDEO SCANNER (Reuses Canvas) ---
  // Re-introduced Canvas Bridge for maximum device compatibility
  const checkVideoContent = async (file: File): Promise<boolean> => {
    if (!nsfwModel) return false;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      // Create a canvas for reading frames (Bridge method)
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanQueue: number[] = []; 

      const scanNext = async () => {
         if(scanQueue.length === 0) {
             URL.revokeObjectURL(video.src);
             resolve(false);
             return;
         }
         const nextTime = scanQueue.shift();
         video.currentTime = nextTime!;
      };

      video.onloadeddata = () => {
         const dur = video.duration;
         if(dur && dur > 1) {
            scanQueue.push(dur * 0.1); 
            scanQueue.push(dur * 0.5); 
            scanQueue.push(dur * 0.9); 
         } else {
            scanQueue.push(0); 
         }
         scanNext(); 
      };

      video.onseeked = async () => {
         try {
             if(ctx) {
                 // Draw to canvas first
                 ctx.drawImage(video, 0, 0, 224, 224);
                 // Scan the CANVAS pixels
                 const predictions = await nsfwModel!.classify(canvas);
                 console.log("Video Scan:", predictions);
                 
                 const isNsfw = predictions.some(p => 
                     (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') 
                     && p.probability > 0.15
                 );

                 if (isNsfw) {
                     URL.revokeObjectURL(video.src);
                     resolve(true);
                     return;
                 }
             }
             scanNext();

         } catch(e) { 
             console.error("Frame scan failed", e);
             scanNext(); 
         }
      };

      video.onerror = () => resolve(false);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) { 
      alert("File is too large. Max size is 20MB.");
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert("Only images and videos are supported.");
      return;
    }

    // --- EXPANDED FORMAT SUPPORT ---
    const validVideoTypes = [
      'video/mp4', 
      'video/webm', 
      'video/ogg', 
      'video/quicktime', 
      'video/x-m4v', 
      'video/3gpp'
    ];

    if (isVideo && !validVideoTypes.includes(file.type)) {
       console.log("Warning: Uncommon video format", file.type);
    }

    setIsAnalyzing(true);
    setIsNSFWMarked(false); 
    setAiDetectedNSFW(false); 

    try {
        const base64 = await blobToBase64(file);
        // Use Object URL for preview to ensure playback works
        const previewUrl = isVideo ? URL.createObjectURL(file) : base64;
        
        setFilePreview({ base64, type: isImage ? 'image' : 'video', previewUrl });
        
        let detectedNSFW = false;
        if(nsfwModel) {
             if(isImage) {
                 detectedNSFW = await checkImageContent(base64);
             } else {
                 detectedNSFW = await checkVideoContent(file);
             }
        }

        if (detectedNSFW) {
            setAiDetectedNSFW(true); 
        }

    } catch (e) {
        console.error("Scan error", e);
    } finally {
        setIsAnalyzing(false); 
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmSendFile = () => {
    if(!filePreview) return;

    const msgID = generateMessageID();
    const timestamp = getCurrentTime();
    
    const finalIsNSFW = aiDetectedNSFW || isNSFWMarked;

    const msgData: any = {
      id: msgID,
      text: null,
      timestamp: timestamp,
      image: filePreview.type === 'image' ? filePreview.base64 : null,
      video: filePreview.type === 'video' ? filePreview.base64 : null,
      isNSFW: finalIsNSFW
    };

    if (replyingTo) msgData.replyTo = replyingTo;

    // Use previewUrl for local message to fix playback
    setMessages(prev => [...prev, {
      id: msgID,
      type: 'you',
      text: null,
      image: filePreview.type === 'image' ? filePreview.base64 : undefined,
      video: filePreview.type === 'video' ? filePreview.previewUrl : undefined, 
      isNSFW: finalIsNSFW,
      replyTo: replyingTo || undefined,
      timestamp: timestamp,
      status: 'sent',
      reactions: {}
    }]);

    socket.emit('send_message', msgData);
    
    // NOTE: We do not revoke the URL immediately so it stays playable
    
    setReplyingTo(null);
    playSound('sent');
    resetActivity();
    setFilePreview(null); 
    setIsNSFWMarked(false);
    setAiDetectedNSFW(false);
  };

  const handleCancelPreview = () => {
      if (filePreview?.type === 'video' && filePreview.previewUrl !== filePreview.base64) {
          URL.revokeObjectURL(filePreview.previewUrl);
      }
      setFilePreview(null);
  };

  const handleSendAudio = (base64Audio: string) => {
      const msgID = generateMessageID();
      const msgData: any = {
          id: msgID,
          text: null,
          audio: base64Audio,
          timestamp: getCurrentTime()
      };
      if (replyingTo) msgData.replyTo = replyingTo;

      setMessages(prev => [...prev, {
          id: msgID,
          type: 'you',
          text: null,
          audio: base64Audio,
          replyTo: replyingTo || undefined,
          timestamp: msgData.timestamp,
          status: 'sent',
          reactions: {}
      }]);
      socket.emit('send_message', msgData);

      setReplyingTo(null);
      playSound('sent');
      resetActivity();
  };


  // --- SOCKET HANDLERS ---
  useEffect(() => {
    socket.on('matched', (data: any) => {
      setShowSearching(false);
      setPartnerStatus('connected');
      setIsConnected(true);
      setShowNextConfirm(false);
      partnerNameRef.current = data.name; 
      setPartnerHasReadReceipts(data.partnerReadReceipts !== false); 
      setMessages([{ id: 'sys-start', type: 'system', data: { name: data.name, field: data.field, action: 'connected' }, reactions: {} }]);
      resetActivity();
    });

    socket.on('receive_message', (data: any) => {
      const msgId = data.id || generateMessageID();
      
      setMessages(prev => [...prev, { 
        id: msgId,
        type: 'stranger', 
        text: data.text,
        audio: data.audio,
        image: data.image,
        video: data.video,
        isNSFW: data.isNSFW,
        replyTo: data.replyTo,
        timestamp: data.timestamp || getCurrentTime(),
        reactions: {}
      }]);
      
      setIsTyping(false);
      playSound('received');
      resetActivity();

      if (!document.hidden && isReadReceiptsEnabled && partnerHasReadReceipts) {
         socket.emit('mark_read', msgId);
      }

      if (!isNotifyMuted && document.hidden) {
          if (Notification.permission === "granted") {
              const notifTitle = `New message from ${partnerNameRef.current || 'Partner'}`;
              const notifBody = data.image ? "Sent a photo" : (data.video ? "Sent a video" : (data.audio ? "Sent a voice message" : (data.text || "Sent a message")));
              
              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                 navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notifTitle, {
                       body: notifBody,
                       icon: "/favicon.ico"
                    });
                 }).catch(err => console.error("SW Notif failed", err));
              } else {
                 new Notification(notifTitle, {
                    body: notifBody,
                    icon: "/favicon.ico" 
                 });
              }
          }
      }
    });

    socket.on('message_read_by_partner', (msgId: string) => {
        setMessages(prev => prev.map(msg => 
            msg.id === msgId ? { ...msg, status: 'read' } : msg
        ));
    });

    socket.on('partner_receipt_setting', (isEnabled: boolean) => {
        setPartnerHasReadReceipts(isEnabled);
    });

    socket.on('receive_reaction', (data: { messageID: string, reaction: string | null }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageID ? { 
            ...msg, 
            reactions: { ...msg.reactions, stranger: data.reaction } 
        } : msg
      ));
    });

    socket.on('partner_disconnected', () => {
      setIsConnected(false);
      setPartnerStatus('disconnected');
      setIsTyping(false); 
      setReplyingTo(null); 
      if(isRecording) cancelRecording();

      const nameToShow = partnerNameRef.current || 'Partner';
      setMessages(prev => [...prev, { id: 'sys-end', type: 'system', data: { name: nameToShow, action: 'disconnected', isYou: false }, reactions: {} }]);
    });

    socket.on('partner_typing', (typing: boolean) => setIsTyping(typing));

    socket.on('disconnect', () => { if (partnerNameRef.current && isConnected) setPartnerStatus('reconnecting_me'); });
    socket.on('partner_reconnecting_server', () => setPartnerStatus('reconnecting_partner'));
    socket.on('connect', () => { });
    socket.on('session_restored', () => { if (partnerNameRef.current) { setPartnerStatus('restored_me'); setIsConnected(true); } });
    socket.on('partner_connected', () => setPartnerStatus('restored_partner'));
    
    return () => { 
      socket.off('matched'); 
      socket.off('receive_message'); 
      socket.off('receive_reaction');
      socket.off('partner_disconnected'); 
      socket.off('partner_typing'); 
      socket.off('disconnect');
      socket.off('connect');
      socket.off('session_restored'); 
      socket.off('partner_reconnecting_server'); 
      socket.off('partner_connected'); 
      socket.off('message_read_by_partner');
      socket.off('partner_receipt_setting');
    };
  }, [isMuted, isConnected, isNotifyMuted, isRecording, isReadReceiptsEnabled, partnerHasReadReceipts]); 

  // --- THEME & ADDRESS BAR COLOR ---
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    const DARK_BG = '#1f2937'; 
    const LIGHT_BG = '#ffffff';

    const currentBgColor = darkMode ? DARK_BG : LIGHT_BG;

    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    body.style.backgroundColor = currentBgColor;
    html.style.backgroundColor = currentBgColor;

    let metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', currentBgColor);

    let metaStatusBarStyle = document.querySelector("meta[name='apple-mobile-web-app-status-bar-style']");
    if (!metaStatusBarStyle) {
        metaStatusBarStyle = document.createElement('meta');
        metaStatusBarStyle.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(metaStatusBarStyle);
    }
    metaStatusBarStyle.setAttribute('content', darkMode ? 'black-translucent' : 'default');

  }, [darkMode]);

  const resetActivity = () => { if (!showInactivityAd && !showTabReturnAd) setLastActivity(Date.now()); };
  
  useEffect(() => {
    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handleUserInteraction = () => resetActivity();
    activityEvents.forEach(event => window.addEventListener(event, handleUserInteraction));
    return () => activityEvents.forEach(event => window.removeEventListener(event, handleUserInteraction));
  }, [showInactivityAd, showTabReturnAd]);

  useEffect(() => {
    if (isConnected) {
      activityTimerRef.current = window.setInterval(() => {
        const now = Date.now();
        if (now - lastActivity > 7 * 60 * 1000 && !showInactivityAd && !showTabReturnAd) setShowInactivityAd(true);
      }, 5000); 
      return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current); };
    }
  }, [isConnected, lastActivity, showInactivityAd, showTabReturnAd]);

  useEffect(() => {
    const handleVis = () => { 
        if (!document.hidden && isConnected) {
            if(!showInactivityAd) setShowTabReturnAd(true);
            if(isReadReceiptsEnabled && partnerHasReadReceipts) {
                const lastMsg = messages[messages.length - 1];
                if(lastMsg && lastMsg.type === 'stranger') {
                    socket.emit('mark_read', lastMsg.id);
                }
            }
        }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, [isConnected, showInactivityAd, messages, isReadReceiptsEnabled, partnerHasReadReceipts]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMessage(e.target.value);
    resetActivity(); 
    if (isConnected) socket.emit('typing', e.target.value.length > 0);
  };

  const handleLogin = () => {
    if (username.trim() && acceptedTerms && confirmedAdult) {
      setIsLoggedIn(true);
      // Request Notification Permission on Login
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
      socket.connect();
      startSearch();
    } else {
      setFormError(true);
      setTimeout(() => setFormError(false), 2000);
    }
  };

  const startSearch = () => {
    setPartnerStatus('searching');
    setShowSearching(true);
    setMessages([]);
    socket.emit('find_partner', { username, field });
  };

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      const msgID = generateMessageID(); 
      const msgData: any = { 
        id: msgID,
        text: currentMessage,
        timestamp: getCurrentTime()
      };
      if (replyingTo) msgData.replyTo = replyingTo;

      setMessages(prev => [...prev, { 
        id: msgID,
        type: 'you', 
        text: currentMessage, 
        replyTo: replyingTo || undefined,
        timestamp: msgData.timestamp,
        status: 'sent',
        reactions: {}
      }]);
      socket.emit('send_message', msgData);
      
      setCurrentMessage('');
      setReplyingTo(null);
      playSound('sent');
      resetActivity();
    }
  };

  const handleNext = () => {
    if (!showNextConfirm) { setShowNextConfirm(true); return; }
    socket.emit('disconnect_partner');
    setIsConnected(false);
    setShowNextConfirm(false);
    setPartnerStatus('disconnected');
    setIsTyping(false);
    setReplyingTo(null);
    setMessages(prev => [...prev, { id: 'sys-end-me', type: 'system', data: { name: username, action: 'disconnected', isYou: true }, reactions: {} }]);
  };

  const handleStartSearch = () => { startSearch(); };

  const initiateReply = (text: any, type: string, id: string) => {
    if (!isConnected) return;
    const senderName = type === 'you' ? username : (partnerNameRef.current || 'Stranger');
    setReplyingTo({ text: typeof text === 'string' ? text : 'Content', name: senderName, isYou: type === 'you', id: id });
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if(input) input.focus();
  };

  const scrollToMessage = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('animate-pulse-red');
        setTimeout(() => element.classList.remove('animate-pulse-red'), 1000);
    }
  };

  const sendReaction = (msgID: string, emoji: string) => {
    const message = messages.find(m => m.id === msgID);
    const isRemoving = message?.reactions?.you === emoji;
    const reactionToSend = isRemoving ? null : emoji;

    setMessages(prev => prev.map(msg => 
        msg.id === msgID ? { 
            ...msg, 
            reactions: { ...msg.reactions, you: reactionToSend } 
        } : msg
    ));
    
    setActiveReactionId(null);
    socket.emit('send_reaction', { messageID: msgID, reaction: reactionToSend });
  };

  const renderSystemMessage = (msg: Message) => {
    if (!msg.data) return null;
    const boldStyle = { fontWeight: '900', color: darkMode ? '#ffffff' : '#000000' };
    if (msg.data.action === 'connected') return <span>You are now chatting with <span style={boldStyle}>{msg.data.name}</span>{msg.data.field ? <> who is in <span style={boldStyle}>{msg.data.field}</span></> : "."}</span>;
    if (msg.data.action === 'disconnected') {
      if (msg.data.isYou) return <span><span style={boldStyle}>You</span> disconnected from the chat.</span>;
      return <span><span style={boldStyle}>{msg.data.name}</span> disconnected from the chat.</span>;
    }
    return null;
  };

  const renderStatusPill = () => {
      switch(partnerStatus) {
          case 'searching':
              return <span className="text-[10px] bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">Searching...</span>;
          case 'connected':
          case 'restored_me': 
          case 'restored_partner':
              return <span className="text-[10px] bg-green-100 text-green-800 px-3 py-0.5 rounded-full">Connected</span>;
          case 'disconnected':
              return <span className="text-[10px] bg-red-100 text-red-800 px-3 py-0.5 rounded-full">Disconnected</span>;
          case 'reconnecting_me':
              return <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-0.5 rounded-full animate-pulse">Trying to reconnect you back...</span>;
          case 'reconnecting_partner':
              return <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-0.5 rounded-full animate-pulse">{partnerNameRef.current} is trying to reconnect...</span>;
          default:
              if (partnerStatus === 'restored_me') return <span className="text-[10px] bg-green-100 text-green-800 px-3 py-0.5 rounded-full">You reconnected.</span>;
              if (partnerStatus === 'restored_partner') return <span className="text-[10px] bg-green-100 text-green-800 px-3 py-0.5 rounded-full">{partnerNameRef.current} has reconnected.</span>;
              return null;
      }
  };

  if (showWelcome) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
        <div className={`relative w-full h-[100dvh] sm:w-[650px] sm:shadow-2xl border-0 sm:border-x flex flex-col justify-center overflow-y-auto ${darkMode ? 'bg-[#1f2937] border-[#374151]' : 'bg-white border-gray-200'}`}>
          <div className="p-10 w-full max-w-[700px] mx-auto">
            <div className="text-center mb-8">
               <img src="/logo.png" alt="" className="w-20 h-20 mx-auto mb-4 rounded-full object-cover shadow-md" onError={(e) => e.currentTarget.style.display='none'} />
               <h1 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-purple-400' : 'text-purple-900'}`}>Welcome to ChatItNow</h1>
               <div className="w-20 h-1 bg-purple-600 mx-auto mb-6 rounded-full"></div>
            </div>
            <div className={`space-y-4 text-justify text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-700'} max-h-[60vh] overflow-y-auto pr-2`}>
                <p><strong>ChatItNow</strong> is a platform created for Filipinos everywhere who just want a place to talk, connect, and meet different kinds of people. Whether you're a student trying to take a break from school stress, a worker looking to unwind after a long shift, or a professional who just wants to share thoughts with someone new, this site is designed to give you that space.</p>
                <p>If you want to share your experiences, make new friends, learn from someone else's perspective, or simply talk to someone who's going through the same things you are, ChatItNow makes that easy. What makes it even better is that everything is anonymous—no accounts, no profile pictures, no need to show who you are. You can just be yourself and talk freely without worrying about being judged.</p>
                <p>As a university student who knows what it feels like to crave real, genuine connection in a world thats getting more digital and more distant every year. Sometimes, even if we're surrounded by people, we still feel like no one really listens. That's why I built this platform to create a space where Filipinos can express themselves openly, share their stories, and find comfort from people who might actually understand what they're going through—even if they're total strangers.</p>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ChatItNow is completely free to use and always will be. It's meant to be simple, accessible, and welcoming to everyone. Just hop in, start a conversation, and see where it goes. One chat might not change your whole life, but it might change your day—and sometimes, that's already more than enough.</p>
            </div>
            <button onClick={() => setShowWelcome(false)} className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition duration-200 text-lg shadow-md">Continue to ChatItNow</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
        <div className={`relative w-full h-[100dvh] sm:w-[650px] sm:shadow-2xl border-0 sm:border-x flex flex-col justify-center overflow-y-auto ${darkMode ? 'bg-[#1f2937] border-[#374151]' : 'bg-white border-gray-200'}`}>
          <div className="px-10 py-12 w-full max-w-[650px] mx-auto">
            <div className="text-center mb-8">
              <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-purple-400' : 'text-purple-900'}`}>ChatItNow.com</h1>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Chat with Fellow Filipinos</p>
            </div>
            
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Choose a Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} enterKeyHint="go" placeholder="Enter username..." className={`w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm ${darkMode ? 'bg-[#111827] border-[#374151] text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}`} maxLength={20} />
              </div>
              <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Field/Profession (Optional)</label>
                  <select value={field} onChange={(e) => setField(e.target.value)} className={`w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm ${darkMode ? 'bg-[#111827] border-[#374151] text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                    <option value="">Select your field (or leave blank)</option>
                    {fields.slice(1).map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                  <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>We'll try to match you with someone in the same field when possible</p>
              </div>
              <div className={`border rounded-xl p-5 space-y-4 transition-colors duration-300 ${formError ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : darkMode ? 'bg-[#111827] border-[#374151]' : 'border-yellow-200 bg-yellow-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={confirmedAdult} onChange={(e) => setConfirmedAdult(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                  <span className={`text-xs sm:text-sm pt-0.5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}><strong>I confirm that I am 18 years of age or older.</strong></span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                  <span className={`text-xs sm:text-sm pt-0.5 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>I accept the{' '}<button type="button" onClick={() => setShowTerms(true)} className="text-purple-600 hover:underline font-bold">Terms & Conditions</button></span>
                </label>
              </div>
              
              <div className="text-center pt-2">
                 <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                   <span className={`font-bold ${darkMode ? 'text-yellow-400' : 'text-amber-600'}`}>CAUTION:</span> Be careful about taking advices from strangers. Do your due diligence.
                 </p>
              </div>

              <button type="submit" disabled={!username.trim() || !acceptedTerms || !confirmedAdult} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg mt-2">Start Chatting</button>
            </form>

          </div>
        </div>
        
        {showTerms && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className={`rounded-xl shadow-2xl max-w-[420px] w-full my-8 p-6 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
              <h2 className={`text-2xl font-bold mb-4 sticky top-0 pb-2 ${darkMode ? 'text-white bg-[#1f2937]' : 'text-gray-900 bg-white'}`}>Terms & Conditions</h2>
              <div className={`space-y-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <p>Last updated: December 7, 2025</p>
                
                <p><strong>1. Agreement to Terms</strong><br/>
                By accessing ChatItNow.com, an anonymous multimedia chat platform, you agree to these Terms. You acknowledge that this platform allows the transmission of text, voice, images, and videos.</p>
                
                <p><strong>2. Age Restriction (18+)</strong><br/>
                You affirm you are at least 18 years old. This site contains User Generated Content (UGC) that may be mature in nature.</p>
                
                <p><strong>3. Media & Content Policy</strong><br/>
                You are responsible for the media you send.
                <br/>&bull; <strong>NSFW Content:</strong> Our AI attempts to automatically blur nudity, but it is not error-proof.
                <br/>&bull; <strong>Gore & Violence:</strong> The AI <u>does not</u> detect gore. You are <strong>REQUIRED</strong> to manually check the "Mark as Sensitive" box before sending any graphic or violent content. Failure to do so is a violation of these terms.</p>
                
                <p><strong>4. Prohibited Conduct</strong><br/>
                Do not share illegal content (CSAM), non-consensual sexual content, or make threats. We do not permanently store messages.</p>
                
                <p><strong>5. AI & Feature Disclaimer</strong><br/>
                You use this site at your own risk. The "Read Receipts" and "NSFW Filter" are convenience features, not guarantees. We are not liable for AI misclassification (false positives/negatives) or if a stranger bypasses privacy features.</p>
                
                <p><strong>6. Limitation of Liability</strong><br/>
                The Site is provided "as is". ChatItNow.com disclaims all liability for user interactions, emotional distress, data consumption, or harms arising from anonymous media exchange.</p>
              </div>
              <div className={`mt-6 flex gap-3 sticky bottom-0 pt-4 border-t ${darkMode ? 'bg-[#1f2937] border-[#374151]' : 'bg-white border-gray-100'}`}>
                <button onClick={() => { setShowTerms(false); setAcceptedTerms(true); }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">Accept Terms</button>
                <button onClick={() => setShowTerms(false)} className={`flex-1 font-bold py-3 rounded-lg transition ${darkMode ? 'bg-[#374151] hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN CHAT INTERFACE ---
  return (
  <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
      
      {/* Wave Keyframes */}
      <style>{`
        @keyframes typing-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .animate-typing { animation: typing-bounce 1.4s infinite ease-in-out both; }
        
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .animate-pulse-red { animation: pulse-red 1.5s infinite; }
      `}</style>

      {/* --- PREVIEW MODAL --- */}
      {filePreview && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
           <div className={`rounded-xl shadow-2xl p-6 w-full max-w-sm ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
              <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Send File?</h3>
              
              {/* IMAGE/VIDEO PREVIEW */}
              <div className="mb-4 flex justify-center bg-black/20 rounded-lg p-2 max-h-[300px] overflow-hidden">
                 {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-40">
                       <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
                       <span className="text-xs text-gray-500">Scanning content...</span>
                    </div>
                 ) : filePreview.type === 'image' ? (
                    <img src={filePreview.base64} alt="Preview" className="max-h-full rounded object-contain" />
                 ) : (
                    <video 
                        src={filePreview.previewUrl} 
                        controls 
                        autoPlay 
                        className="max-h-full rounded" 
                    />
                 )}
              </div>

              {/* AUTOMATIC NSFW LABEL (IF AI DETECTED) */}
              {aiDetectedNSFW ? (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                      <div className="flex flex-col">
                          <span className="font-bold text-sm text-red-700 dark:text-red-400">Content Flagged by AI</span>
                          <span className="text-xs text-red-600/80 dark:text-red-400/80">Will be blurred for receiver</span>
                      </div>
                  </div>
              ) : (
                  // MANUAL NSFW CHECKBOX (RESTORED - Only shows if AI didn't catch it)
                  <label className={`flex items-center gap-3 mb-2 cursor-pointer p-3 rounded-lg border transition ${isNSFWMarked ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'hover:bg-gray-50 dark:hover:bg-[#374151]'}`}>
                     <input 
                       type="checkbox" 
                       checked={isNSFWMarked} 
                       onChange={(e) => setIsNSFWMarked(e.target.checked)}
                       className="w-5 h-5 text-red-600 rounded focus:ring-red-500" 
                     />
                     <div className="flex flex-col">
                        <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-800'}`}>Mark as Sensitive (NSFW / Gore)</span>
                        <span className="text-xs text-gray-500">Blur content for receiver</span>
                     </div>
                  </label>
              )}

              {/* DISCLAIMER (Only show if manual check is available) */}
              {!aiDetectedNSFW && (
                  <div className="flex items-start gap-2 mb-6 px-1">
                     <Info size={14} className="text-gray-400 mt-0.5 shrink-0" />
                     <p className="text-[10px] text-gray-400">
                        AI scans for nudity automatically. Please manually check this box for violence or gore.
                     </p>
                  </div>
              )}

              <div className="flex gap-3">
                 <button onClick={handleCancelPreview} className="flex-1 py-3 rounded-lg font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 transition">Cancel</button>
                 <button 
                   onClick={handleConfirmSendFile} 
                   disabled={isAnalyzing}
                   className="flex-1 py-3 rounded-lg font-bold bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-50"
                 >
                   Send
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className={`
        relative w-full h-[100dvh] overflow-hidden
        sm:w-[650px] sm:shadow-2xl 
        transition-colors duration-200
        border-0 sm:border-x
        ${darkMode ? 'bg-[#1f2937] sm:border-[#374151]' : 'bg-white sm:border-gray-200'}
      `}>
        
        {/* Fullscreen Ad Overlay */}
        {(showInactivityAd || showTabReturnAd) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className={`${darkMode ? 'bg-[#1f2937]' : 'bg-white'} rounded-xl p-6 w-full text-center shadow-2xl`}>
              <p className="text-xs text-gray-500 mb-2">{showInactivityAd ? "Advertisement" : "Advertisement"}</p>
              <div className="bg-gray-200 h-96 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                <AdUnit client={ADSENSE_CLIENT_ID} slotId={showInactivityAd ? AD_SLOT_INACTIVITY : AD_SLOT_VERTICAL} />
              </div>
              <button 
                onClick={() => { 
                  setShowInactivityAd(false); 
                  setShowTabReturnAd(false); 
                  setLastActivity(Date.now()); 
                }} 
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold"
              >
                Close Ad
              </button>
            </div>
          </div>
        )}

        {/* Searching Overlay */}
        {showSearching && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${darkMode ? 'bg-[#1f2937]' : 'bg-white'} p-6 rounded-2xl shadow-xl w-[95%] text-center`}>
              {/* Added: Timeout Message */}
              <p className={`text-xs font-medium mb-4 ${darkMode ? 'text-yellow-400' : 'text-amber-600'}`}>
                If not paired within 10 seconds, please refresh.
              </p>

              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Finding Partner...</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>Looking in {field || 'All Fields'}</p>
              <div className={`${darkMode ? 'bg-[#374151] border-[#374151]' : 'bg-gray-100 border-gray-200'} border rounded-lg p-2`}>
                <p className={`text-[10px] mb-1 opacity-50 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Advertisement</p>
                <div className="bg-white h-64 rounded flex items-center justify-center overflow-hidden">
                  <AdUnit client={ADSENSE_CLIENT_ID} slotId={AD_SLOT_SQUARE} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className={`absolute top-0 left-0 right-0 h-[60px] px-4 flex justify-between items-center shadow-sm z-20 ${darkMode ? 'bg-[#1f2937] border-b border-[#374151]' : 'bg-white border-b border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-8 h-8 rounded-full object-cover shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className={`font-bold text-lg ${darkMode ? 'text-purple-500' : 'text-purple-600'}`}>ChatItNow</span>
            
            {/* SAFE MODE TOGGLE (LEFT SIDE) */}
            <button 
              onClick={() => setSafeMode(!safeMode)} 
              className={`ml-1 p-1.5 rounded-full transition-colors ${safeMode ? 'text-green-500 bg-green-100/50 dark:bg-green-900/30' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-[#374151]'}`}
              title="Toggle Safe Mode (Blur all media)"
            >
               {safeMode ? <ShieldCheck size={16} strokeWidth={2.5} /> : <Shield size={16} />}
            </button>
          </div>
          
          {/* CENTERED STATUS PILL */}
          <div className="absolute left-1/2 -translate-x-1/2">
             {renderStatusPill()}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleReadReceipts} className={`p-2 rounded-full ${darkMode ? 'bg-[#374151] text-gray-300 hover:bg-[#4B5563]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isReadReceiptsEnabled ? <CheckCheck size={18} className="text-green-500" /> : <Check size={18} />}
            </button>
            <button onClick={() => setIsNotifyMuted(!isNotifyMuted)} className={`p-2 rounded-full ${darkMode ? 'bg-[#374151] text-gray-300 hover:bg-[#4B5563]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isNotifyMuted ? <BellOff size={18} /> : <Bell size={18} />}
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-full ${darkMode ? 'bg-[#374151] text-gray-300 hover:bg-[#4B5563]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-[#374151] text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className={`absolute top-[60px] bottom-[60px] left-0 right-0 overflow-y-auto p-2 pb-4 space-y-3 z-10 ${darkMode ? 'bg-[#1f2937]' : 'bg-white'}`}>
          
          <div className="w-full h-[50px] min-h-[50px] max-h-[50px] sm:h-[90px] sm:min-h-[90px] sm:max-h-[90px] flex justify-center items-center shrink-0 mb-4 overflow-hidden rounded-lg bg-gray-100">
             <AdUnit 
                client={ADSENSE_CLIENT_ID} 
                slotId={AD_SLOT_TOP_BANNER} 
                format="horizontal" 
                responsive="false"
                style={{ display: 'block', maxHeight: '50px', width: '100%' }}
             />
          </div>

          {messages.map((msg, idx) => {
            let justifyClass = 'justify-center'; if (msg.type === 'you') justifyClass = 'justify-end'; if (msg.type === 'stranger') justifyClass = 'justify-start';
            return (
              <div id={msg.id} key={idx} className={`flex w-full ${justifyClass} group relative`}>
                
                {msg.type === 'warning' ? (
                  <div className="w-[90%] text-center my-2">
                    <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 text-xs px-3 py-2 rounded-lg font-semibold">{msg.text}</div>
                  </div>
                ) : msg.type === 'system' ? (
                  <div className="w-full text-center my-3 px-4">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{msg.data ? renderSystemMessage(msg) : msg.text}</span>
                  </div>
                ) : (
                  <SwipeableMessage 
                    onReply={() => initiateReply(msg.text, msg.type, msg.id)} 
                    isSystem={false} 
                    direction={msg.type === 'you' ? 'left' : 'right'}
                  >
                     
                     {/* FIXED: SMILEY POSITIONING */}
                     {/* Removed flex-row-reverse for 'you' so smiley stays on left, but using ml-auto to align group to right */}
                     <div className={`flex items-end gap-2 w-fit flex-row ${msg.type === 'you' ? 'ml-auto' : ''} max-w-[85%]`}>
                        
                        {/* LEFT SMILEY (FOR YOU) */}
                        {msg.type === 'you' && (
                          <div className={`opacity-0 group-hover:opacity-100 transition-opacity`}>
                             <button onClick={() => setActiveReactionId(activeReactionId === msg.id ? null : msg.id!)} className={`p-1 rounded-full ${darkMode ? 'text-gray-400 hover:bg-[#374151]' : 'text-gray-400 hover:bg-gray-100'}`}>
                               <Smile size={16} />
                             </button>
                          </div>
                        )}

                        {/* BUBBLE CONTAINER */}
                        <div className={`flex flex-col ${msg.type === 'you' ? 'items-end' : 'items-start'} relative`}>
                          
                          {/* --- REACTION SELECTOR BAR --- */}
                          {activeReactionId === msg.id && (
                            <div className={`absolute z-30 bottom-full mb-1 flex gap-1 p-1 rounded-full shadow-xl border animate-in fade-in zoom-in duration-200 ${darkMode ? 'bg-[#374151] border-[#4B5563]' : 'bg-white border-gray-200'}`} style={{ left: msg.type === 'you' ? 'auto' : 0, right: msg.type === 'you' ? 0 : 'auto' }}>
                              {REACTIONS.map(emoji => (
                                <button key={emoji} onClick={() => sendReaction(msg.id!, emoji)} className="hover:scale-125 transition text-lg p-1">{emoji}</button>
                              ))}
                              <button onClick={() => setActiveReactionId(null)} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
                            </div>
                          )}

                          {msg.replyTo && (
                            <div 
                                onClick={() => scrollToMessage(msg.replyTo!.id)}
                                className={`mb-1 text-xs opacity-75 px-3 py-1.5 rounded-lg border-l-4 cursor-pointer hover:brightness-90 transition ${msg.type === 'you' ? 'bg-purple-700 text-purple-100 border-purple-300' : (darkMode ? 'bg-[#3A4250] text-gray-400 border-[#4B5563]' : 'bg-gray-200 text-gray-600 border-gray-400')}`}
                            >
                               <span className="font-bold block mb-0.5">{msg.replyTo.name}</span>
                               <span className="line-clamp-1">{msg.replyTo.text}</span>
                            </div>
                          )}

                          <div className={`relative px-3 py-2 rounded-2xl text-[15px] shadow-sm leading-snug ${
                            msg.type === 'you'
                              ? 'bg-purple-600 text-white rounded-br-none' 
                              : `${darkMode ? 'bg-[#374151] text-gray-100' : 'bg-gray-100 text-gray-900'} rounded-bl-none`
                          }`}>
                            
                            {/* --- RENDER MEDIA CONTENT --- */}
                            {(msg.image || msg.video) && (
                                <MediaMessage msg={msg} safeMode={safeMode} />
                            )}

                            {msg.audio && (
                                <CustomAudioPlayer src={msg.audio} isOwnMessage={msg.type === 'you'} isDarkMode={darkMode} />
                            )}

                            {msg.text && (
                                <div className="flex flex-col">
                                  <span className="whitespace-pre-wrap break-words">{msg.text}</span>
                                  {/* LINK SAFETY WARNING */}
                                  {msg.type === 'stranger' && typeof msg.text === 'string' && /(http|https|www\.)/i.test(msg.text) && (
                                      <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                                          <ShieldAlert size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                          <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400">Security Warning</span>
                                              <span className="text-[10px] text-red-500 dark:text-red-300">
                                                  This message contains a link. Do not click unless you trust the source.
                                              </span>
                                          </div>
                                      </div>
                                  )}
                                </div>
                            )}

                            {/* TIMESTAMPS & TICKS */}
                            <div className={`flex items-center gap-1 justify-end mt-1 select-none ${
                                msg.type === 'you' 
                                  ? 'text-white/70' 
                                  : (darkMode ? 'text-gray-400' : 'text-gray-500')
                              }`}>
                                <span className="text-[10px]">{msg.timestamp}</span>
                                {/* SHOW TICKS ONLY FOR YOUR MESSAGES IF ENABLED */}
                                {msg.type === 'you' && isReadReceiptsEnabled && partnerHasReadReceipts && (
                                    msg.status === 'read' ? (
                                        <CheckCheck size={12} className="text-white" />
                                    ) : (
                                        <Check size={12} className="text-white/70" />
                                    )
                                )}
                            </div>

                            {/* --- REACTION BADGES --- */}
                            <div className={`absolute -bottom-2 ${msg.type === 'you' ? '-left-2' : '-right-2'} flex gap-[-5px]`}>
                              {msg.reactions?.you && (
                                <div className={`text-sm bg-gray-100 dark:bg-[#4B5563] border dark:border-[#6B7280] border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-sm z-20`}>
                                  {msg.reactions.you}
                                </div>
                              )}
                              {msg.reactions?.stranger && (
                                <div className={`text-sm bg-gray-100 dark:bg-[#4B5563] border dark:border-[#6B7280] border-gray-300 rounded-full w-6 h-6 flex items-center justify-center shadow-sm z-10 -ml-2`}>
                                  {msg.reactions.stranger}
                                </div>
                              )}
                            </div>

                          </div>
                        </div>

                        {/* RIGHT SMILEY (FOR STRANGER) */}
                        {msg.type !== 'you' && (
                          <div className={`opacity-0 group-hover:opacity-100 transition-opacity`}>
                             <button onClick={() => setActiveReactionId(activeReactionId === msg.id ? null : msg.id!)} className={`p-1 rounded-full ${darkMode ? 'text-gray-400 hover:bg-[#374151]' : 'text-gray-400 hover:bg-gray-100'}`}>
                               <Smile size={16} />
                             </button>
                          </div>
                        )}

                     </div>
                  </SwipeableMessage>
                )}
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className={`${darkMode ? 'bg-[#374151]' : 'bg-gray-100'} px-3 py-2 rounded-2xl rounded-bl-none shadow-sm border-0 flex items-center`}>
                <div className="flex gap-1 h-[21px] items-center">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '160ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '320ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <div className={`absolute bottom-0 left-0 right-0 p-2 border-t z-20 flex flex-col justify-end ${darkMode ? 'bg-[#1f2937] border-[#374151]' : 'bg-white border-gray-100'}`}>
          
          {replyingTo && (
            <div className={`flex items-center justify-between px-4 py-2 mb-1 rounded-lg text-xs border-l-4 ${darkMode ? 'bg-[#374151] text-gray-300 border-purple-500' : 'bg-gray-100 text-gray-700 border-purple-500'}`}>
              <div>
                <span className="font-bold block text-purple-500 mb-0.5">Replying to {replyingTo.name}</span>
                <span className="line-clamp-1 opacity-80">{replyingTo.text}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-[#4B5563] rounded-full">
                <X size={14} />
              </button>
            </div>
          )}

          {partnerStatus === 'disconnected' ? (
            <div className="flex gap-2 items-center h-[60px]">
              <button type="button" onClick={handleStartSearch} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-full shadow-md transition text-sm">Find New Partner</button>
            </div>
          ) : showNextConfirm ? (
            <div className="flex gap-2 items-center h-[60px]">
              <button type="button" onClick={handleNext} className="h-full px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-sm text-sm">End</button>
              <div className="flex-1 flex justify-center items-center text-sm font-bold text-gray-600 dark:text-gray-300">Are you sure?</div>
              <button type="button" onClick={() => setShowNextConfirm(false)} className="h-full px-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition text-sm">Cancel</button>
            </div>
          ) : (
            // --- UPDATED FORM AREA TO HANDLE RECORDING UI ---
            isRecording ? (
               <div className="flex gap-2 items-center h-[60px] w-full px-2">
                 <div className="flex-1 flex items-center gap-3">
                   <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse-red"></div>
                   <span className={`font-mono font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')} / 0:15
                   </span>
                 </div>
                 <button type="button" onClick={cancelRecording} className="p-3 text-red-500 hover:bg-red-100 rounded-full transition">
                   <Trash2 size={24} />
                 </button>
                 <button type="button" onClick={stopRecordingAndSend} className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition">
                   <span className="text-xs font-bold">SEND</span>
                 </button>
               </div>
            ) : (
              <form className="flex gap-2 items-center h-[60px]" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                
                {/* SKIP BUTTON */}
                <button type="button" onClick={handleNext} className={`h-full px-3 w-16 rounded-xl flex items-center justify-center border-2 font-bold transition ${darkMode ? 'border-[#374151] text-white hover:bg-[#323844]' : 'border-gray-200 text-black hover:bg-gray-50 bg-white'} disabled:opacity-50`}>Skip</button>
                
                {/* INPUT CONTAINER */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v" 
                  onChange={handleFileSelect} 
                />

                <div className="relative flex-1 h-full flex items-center">
                  
                  {/* PAPERCLIP INSIDE (LEFT) */}
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className={`absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition z-10 ${darkMode ? 'text-gray-400 hover:bg-[#374151]' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <Paperclip size={20} />
                  </button>

                  <input 
                    type="text" 
                    value={currentMessage} 
                    onChange={handleTyping} 
                    enterKeyHint="send" 
                    placeholder={isConnected ? (replyingTo ? `Replying to ${replyingTo.name}...` : "Say something...") : "Waiting..."} 
                    className={`w-full h-full pl-12 rounded-xl border-2 focus:border-purple-500 outline-none transition text-[15px] ${darkMode ? 'bg-[#111827] border-[#374151] text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'} ${!currentMessage.trim() ? 'pr-12' : 'pr-4'}`} 
                  />
                  
                  {/* MIC ICON INSIDE INPUT */}
                  {!currentMessage.trim() && (
                    <button 
                      type="button" 
                      onClick={startRecording} 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${darkMode ? 'text-gray-400 hover:bg-[#374151]' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-50`}
                    >
                      <AudioLines size={20} />
                    </button>
                  )}
                </div>

                {/* SEND BUTTON */}
                {currentMessage.trim() && (
                  <button type="submit" className="h-full px-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition shadow-sm text-sm">Send</button>
                )}

              </form>
            )
          )}
        </div>

      </div>
    </div>
  );
}