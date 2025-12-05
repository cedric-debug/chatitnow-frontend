import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { SkipForward, Moon, Sun, Volume2, VolumeX, X, Reply } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import AdUnit from './AdUnit';

// --- CONFIGURATION ---
const PROD_URL = "https://chatitnow-server.onrender.com"; 
const ADSENSE_CLIENT_ID = "ca-pub-1806664183023369"; 

// --- AD SLOTS ---
const AD_SLOT_SQUARE = "4725306503"; 
const AD_SLOT_VERTICAL = "1701533824"; 
const AD_SLOT_TOP_BANNER = "9658354392"; 
const AD_SLOT_INACTIVITY = "2655630641"; 

const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : PROD_URL;
const socket: Socket = io(SERVER_URL, { autoConnect: false });

interface ReplyData {
  text: string;
  isYou: boolean;
}

interface Message {
  type: 'system' | 'you' | 'stranger' | 'warning';
  text?: React.ReactNode;
  replyTo?: ReplyData;
  timestamp?: string;
  data?: { name?: string; field?: string; action?: 'connected' | 'disconnected'; };
}

// --- SWIPEABLE MESSAGE COMPONENT ---
const SwipeableMessage = ({ children, onReply, isSystem }: { children: React.ReactNode, onReply: () => void, isSystem: boolean }) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  
  const SWIPE_THRESHOLD = 25; 
  const MAX_DRAG = 70;

  if (isSystem) return <div>{children}</div>;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    
    if (diff > 0) {
      let finalDrag = diff;
      if (diff > SWIPE_THRESHOLD) {
        const extra = diff - SWIPE_THRESHOLD;
        finalDrag = SWIPE_THRESHOLD + (extra * 0.4); 
      }
      setOffsetX(Math.min(finalDrag, MAX_DRAG));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX > SWIPE_THRESHOLD) onReply();
    setIsDragging(false);
    setOffsetX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX.current;
    if (diff > 0) setOffsetX(Math.min(diff, MAX_DRAG));
  };

  const handleMouseUp = () => {
    if (isDragging) {
      if (offsetX > SWIPE_THRESHOLD) onReply();
      setIsDragging(false);
      setOffsetX(0);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setOffsetX(0);
    }
  };

  return (
    <div 
      className="relative w-full select-none touch-pan-y"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400"
        style={{ 
          opacity: offsetX > 10 ? 1 : 0,
          transform: `translateY(-50%) scale(${offsetX > 15 ? 1 : 0.8})`,
          transition: 'opacity 0.1s ease, transform 0.1s ease'
        }}
      >
        <Reply size={20} />
      </div>
      <div 
        style={{ 
          transform: `translateX(${offsetX}px)`, 
          transition: isDragging ? 'none' : 'transform 0.3s ease-out' 
        }}
      >
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
  const [replyingTo, setReplyingTo] = useState<ReplyData | null>(null);

  const audioSentRef = useRef<HTMLAudioElement | null>(null);
  const audioReceivedRef = useRef<HTMLAudioElement | null>(null);

  // --- DARK MODE ---
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

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

  useEffect(() => {
    audioSentRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); 
    audioReceivedRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); 
    if(audioSentRef.current) audioSentRef.current.volume = 0.5;
    if(audioReceivedRef.current) audioReceivedRef.current.volume = 0.5;
  }, []);

  const playSound = (type: 'sent' | 'received') => {
    if (isMuted) return;
    try {
      if (type === 'sent' && audioSentRef.current) {
        audioSentRef.current.currentTime = 0;
        audioSentRef.current.play().catch(() => {});
      } else if (type === 'received' && audioReceivedRef.current) {
        audioReceivedRef.current.currentTime = 0;
        audioReceivedRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isTyping, replyingTo]); 

  useEffect(() => {
    socket.on('matched', (data: any) => {
      setShowSearching(false);
      setPartnerStatus('connected');
      setIsConnected(true);
      setShowNextConfirm(false);
      partnerNameRef.current = data.name; 
      setMessages([{ type: 'system', data: { name: data.name, field: data.field, action: 'connected' } }]);
      resetActivity();
    });

    socket.on('receive_message', (data: any) => {
      const replyInfo = data.replyTo || undefined;
      setMessages(prev => [...prev, { 
        type: 'stranger', 
        text: data.text, 
        replyTo: replyInfo,
        timestamp: getCurrentTime() 
      }]);
      setIsTyping(false);
      playSound('received');
      resetActivity();
    });

    socket.on('partner_disconnected', () => {
      setIsConnected(false);
      setPartnerStatus('disconnected');
      const nameToShow = partnerNameRef.current || 'Partner';
      setMessages(prev => [...prev, { type: 'system', data: { name: nameToShow, action: 'disconnected' } }]);
    });

    socket.on('partner_typing', (typing: boolean) => setIsTyping(typing));

    // --- ADDED: Handle Internet Connection Drop/Restore ---
    socket.on('disconnect', () => {
      // If we are actively chatting and lose internet (not a manual disconnect)
      if (partnerNameRef.current && isConnected) {
        setPartnerStatus('reconnecting');
      }
    });

    socket.on('connect', () => {
      // If we come back online and still have a partner name, we re-establish connection state
      // (Assuming server supports connection recovery)
      if (partnerNameRef.current) {
        setPartnerStatus('connected');
        setIsConnected(true);
      }
    });
    
    return () => { 
      socket.off('matched'); 
      socket.off('receive_message'); 
      socket.off('partner_disconnected'); 
      socket.off('partner_typing'); 
      socket.off('disconnect');
      socket.off('connect');
    };
  }, [isMuted, isConnected]); // Added isConnected to deps to track state correctly

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const currentBgColor = darkMode ? '#111827' : '#ffffff';
    if (darkMode) html.classList.add('dark');
    else html.classList.remove('dark');
    body.style.backgroundColor = currentBgColor;
    html.style.backgroundColor = currentBgColor;
  }, [darkMode]);

  const resetActivity = () => {
    if (!showInactivityAd && !showTabReturnAd) setLastActivity(Date.now());
  };

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
        const timeDiff = now - lastActivity;
        const SEVEN_MINUTES = 7 * 60 * 1000; 
        if (timeDiff > SEVEN_MINUTES && !showInactivityAd && !showTabReturnAd) {
          setShowInactivityAd(true);
        }
      }, 5000); 
      return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current); };
    }
  }, [isConnected, lastActivity, showInactivityAd, showTabReturnAd]);

  useEffect(() => {
    const handleVis = () => { 
        if (!document.hidden && isConnected && !showInactivityAd) setShowTabReturnAd(true);
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, [isConnected, showInactivityAd]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMessage(e.target.value);
    resetActivity(); 
    if (isConnected) socket.emit('typing', e.target.value.length > 0);
  };

  const handleLogin = () => {
    if (username.trim() && acceptedTerms && confirmedAdult) {
      setIsLoggedIn(true);
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
    if (currentMessage.trim() && isConnected) {
      const msgData: any = { text: currentMessage };
      if (replyingTo) msgData.replyTo = replyingTo;

      setMessages(prev => [...prev, { 
        type: 'you', 
        text: currentMessage, 
        replyTo: replyingTo || undefined,
        timestamp: getCurrentTime() 
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
    setMessages(prev => [...prev, { type: 'system', data: { name: username, action: 'disconnected' } }]);
    setReplyingTo(null);
  };

  const handleStartSearch = () => {
    startSearch();
  };

  const initiateReply = (text: any, type: string) => {
    if (!isConnected) return;
    setReplyingTo({
      text: typeof text === 'string' ? text : 'Content',
      isYou: type === 'you'
    });
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if(input) input.focus();
  };

  const renderSystemMessage = (msg: Message) => {
    if (!msg.data) return null;
    const boldStyle = { fontWeight: '900', color: darkMode ? '#ffffff' : '#000000' };
    
    if (msg.data.action === 'connected') {
      return <span>You are now chatting with <span style={boldStyle}>{msg.data.name}</span>{msg.data.field ? <> who is in <span style={boldStyle}>{msg.data.field}</span></> : "."}</span>;
    }
    
    if (msg.data.action === 'disconnected') {
      if (msg.data.name === username) {
        return <span><span style={boldStyle}>You</span> disconnected.</span>;
      }
      return <span><span style={boldStyle}>{msg.data.name}</span> has disconnected.</span>;
    }
    
    return null;
  };

  if (showWelcome) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`relative w-full h-[100dvh] sm:w-[650px] sm:shadow-2xl border-0 sm:border-x flex flex-col justify-center overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="p-10 w-full max-w-[700px] mx-auto">
            <div className="text-center mb-8">
               <img src="/logo.png" alt="" className="w-20 h-20 mx-auto mb-4 rounded-full object-cover shadow-md" onError={(e) => e.currentTarget.style.display='none'} />
               <h1 className={`text-3xl font-bold mb-4 ${darkMode ? 'text-purple-400' : 'text-purple-900'}`}>Welcome to ChatItNow</h1>
               <div className="w-20 h-1 bg-purple-600 mx-auto mb-6 rounded-full"></div>
            </div>
            <div className={`space-y-4 text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <p><strong>ChatItNow</strong> is designed and is made to cater Filipinos around the country who wants to connect with fellow professionals, workers, and individuals from all walks of life.</p>
                <p>Whether you're looking to share experiences, make new friends, or simply have a meaningful conversation, ChatItNow provides an anonymous platform to connect with strangers across the Philippines.</p>
                <p>This platform was created by a university student who understands the need for genuine connection in our increasingly digital world. The goal is to build a community where Filipinos can freely express themselves, share their stories, and find support from others who understand their experiences.</p>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ChatItNow is completely free and anonymous. Connect with fellow Filipinos, one conversation at a time.</p>
            </div>
            <button onClick={() => setShowWelcome(false)} className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition duration-200 text-lg shadow-md">Continue to ChatItNow</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`relative w-full h-[100dvh] sm:w-[650px] sm:shadow-2xl border-0 sm:border-x flex flex-col justify-center overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-10 py-12 w-full max-w-[650px] mx-auto">
            <div className="text-center mb-8">
              <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-purple-400' : 'text-purple-900'}`}>ChatItNow.com</h1>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Chat with Fellow Filipinos</p>
            </div>
            
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Choose a Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} enterKeyHint="go" placeholder="Enter username..." className={`w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}`} maxLength={20} />
              </div>
              <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Field/Profession (Optional)</label>
                  <select value={field} onChange={(e) => setField(e.target.value)} className={`w-full px-4 py-3.5 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                    <option value="">Select your field (or leave blank)</option>
                    {fields.slice(1).map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                  <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>We'll try to match you with someone in the same field when possible</p>
              </div>
              <div className={`border rounded-xl p-5 space-y-4 transition-colors duration-300 ${formError ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : darkMode ? 'bg-gray-700 border-gray-600' : 'border-yellow-200 bg-yellow-50'}`}>
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
                   <span className={`font-bold ${darkMode ? 'text-yellow-400' : 'text-amber-600'}`}>CAUTION:</span> Be careful about taking strangers' advice.
                 </p>
              </div>

              <button type="submit" disabled={!username.trim() || !acceptedTerms || !confirmedAdult} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg mt-2">Start Chatting</button>
            </form>

          </div>
        </div>
        
        {showTerms && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className={`rounded-xl shadow-2xl max-w-[420px] w-full my-8 p-6 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-2xl font-bold mb-4 sticky top-0 pb-2 ${darkMode ? 'text-white bg-gray-800' : 'text-gray-900 bg-white'}`}>Terms & Conditions</h2>
              <div className={`space-y-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <p>Last updated: December 5, 2025</p>
                <p><strong>Agreement to Terms</strong><br/>By accessing ChatItNow.com (the "Site"), an anonymous text-only chat platform made for Filipinos, you affirm and agree to these Terms and Conditions.</p>
                <p><strong>You Are 18+</strong><br/>You affirm you are at least 18 years old.</p>
                <p><strong>Prohibited Conduct</strong><br/>Do not make threats, promote negativity, hate speech, harassment, discrimination, scams, or illegal content.</p>
                <p><strong>Use at Your Own Risk</strong><br/>You use this Site at your own risk, fully aware of the dangers of chatting with strangers whose identities are not verified. We are not responsible for impersonation, misinformation, scams, or any harms from anonymous interactions.</p>
                <p><strong>Disclaimer of Liability</strong><br/>The Site is provided "as is" and "as available" with no warranties of any kind, express or implied. To the fullest extent permitted by Philippine law ChatItNow.com disclaim all liability, direct or indirect, for user interactions, content, advice, disputes, harms (emotional, financial, reputational), illegal acts, or any loss arising from Site use.</p>
              </div>
              <div className={`mt-6 flex gap-3 sticky bottom-0 pt-4 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button onClick={() => { setShowTerms(false); setAcceptedTerms(true); }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">Accept Terms</button>
                <button onClick={() => setShowTerms(false)} className={`flex-1 font-bold py-3 rounded-lg transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN CHAT INTERFACE ---
  return (
  <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      
      <style>{`
        @keyframes typing-bounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-4px); 
            opacity: 1;
          }
        }
        .animate-typing {
          animation: typing-bounce 1.4s infinite ease-in-out both;
        }
      `}</style>

      <div className={`
        relative w-full h-[100dvh] overflow-hidden
        sm:w-[650px] sm:shadow-2xl 
        transition-colors duration-200
        border-0 sm:border-x
        ${darkMode ? 'bg-gray-900 sm:border-gray-700' : 'bg-white sm:border-gray-200'}
      `}>
        
        {/* Fullscreen Ad Overlay */}
        {(showInactivityAd || showTabReturnAd) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 w-full text-center shadow-2xl`}>
              <p className="text-xs text-gray-500 mb-2">{showInactivityAd ? "Inactive for 7 minutes" : "Welcome Back"}</p>
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
            <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} p-6 rounded-2xl shadow-xl w-[95%] text-center`}>
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Finding Partner...</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>Looking in {field || 'All Fields'}</p>
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} border rounded-lg p-2`}>
                <p className={`text-[10px] mb-1 opacity-50 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Advertisement</p>
                <div className="bg-white h-64 rounded flex items-center justify-center overflow-hidden">
                  <AdUnit client={ADSENSE_CLIENT_ID} slotId={AD_SLOT_SQUARE} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className={`absolute top-0 left-0 right-0 h-[60px] px-4 flex justify-between items-center shadow-sm z-20 ${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white border-b border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-8 h-8 rounded-full object-cover shadow-sm"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className={`font-bold text-lg ${darkMode ? 'text-purple-500' : 'text-purple-600'}`}>ChatItNow</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className={`absolute top-[60px] bottom-[60px] left-0 right-0 overflow-y-auto p-2 pb-4 space-y-3 z-10 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
          
          <div className="w-full h-[50px] min-h-[50px] max-h-[50px] sm:h-[90px] sm:min-h-[90px] sm:max-h-[90px] flex justify-center items-center shrink-0 mb-4 overflow-hidden rounded-lg bg-gray-100">
             <AdUnit 
                client={ADSENSE_CLIENT_ID} 
                slotId={AD_SLOT_TOP_BANNER} 
                format="horizontal" 
                responsive="false"
                style={{ display: 'block', maxHeight: '50px', width: '100%' }}
             />
          </div>

          {/* UPDATED: STATUS PILLS with Reconnecting Logic */}
          <div className="text-center py-2">
             {partnerStatus === 'searching' && (<span className="text-[10px] bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">Searching...</span>)}
             {partnerStatus === 'connected' && (<span className="text-[10px] bg-green-100 text-green-800 px-3 py-0.5 rounded-full">Connected</span>)}
             {partnerStatus === 'disconnected' && (<span className="text-[10px] bg-red-100 text-red-800 px-3 py-0.5 rounded-full">Disconnected</span>)}
             {partnerStatus === 'reconnecting' && (<span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-0.5 rounded-full animate-pulse">Reconnecting...</span>)}
          </div>

          {messages.map((msg, idx) => {
            let justifyClass = 'justify-center'; if (msg.type === 'you') justifyClass = 'justify-end'; if (msg.type === 'stranger') justifyClass = 'justify-start';
            return (
              <div key={idx} className={`flex w-full ${justifyClass}`}>
                {msg.type === 'warning' ? (
                  <div className="w-[90%] text-center my-2">
                    <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 text-xs px-3 py-2 rounded-lg font-semibold">{msg.text}</div>
                  </div>
                ) : msg.type === 'system' ? (
                  <div className="w-full text-center my-3 px-4">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{msg.data ? renderSystemMessage(msg) : msg.text}</span>
                  </div>
                ) : (
                  <SwipeableMessage onReply={() => initiateReply(msg.text, msg.type)} isSystem={false}>
                     <div className={`flex flex-col ${msg.type === 'you' ? 'items-end ml-auto' : 'items-start'} max-w-[85%]`}>
                        {msg.replyTo && (
                          <div className={`mb-1 text-xs opacity-75 px-3 py-1.5 rounded-lg border-l-4 ${msg.type === 'you' ? 'bg-purple-700 text-purple-100 border-purple-300' : (darkMode ? 'bg-gray-800 text-gray-400 border-gray-500' : 'bg-gray-200 text-gray-600 border-gray-400')}`}>
                             <span className="font-bold block mb-0.5">{msg.replyTo.isYou ? 'You' : 'Stranger'}</span>
                             <span className="line-clamp-1">{msg.replyTo.text}</span>
                          </div>
                        )}

                        <div className={`px-3 py-2 rounded-2xl text-[15px] shadow-sm leading-snug ${
                          msg.type === 'you'
                            ? 'bg-purple-600 text-white rounded-br-none' 
                            : `${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'} rounded-bl-none`
                        }`}>
                          {msg.text}
                          {msg.timestamp && (
                            <span className={`text-[10px] block mt-1 select-none ${
                              msg.type === 'you' 
                                ? 'text-right text-white/70' 
                                : (darkMode ? 'text-left text-gray-400' : 'text-left text-gray-500')
                            }`}>
                              {msg.timestamp}
                            </span>
                          )}
                        </div>
                     </div>
                  </SwipeableMessage>
                )}
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} px-3 py-2 rounded-2xl rounded-bl-none shadow-sm border-0 flex items-center`}>
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
        <div className={`absolute bottom-0 left-0 right-0 p-2 border-t z-20 flex flex-col justify-end ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          
          {replyingTo && (
            <div className={`flex items-center justify-between px-4 py-2 mb-1 rounded-lg text-xs border-l-4 ${darkMode ? 'bg-gray-700 text-gray-300 border-purple-500' : 'bg-gray-100 text-gray-700 border-purple-500'}`}>
              <div>
                <span className="font-bold block text-purple-500 mb-0.5">Replying to {replyingTo.isYou ? 'yourself' : 'Partner'}</span>
                <span className="line-clamp-1 opacity-80">{replyingTo.text}</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                <X size={14} />
              </button>
            </div>
          )}

          <form className="flex gap-2 items-center h-[60px]" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
            {partnerStatus === 'disconnected' ? (
              <button type="button" onClick={handleStartSearch} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-full shadow-md transition text-sm">Find New Partner</button>
            ) : !showNextConfirm ? (
              <>
                <button type="button" onClick={handleNext} disabled={partnerStatus === 'searching'} className={`h-full aspect-square rounded-xl flex items-center justify-center border-2 font-bold transition ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'} disabled:opacity-50`}><SkipForward size={18} /></button>
                <input type="text" value={currentMessage} onChange={handleTyping} enterKeyHint="send" placeholder={isConnected ? (replyingTo ? "Type your reply..." : "Say something...") : "Waiting..."} disabled={!isConnected} className={`flex-1 h-full px-3 rounded-xl border-2 focus:border-purple-500 outline-none transition text-[15px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'}`} />
                <button type="submit" disabled={!isConnected || !currentMessage.trim()} className="h-full px-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition shadow-sm text-sm">Send</button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleNext} className="h-full px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-sm text-sm">End</button>
                <div className="flex-1 flex justify-center items-center text-sm font-bold text-gray-600 dark:text-gray-300">Are you sure?</div>
                <button type="button" onClick={() => setShowNextConfirm(false)} className="h-full px-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition text-sm">Cancel</button>
              </>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}