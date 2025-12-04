import React, { useState, useEffect, useRef } from 'react';
import { SkipForward, Moon, Sun } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import AdUnit from './AdUnit';

// --- CONFIGURATION ---
const PROD_URL = "https://chatitnow-server.onrender.com"; 
const ADSENSE_CLIENT_ID = "ca-pub-1806664183023369"; 
const AD_SLOT_SQUARE = "4725306503"; 
const AD_SLOT_VERTICAL = "1701533824"; 

const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : PROD_URL;
const socket: Socket = io(SERVER_URL, { autoConnect: false });

interface Message {
  type: 'system' | 'you' | 'stranger' | 'warning';
  text?: React.ReactNode; 
  data?: { name?: string; field?: string; action?: 'connected' | 'disconnected'; };
}

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
  const [darkMode, setDarkMode] = useState(false);
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showSearching, setShowSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showInactivityAd, setShowInactivityAd] = useState(false);
  const [showTabReturnAd, setShowTabReturnAd] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityTimerRef = useRef<number | null>(null);
  const partnerNameRef = useRef(''); 

  const fields = ['', 'Sciences & Engineering', 'Business & Creatives', 'Healthcare', 'Retail & Service Industry', 'Government', 'Legal', 'Education', 'Others'];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      setMessages(prev => [...prev, { type: 'stranger', text: data.text }]);
      setIsTyping(false);
      resetActivity();
    });

    socket.on('partner_disconnected', () => {
      setIsConnected(false);
      setPartnerStatus('disconnected');
      const nameToShow = partnerNameRef.current || 'Partner';
      setMessages(prev => [...prev, { type: 'system', data: { name: nameToShow, action: 'disconnected' } }]);
    });

    socket.on('partner_typing', (typing: boolean) => setIsTyping(typing));
    
    return () => { 
      socket.off('matched'); 
      socket.off('receive_message'); 
      socket.off('partner_disconnected'); 
      socket.off('partner_typing'); 
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) { 
      root.classList.add('dark'); 
      document.body.style.backgroundColor = '#111827'; 
    } else { 
      root.classList.remove('dark'); 
      document.body.style.backgroundColor = '#ffffff'; 
    }
  }, [darkMode]);

  useEffect(() => {
    window.document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    if (isConnected) {
      activityTimerRef.current = window.setInterval(() => {
        if (Date.now() - lastActivity > 480000 && !showInactivityAd) setShowInactivityAd(true);
      }, 30000);
      return () => { if (activityTimerRef.current) clearInterval(activityTimerRef.current); };
    }
  }, [isConnected, lastActivity]);

  useEffect(() => {
    const handleVis = () => { if (!document.hidden && isConnected) setShowTabReturnAd(true); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, [isConnected]);

  const resetActivity = () => { setLastActivity(Date.now()); setShowInactivityAd(false); };
  
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMessage(e.target.value);
    if (isConnected) socket.emit('typing', e.target.value.length > 0);
  };

  const handleLogin = () => {
    if (username.trim() && acceptedTerms && confirmedAdult) {
      setIsLoggedIn(true);
      socket.connect();
      startSearch();
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
      setMessages(prev => [...prev, { type: 'you', text: currentMessage }]);
      socket.emit('send_message', { text: currentMessage });
      setCurrentMessage('');
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
  };

  const handleStartSearch = () => {
    startSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) isLoggedIn ? handleSendMessage() : handleLogin();
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
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-[420px] w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6"><h1 className="text-3xl font-bold text-purple-900 mb-4">Welcome to ChatItNow</h1><div className="w-20 h-1 bg-purple-600 mx-auto mb-6 rounded-full"></div></div>
          <div className="space-y-4 text-gray-700 text-sm sm:text-base"><p><strong>ChatItNow</strong> is designed and is made to cater Filipinos around the country who wants to connect with fellow professionals, workers, and individuals from all walks of life.</p><p>Whether you're looking to share experiences, make new friends, or simply have a meaningful conversation, ChatItNow provides an anonymous platform to connect with strangers across the Philippines.</p><p>This platform was created by a university student who understands the need for genuine connection in our increasingly digital world. The goal is to build a community where Filipinos can freely express themselves, share their stories, and find support from others who understand their experiences.</p><p className="text-gray-600">ChatItNow is completely free, anonymous, and designed with your safety in mind. Connect with fellow Filipinos, one conversation at a time.</p></div>
          <button onClick={() => setShowWelcome(false)} className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition duration-200 text-lg shadow-md">Continue to ChatItNow</button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-[420px] w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6"><h1 className="text-3xl font-bold text-purple-900 mb-2">ChatItNow.com</h1><p className="text-sm text-gray-600">Chat with Fellow Filipinos</p></div>
          <div className="space-y-4">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Choose a Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyPress={handleKeyPress} placeholder="Enter username..." className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base shadow-sm" maxLength={20} /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Field/Profession (Optional)</label><select value={field} onChange={(e) => setField(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-base shadow-sm"><option value="">Select your field (or leave blank)</option>{fields.slice(1).map((f) => (<option key={f} value={f}>{f}</option>))}</select><p className="text-xs text-gray-500 mt-1">We'll try to match you with someone in the same field when possible</p></div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={confirmedAdult} onChange={(e) => setConfirmedAdult(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" /><span className="text-xs sm:text-sm text-gray-700 pt-0.5"><strong>I confirm that I am 18 years of age or older.</strong></span></label>
              <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500" /><span className="text-xs sm:text-sm text-gray-700 pt-0.5">I accept the{' '}<button onClick={() => setShowTerms(true)} className="text-purple-600 hover:underline font-bold">Terms & Conditions</button></span></label>
            </div>
            <button onClick={handleLogin} disabled={!username.trim() || !acceptedTerms || !confirmedAdult} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg mt-2">Start Chatting</button>
          </div>
        </div>
        {showTerms && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"><div className="bg-white rounded-xl shadow-2xl max-w-[420px] w-full my-8 p-6 max-h-[90vh] overflow-y-auto"><h2 className="text-2xl font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2">Terms & Conditions</h2><div className="space-y-4 text-sm text-gray-700"><p>Last updated: December 4, 2025</p><p>By accessing ChatItNow.com...</p></div><div className="mt-6 flex gap-3 sticky bottom-0 bg-white pt-4 border-t"><button onClick={() => { setShowTerms(false); setAcceptedTerms(true); }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition">Accept Terms</button><button onClick={() => setShowTerms(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg transition">Close</button></div></div></div>)}
      </div>
    );
  }

  // --- MAIN CHAT INTERFACE ---
  return (
    <div className={`fixed inset-0 flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      
      {/* 
          THE "BOX" FIX:
          1. grid: Switches to CSS Grid layout.
          2. grid-rows-[auto_1fr_auto]: Defines 3 distinct rows (Header, Chat, Input).
             - auto: Only takes what it needs (Header/Input).
             - 1fr: Takes ALL remaining space (Chat). IT CANNOT GROW BEYOND THIS.
          3. h-full / sm:h-[90vh]: Sets the strict outer height.
          4. overflow-hidden: Ensures nothing spills out.
      */}
      <div className={`
        grid grid-rows-[auto_1fr_auto]
        w-full h-full 
        sm:w-[420px] sm:h-[90vh] 
        sm:rounded-2xl sm:shadow-2xl sm:border-x 
        overflow-hidden relative
        ${darkMode ? 'bg-gray-900 sm:bg-gray-800 border-gray-800' : 'bg-white border-gray-200'}
      `}>
        
        {(showInactivityAd || showTabReturnAd) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 w-full text-center shadow-2xl`}>
              <p className="text-xs text-gray-500 mb-2">Advertisement</p>
              <div className="bg-gray-200 h-96 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                <AdUnit client={ADSENSE_CLIENT_ID} slotId={AD_SLOT_VERTICAL} />
              </div>
              <button onClick={() => { setShowInactivityAd(false); setShowTabReturnAd(false); resetActivity(); }} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold">Close Ad</button>
            </div>
          </div>
        )}

        {showSearching && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-2xl shadow-xl w-[95%] text-center`}>
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Finding Partner...</h3>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>Looking in {field || 'All Fields'}</p>
              <div className={`${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border rounded-lg p-2`}>
                <p className={`text-[10px] mb-1 opacity-50 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Advertisement</p>
                <div className={`${darkMode ? 'bg-gray-600' : 'bg-gray-200'} h-64 rounded flex items-center justify-center overflow-hidden`}>
                  <AdUnit client={ADSENSE_CLIENT_ID} slotId={AD_SLOT_SQUARE} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROW 1: HEADER */}
        <div className={`h-[60px] ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} px-4 flex justify-between items-center shadow-sm z-10`}>
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">C</div><span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-purple-900'}`}>ChatItNow</span></div>
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>

        {/* ROW 2: CHAT AREA (Overflow Auto handles the scroll within the fixed 1fr height) */}
        <div className={`overflow-y-auto p-2 space-y-1 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
          
          {/* Banner Ad */}
          <div className={`w-full h-[50px] sm:h-[90px] flex justify-center items-center shrink-0 mb-4 overflow-hidden rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
             <AdUnit 
                client={ADSENSE_CLIENT_ID} 
                slotId={AD_SLOT_SQUARE} 
                format="horizontal" 
                responsive="false"
                style={{ display: 'block', maxHeight: '50px', width: '100%' }}
             />
          </div>

          <div className="text-center py-2">
             {partnerStatus === 'searching' ? (<span className="text-[10px] bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">Searching...</span>) : partnerStatus === 'disconnected' ? (<span className="text-[10px] bg-red-100 text-red-800 px-3 py-0.5 rounded-full">Disconnected</span>) : (<span className="text-[10px] bg-green-100 text-green-800 px-3 py-0.5 rounded-full">Connected</span>)}
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
                  <div className={`max-w-[85%] ${msg.type === 'you' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-2 rounded-2xl text-[15px] shadow-sm leading-snug ${
                      msg.type === 'you'
                        ? 'bg-purple-600 text-white rounded-br-none' 
                        : `${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} border border-gray-100 rounded-bl-none`
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl rounded-bl-none shadow-sm`}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ROW 3: INPUT BAR */}
        <div className={`p-2 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex gap-2 items-center h-[48px]">
            {partnerStatus === 'disconnected' ? (
              <button onClick={handleStartSearch} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-full shadow-md transition text-sm">Find New Partner</button>
            ) : !showNextConfirm ? (
              <>
                <button onClick={handleNext} disabled={partnerStatus === 'searching'} className={`h-full aspect-square rounded-xl flex items-center justify-center border-2 font-bold transition ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'} disabled:opacity-50`}><SkipForward size={18} /></button>
                <input type="text" value={currentMessage} onChange={handleTyping} onKeyPress={handleKeyPress} placeholder={isConnected ? "Say something..." : "Waiting..."} disabled={!isConnected} className={`flex-1 h-full px-3 rounded-xl border-2 focus:border-purple-500 outline-none transition text-[15px] ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'}`} />
                <button onClick={handleSendMessage} disabled={!isConnected || !currentMessage.trim()} className="h-full px-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition shadow-sm text-sm">Send</button>
              </>
            ) : (
              <>
                <button onClick={handleNext} className="h-full px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-sm text-sm">End</button>
                <div className="flex-1 flex justify-center items-center text-sm font-bold text-gray-600 dark:text-gray-300">Are you sure?</div>
                <button onClick={() => setShowNextConfirm(false)} className="h-full px-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition text-sm">Cancel</button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}