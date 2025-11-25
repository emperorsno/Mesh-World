import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  getDocs,
  where,
  writeBatch,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Activity, ChevronRight, X, Trophy, CheckCircle2, AlertCircle, Lock, LogOut, Mail, User, Key, ArrowLeft, Settings, Plus, Trash2, Calendar, RefreshCw, Shield, Volume2, VolumeX, Eye, EyeOff, Edit2, Camera, Sun, Moon, Users, Filter, Menu, Zap, HelpCircle, FileText, Upload, Download, ClipboardList, Hash, Coins, Bus, MonitorPlay, TrendingUp, Gamepad2, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBMoAiG85n_C0uvH-k77Oi4TGg9CmAzqcs",
  authDomain: "mesh-predictor-2026.firebaseapp.com",
  projectId: "mesh-predictor-2026",
  storageBucket: "mesh-predictor-2026.firebasestorage.app",
  messagingSenderId: "279581490466",
  appId: "1:279581490466:web:85f6e62a044881f595397b",
  measurementId: "G-HL0WHWB2DF"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app';

const app = initializeApp(firebaseConfig || {});
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONSTANTS & UTILS ---
const ADMIN_EMAIL = 'gripper28@gmail.com';
const TOURNAMENT_YEAR = 2026;

const STAGES = [
  { id: 'general', name: 'General', dates: 'Various', status: 'FUTURE', type: 'group' },
  { id: 'md1', name: 'Group Stage - Matchday 1', dates: 'June 11–17, 2026', status: 'ACTIVE', type: 'group' },
  { id: 'md2', name: 'Group Stage - Matchday 2', dates: 'June 18–23, 2026', status: 'FUTURE', type: 'group' },
  { id: 'md3', name: 'Group Stage - Matchday 3', dates: 'June 24–27, 2026', status: 'FUTURE', type: 'group' },
  { id: 'playoffs', name: 'Play-offs', dates: 'TBD', status: 'FUTURE', type: 'knockout' },
  { id: 'r32', name: 'Round of 32', dates: 'June 28 – July 3, 2026', status: 'FUTURE', type: 'knockout' },
  { id: 'r16', name: 'Round of 16', dates: 'July 4–7, 2026', status: 'FUTURE', type: 'knockout' },
  { id: 'qf', name: 'Quarterfinals', dates: 'July 9–11, 2026', status: 'FUTURE', type: 'knockout' },
  { id: 'sf', name: 'Semifinals', dates: 'July 14–15, 2026', status: 'FUTURE', type: 'knockout' },
  { id: '3rd', name: 'Third place playoff', dates: 'July 18, 2026', status: 'FUTURE', type: 'knockout' },
  { id: 'final', name: 'Final', dates: 'July 19, 2026', status: 'FUTURE', type: 'knockout' },
];

const DEFAULT_SCORING = {
  perfect: 5,
  aggregate: 3,
  outcome: 1,
  penaltyBonus: 2
};

// Helper to check strict deadline
const isPastDeadline = (dateStr) => {
  if (!dateStr) return false;
  try {
    const fixtureDate = new Date(dateStr);
    if (isNaN(fixtureDate.getTime())) return false; 
    const deadline = new Date(Date.UTC(fixtureDate.getFullYear(), fixtureDate.getMonth(), fixtureDate.getDate(), 0, 0, 0));
    const now = new Date();
    return now.getTime() >= deadline.getTime();
  } catch (e) {
    return false;
  }
};

// Helper to sort by date
const sortFixturesByDate = (a, b) => {
    const dateA = new Date(`${a.date} ${a.time || '00:00'}`).getTime();
    const dateB = new Date(`${b.date} ${b.time || '00:00'}`).getTime();
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    return dateA - dateB;
};

// Helper to generate colors for graph lines
const getLineColor = (index, theme) => {
  const isContrast = theme === 'contrast';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  if (isTron) return ['#06b6d4', '#f472b6', '#a855f7', '#22d3ee', '#fbbf24'][index % 5];
  if (isMario) return ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'][index % 5];
  if (isContrast) return ['#000000', '#e60000', '#0000ff', '#008000', '#800080'][index % 5];

  // Default
  return ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'][index % 8];
};

// --- SCORING ENGINE ---
const calculatePoints = (prediction, result, rules = DEFAULT_SCORING) => {
  if (!prediction || !result) return { points: 0, type: 'Miss' };
  
  let points = 0;
  let mainType = 'Miss';

  const pHome = parseInt(prediction.home);
  const pAway = parseInt(prediction.away);
  const rHome = parseInt(result.home);
  const rAway = parseInt(result.away);

  if (!isNaN(pHome) && !isNaN(pAway) && !isNaN(rHome) && !isNaN(rAway)) {
    const pDiff = pHome - pAway;
    const rDiff = rHome - rAway;
    const pOutcome = pHome > pAway ? 'HOME' : pHome < pAway ? 'AWAY' : 'DRAW';
    const rOutcome = rHome > rAway ? 'HOME' : rHome < rAway ? 'AWAY' : 'DRAW';

    if (pHome === rHome && pAway === rAway) {
        points += rules.perfect;
        mainType = 'Perfect';
    } else if (pOutcome === rOutcome && pDiff === rDiff) {
        points += rules.aggregate;
        mainType = 'Aggregate';
    } else if (pOutcome === rOutcome) {
        points += rules.outcome;
        mainType = 'Outcome';
    }
  }

  let bonusApplied = false;
  if (result.penaltyWinner) {
    if (prediction.penaltyWinner === result.penaltyWinner) {
      points += rules.penaltyBonus;
      bonusApplied = true;
    }
  }

  if (bonusApplied && mainType !== 'Miss') {
    mainType += ' + Bonus';
  } else if (bonusApplied) {
    mainType = 'Bonus Only';
  }

  return { points, type: mainType };
};

// --- CUSTOM ANIMATION STYLES ---
const AnimationStyles = () => (
  <style>{`
    @keyframes drive-bus {
      0% { transform: translateX(-100%); }
      40% { transform: translateX(10%); }
      50% { transform: translateX(0); }
      100% { transform: translateX(0); }
    }
    .animate-bus-enter {
      animation: drive-bus 1.5s ease-out forwards;
    }
    @keyframes pitch-run {
      0% { transform: translateX(-100vw) translateY(var(--y-start)); }
      100% { transform: translateX(100vw) translateY(var(--y-end)); }
    }
    .pitch-invader {
      position: absolute;
      left: 0;
      animation: pitch-run var(--duration) linear infinite;
      font-size: var(--size);
      z-index: 100;
    }
  `}</style>
);

// --- COMPONENTS ---

const PitchInvasion = ({ onClose }) => {
  const invaders = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    emoji: ['🏃', '🏃‍♂️', '🏃‍♀️', '⚽', '👮‍♂️'][Math.floor(Math.random() * 5)],
    top: Math.random() * 100 + '%',
    duration: Math.random() * 3 + 2 + 's',
    size: Math.random() * 20 + 20 + 'px',
    yStart: Math.random() * 20 - 10 + 'px',
    yEnd: Math.random() * 20 - 10 + 'px'
  }));

  return (
    <div className="fixed inset-0 z-[100] bg-black/20 cursor-pointer overflow-hidden" onClick={onClose}>
       <div className="absolute top-10 left-0 right-0 text-center text-4xl font-black text-white drop-shadow-lg animate-bounce">PITCH INVASION!</div>
       {invaders.map(inv => (
         <div 
            key={inv.id} 
            className="pitch-invader"
            style={{
              top: inv.top,
              '--duration': inv.duration,
              '--size': inv.size,
              '--y-start': inv.yStart,
              '--y-end': inv.yEnd
            }}
         >
           {inv.emoji}
         </div>
       ))}
    </div>
  );
};

const VarOverlay = () => (
  <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center text-white">
    <MonitorPlay size={64} className="mb-4 text-emerald-500 animate-pulse" />
    <h2 className="text-3xl font-black tracking-widest mb-2">VAR CHECK</h2>
    <p className="text-sm font-mono animate-pulse text-emerald-400">REVIEWING PREDICTION...</p>
    <div className="mt-8 w-64 h-1 bg-gray-800 rounded overflow-hidden">
      <div className="h-full bg-emerald-500 w-full animate-[loading_2s_ease-in-out_infinite]" style={{transformOrigin:'left'}}></div>
    </div>
  </div>
);

const Avatar = ({ url, name, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl'
  };

  if (url) {
    return (
      <img 
        src={url} 
        alt={name} 
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-700 bg-slate-800`}
        onError={(e) => { e.target.onerror = null; e.target.src = ''; }} 
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white border-2 border-emerald-400/50`}>
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

const AuthInput = ({ icon: Icon, type, placeholder, value, onChange, label, theme }) => {
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  return (
    <div className="space-y-1">
      {label && <label className={`text-xs font-bold uppercase ml-1 ${isContrast ? 'text-black font-black' : isTron ? 'text-cyan-400 font-mono' : isMario ? 'text-red-600 font-black tracking-wider' : isDark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</label>}
      <div className="relative group">
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
          isContrast ? 'text-black' :
          isTron ? 'text-cyan-500 group-focus-within:text-cyan-300' :
          isMario ? 'text-red-500 group-focus-within:text-green-600' :
          isDark ? 'text-slate-500 group-focus-within:text-emerald-400' : 'text-gray-400 group-focus-within:text-emerald-600'
        }`}>
          <Icon size={18} />
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border rounded-lg py-3 pl-10 pr-4 focus:outline-none transition-all ${
            isContrast 
              ? 'bg-white border-black text-black border-2 placeholder:text-gray-500 font-bold'
              : isTron
                ? 'bg-gray-900 border-cyan-700 text-cyan-100 placeholder:text-cyan-900 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.5)] font-mono'
              : isMario
                ? 'bg-white border-yellow-400 border-4 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-red-500'
              : isDark 
                ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
          }`}
        />
      </div>
    </div>
  );
};

const MusicToggle = ({ isPlaying, onToggle, theme }) => {
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';
  
  return (
    <button 
      onClick={onToggle} 
      className={`p-2 rounded-full transition-all ${
        isPlaying 
          ? isTron ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
          : isContrast
            ? 'bg-white text-black border-2 border-black hover:bg-gray-200'
            : isTron
              ? 'bg-gray-900 text-cyan-700 border border-cyan-900 hover:text-cyan-400'
            : isMario
              ? 'bg-yellow-400 text-yellow-900 border-2 border-yellow-600 hover:bg-yellow-300'
            : isDark 
              ? 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
              : 'bg-white text-gray-400 border border-gray-200 hover:text-gray-600'
      }`}
      title={isPlaying ? "Mute Music" : "Play Music"}
    >
      {isPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
};

const ThemeToggle = ({ theme, onToggle }) => {
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  const getIcon = () => {
      if(isContrast) return <Zap size={18} />;
      if(isTron) return <Cpu size={18} />;
      if(isMario) return <Gamepad2 size={18} />;
      if(isDark) return <Moon size={18} />;
      return <Sun size={18} />;
  };

  return (
    <button 
      onClick={onToggle} 
      className={`p-2 rounded-full transition-all ${
        isContrast 
          ? 'bg-white text-black border-2 border-black hover:bg-gray-200'
          : isTron
            ? 'bg-gray-900 text-cyan-400 border border-cyan-500 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)]'
          : isMario
            ? 'bg-red-500 text-white border-2 border-red-700 hover:bg-red-400'
          : isDark 
            ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-yellow-400' 
            : 'bg-white text-gray-400 border border-gray-200 hover:text-indigo-600'
      }`}
      title="Cycle Theme"
    >
      {getIcon()}
    </button>
  );
};

// --- MODALS ---

const StatsModal = ({ leaderboard, leagues, onClose, theme }) => {
  const [filter, setFilter] = useState('GLOBAL');
  const [graphData, setGraphData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  // Filter users based on selection
  const filteredUsers = filter === 'GLOBAL' 
    ? leaderboard 
    : leaderboard.filter(u => {
        const league = leagues.find(l => l.id === filter);
        return league && (l.members || []).includes(u.id); 
      });

  useEffect(() => {
    const generateGraphData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Completed Fixtures
        const fixturesSnap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), where('status', '==', 'COMPLETED')));
        const fixtures = fixturesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortFixturesByDate);

        // 2. Fetch All Predictions
        const predsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'));
        const allPreds = [];
        predsSnap.forEach(d => allPreds.push(d.data()));

        // 3. Build Time Series
        const dates = [...new Set(fixtures.map(f => f.date))];
        const sortedDates = dates.sort((a, b) => {
            const fA = fixtures.find(f => f.date === a);
            const fB = fixtures.find(f => f.date === b);
            return sortFixturesByDate(fA, fB);
        });

        let runningTotals = {};
        // Initialize everyone at 0
        filteredUsers.forEach(u => runningTotals[u.id] = 0);

        const dataPoints = sortedDates.map(date => {
          const dayFixtures = fixtures.filter(f => f.date === date);
          
          dayFixtures.forEach(match => {
              const matchPreds = allPreds.filter(p => p.matchId === match.id);
              matchPreds.forEach(p => {
                  if (runningTotals[p.userId] !== undefined) {
                      runningTotals[p.userId] += (p.points || 0);
                  }
              });
          });

          // Create data point for this date
          const point = { date };
          filteredUsers.forEach(u => {
              // Use name or ID as fallback
              point[u.name || u.id] = runningTotals[u.id] || 0;
          });
          return point;
        });
        
        const startPoint = { date: 'Start' };
        filteredUsers.forEach(u => startPoint[u.name || u.id] = 0);

        setGraphData([startPoint, ...dataPoints]);
      } catch (error) {
        console.error("Error generating graph:", error);
      } finally {
        setLoading(false);
      }
    };

    generateGraphData();
  }, [filter, leaderboard]); 

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-2 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-4xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
        isContrast ? 'bg-white border-4 border-black' :
        isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]' :
        isMario ? 'bg-sky-100 border-4 border-yellow-400' :
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}>
         <div className={`p-4 border-b flex flex-col gap-3 ${
          isContrast ? 'bg-white border-black' :
          isTron ? 'bg-gray-950 border-cyan-900' :
          isMario ? 'bg-red-600 border-yellow-400 border-b-4' :
          isDark ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex justify-between items-center">
            <h3 className={`font-bold flex items-center gap-2 ${
                isContrast ? 'text-black' : 
                isTron ? 'text-cyan-400 font-mono tracking-widest' : 
                isMario ? 'text-white drop-shadow-md font-black' :
                'text-emerald-500'
            }`}>
              <TrendingUp size={18} /> Player Progress
            </h3>
            <button onClick={onClose} className={`${isContrast ? 'text-black hover:text-gray-600' : isTron ? 'text-cyan-600 hover:text-cyan-400' : isMario ? 'text-white hover:text-yellow-200' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
          </div>

           {/* Filter */}
           <div className="relative">
              <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isContrast ? 'text-black' : isTron ? 'text-cyan-600' : 'text-slate-500'}`}>
                  <Filter size={14} />
                </div>
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-lg text-sm border appearance-none ${
                    isContrast ? 'bg-white border-2 border-black text-black font-bold' :
                    isTron ? 'bg-gray-900 border-cyan-700 text-cyan-400 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.5)] font-mono' :
                    isMario ? 'bg-white border-4 border-green-600 text-gray-900 font-bold' :
                    isDark ? 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
                  }`}
                >
                  <option value="GLOBAL">Global (Top 50)</option>
                  {leagues.length > 0 && <optgroup label="My Leagues">
                    {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>}
                </select>
           </div>
        </div>

        <div className={`flex-1 p-4 ${isContrast ? 'bg-white' : isTron ? 'bg-gray-900' : isMario ? 'bg-sky-100' : isDark ? 'bg-slate-900' : 'bg-white'}`}>
           {loading ? <div className="flex h-full items-center justify-center text-slate-500">Calculating stats...</div> : (
             <div className="w-full h-64 md:h-96">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={graphData}>
                   <CartesianGrid strokeDasharray="3 3" stroke={isContrast ? '#000' : isTron ? '#155e75' : isDark ? '#334155' : '#e2e8f0'} />
                   <XAxis 
                      dataKey="date" 
                      stroke={isContrast ? '#000' : isTron ? '#06b6d4' : isDark ? '#94a3b8' : '#64748b'} 
                      style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: isTron ? 'monospace' : 'sans-serif' }}
                   />
                   <YAxis 
                      stroke={isContrast ? '#000' : isTron ? '#06b6d4' : isDark ? '#94a3b8' : '#64748b'}
                      style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: isTron ? 'monospace' : 'sans-serif' }}
                   />
                   <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isContrast ? '#fff' : isTron ? '#0f172a' : isMario ? '#fff' : isDark ? '#1e293b' : '#fff', 
                        border: isContrast ? '2px solid #000' : isTron ? '1px solid #06b6d4' : isMario ? '4px solid #facc15' : '1px solid #475569',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: isTron ? '#06b6d4' : 'inherit'
                      }}
                      itemStyle={{ color: isContrast ? '#000' : isTron ? '#22d3ee' : isDark ? '#fff' : '#000' }}
                   />
                   <Legend wrapperStyle={{ paddingTop: '20px' }} />
                   {filteredUsers.slice(0, 10).map((user, index) => (
                     <Line 
                       key={user.id}
                       type="monotone" 
                       dataKey={user.name || 'Unknown'} 
                       stroke={getLineColor(index, theme)} 
                       strokeWidth={isContrast || isMario ? 3 : 2}
                       dot={{ r: isContrast ? 4 : 3 }}
                       activeDot={{ r: 6 }}
                     />
                   ))}
                 </LineChart>
               </ResponsiveContainer>
               {filteredUsers.length > 10 && <p className="text-center text-[10px] text-slate-500 mt-2">Showing top 10 players for clarity</p>}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const MatchPredictionsModal = ({ match, onClose, theme }) => {
  const [matchPreds, setMatchPreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'), where('matchId', '==', match.id));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      // Sort by points (if completed) or name
      list.sort((a,b) => (b.points || 0) - (a.points || 0));
      setMatchPreds(list);
      setLoading(false);
    };
    load();
  }, [match]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
        isContrast ? 'bg-white border-2 border-black' :
        isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]' :
        isMario ? 'bg-sky-100 border-4 border-yellow-400' :
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 flex justify-between items-center border-b ${
          isContrast ? 'bg-white border-black' :
          isTron ? 'bg-gray-950 border-cyan-900' :
          isMario ? 'bg-red-600 border-yellow-400 border-b-4' :
          isDark ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'
        }`}>
          <h3 className={`font-bold flex items-center gap-2 ${
            isContrast ? 'text-black' : 
            isTron ? 'text-cyan-400 font-mono tracking-widest' :
            isMario ? 'text-white' :
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <Users size={18} /> {match.teamA} vs {match.teamB}
          </h3>
          <button onClick={onClose} className={`${isContrast ? 'text-black' : isTron ? 'text-cyan-600 hover:text-cyan-400' : isMario ? 'text-white hover:text-yellow-200' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
        </div>
        <div className="p-4 overflow-y-auto">
           {loading ? <div className="text-center py-4 text-slate-500">Loading predictions...</div> : (
             <div className="space-y-2">
                {matchPreds.length === 0 && <div className="text-center text-slate-500 italic">No predictions made.</div>}
                {matchPreds.map((p, idx) => (
                  <div key={idx} className={`p-2 rounded flex justify-between items-center ${
                    isContrast ? 'border border-black' : 
                    isTron ? 'bg-gray-900 border border-cyan-900' :
                    isMario ? 'bg-white border-2 border-black' :
                    isDark ? 'bg-slate-800' : 'bg-gray-100'
                  }`}>
                    <div className={`font-medium ${
                      isContrast ? 'text-black' :
                      isTron ? 'text-cyan-100 font-mono' :
                      isMario ? 'text-gray-900 font-bold' :
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {p.userName || 'Unknown'}
                    </div>
                    <div className="text-right">
                      <div className={`font-bold font-mono ${isContrast ? 'text-black' : isTron ? 'text-cyan-400' : isMario ? 'text-blue-600' : 'text-emerald-600'}`}>
                         {p.prediction.home} - {p.prediction.away}
                         {p.prediction.penaltyWinner && <span className="text-[10px] ml-1">({p.prediction.penaltyWinner.charAt(0).toUpperCase()})</span>}
                      </div>
                      {match.status === 'COMPLETED' && (
                        <div className={`text-[10px] ${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-600' : 'text-slate-500'}`}>{p.points} pts</div>
                      )}
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const HelpModal = ({ onClose, theme }) => {
  const [helpText, setHelpText] = useState('Loading rules...');
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  useEffect(() => {
    const fetchHelp = async () => {
      const docSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'help'));
      if (docSnap.exists()) {
        setHelpText(docSnap.data().text || 'No rules found.');
      } else {
        setHelpText('Welcome to Mesh Predictor! Rules will be added shortly.');
      }
    };
    fetchHelp();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
        isContrast ? 'bg-white border-2 border-black' :
        isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]' :
        isMario ? 'bg-sky-100 border-4 border-yellow-400' :
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b flex justify-between items-center ${
          isContrast ? 'bg-white border-black' :
          isTron ? 'bg-gray-950 border-cyan-900' :
          isMario ? 'bg-red-600 border-yellow-400 border-b-4' :
          isDark ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'
        }`}>
          <h3 className={`font-bold flex items-center gap-2 ${
            isContrast ? 'text-black' :
            isTron ? 'text-cyan-400 font-mono tracking-widest' :
            isMario ? 'text-white drop-shadow-md' :
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <HelpCircle size={18} /> Help & Rules
          </h3>
          <button onClick={onClose} className={`${isContrast ? 'text-black' : isTron ? 'text-cyan-600 hover:text-cyan-400' : isMario ? 'text-white hover:text-yellow-200' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className={`whitespace-pre-wrap text-sm leading-relaxed ${
            isContrast ? 'text-black font-medium' :
            isTron ? 'text-cyan-100 font-mono' :
            isMario ? 'text-gray-900 font-bold' :
            isDark ? 'text-slate-300' : 'text-gray-700'
          }`}>
            {helpText}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileModal = ({ user, currentData, onClose, theme }) => {
  const [name, setName] = useState(currentData?.name || user.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentData?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(user, { displayName: name, photoURL: avatarUrl });
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      await updateDoc(userRef, { name: name, avatarUrl: avatarUrl });
      onClose();
    } catch (e) {
      alert("Error saving profile: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden ${
        isContrast ? 'bg-white border-2 border-black' :
        isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]' :
        isMario ? 'bg-sky-100 border-4 border-yellow-400' :
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b flex justify-between items-center ${
          isContrast ? 'bg-white border-black text-black' :
          isTron ? 'bg-gray-950 border-cyan-900' :
          isMario ? 'bg-red-600 border-yellow-400 border-b-4' :
          isDark ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'
        }`}>
          <h3 className={`font-bold flex items-center gap-2 ${
            isContrast ? 'text-black' : 
            isTron ? 'text-cyan-400 font-mono' :
            isMario ? 'text-white drop-shadow-md' :
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <User size={18} /> Edit Profile
          </h3>
          <button onClick={onClose} className={`${isContrast ? 'text-black hover:text-gray-600' : isTron ? 'text-cyan-600 hover:text-cyan-400' : isMario ? 'text-white hover:text-yellow-200' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-center mb-6">
             <div className="relative group">
                <Avatar url={avatarUrl} name={name} size="lg" />
             </div>
          </div>

          <div className="space-y-2">
             <label className={`text-xs font-bold uppercase ${isContrast ? 'text-black' : isTron ? 'text-cyan-600 font-mono' : isMario ? 'text-red-600 font-black' : isDark ? 'text-slate-400' : 'text-gray-500'}`}>Display Name</label>
             <input 
               className={`w-full border rounded p-2 ${
                 isContrast ? 'bg-white border-2 border-black text-black font-bold' :
                 isTron ? 'bg-gray-900 border-cyan-700 text-cyan-100 font-mono' :
                 isMario ? 'bg-white border-4 border-green-500 rounded-xl text-gray-900' :
                 isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
               }`}
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
          </div>

          <div className="space-y-2">
             <label className={`text-xs font-bold uppercase ${isContrast ? 'text-black' : isTron ? 'text-cyan-600 font-mono' : isMario ? 'text-red-600 font-black' : isDark ? 'text-slate-400' : 'text-gray-500'}`}>Avatar Image URL</label>
             <input 
               className={`w-full border rounded p-2 text-xs ${
                 isContrast ? 'bg-white border-2 border-black text-black font-bold' :
                 isTron ? 'bg-gray-900 border-cyan-700 text-cyan-100 font-mono' :
                 isMario ? 'bg-white border-4 border-green-500 text-gray-900 rounded-xl' :
                 isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'
               }`}
               value={avatarUrl}
               onChange={(e) => setAvatarUrl(e.target.value)}
               placeholder="https://example.com/image.jpg"
             />
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className={`w-full mt-4 font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 ${
              isContrast ? 'bg-black text-white hover:bg-gray-800 border-2 border-black' :
              isTron ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500 hover:bg-cyan-900/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]' :
              isMario ? 'bg-green-500 text-white border-b-4 border-green-700 hover:translate-y-1 hover:border-b-0 rounded-xl shadow-lg' :
              'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {saving ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle2 size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({ onSwitch, musicProps, theme, toggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full justify-center max-w-md mx-auto w-full relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <MusicToggle {...musicProps} theme={theme} />
      </div>

      <div className="mb-8 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mx-auto mb-4 shadow-lg ${isContrast ? 'bg-white border-2 border-black' : isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_15px_cyan]' : isMario ? 'bg-red-600 border-4 border-yellow-400' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <span className="text-3xl">⚽</span>
        </div>
        <h1 className={`text-2xl font-bold ${isContrast ? 'text-black' : isTron ? 'text-cyan-400 font-mono tracking-widest' : isMario ? 'text-red-600 font-black drop-shadow-sm' : isDark ? 'text-white' : 'text-gray-900'}`}>Mesh Predictor</h1>
        <p className={`${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-700' : 'text-slate-500'} text-sm`}>Sign in to play</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <AuthInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} theme={theme} />
        <AuthInput icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} theme={theme} />
        {error && <p className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        
        <button disabled={loading} type="submit" className={`w-full font-bold py-3.5 rounded-xl transition-all active:scale-95 mt-4 disabled:opacity-50 ${
            isContrast ? 'bg-black text-white border-2 border-black hover:bg-gray-800' : 
            isTron ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500 hover:shadow-[0_0_20px_cyan]' :
            isMario ? 'bg-green-500 text-white border-b-4 border-green-700 hover:border-b-0 hover:translate-y-1' :
            'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className={`${isContrast ? 'text-black' : isTron ? 'text-cyan-800' : 'text-slate-500'} text-sm`}>
          No account? <button onClick={() => onSwitch('register')} className={`${
              isContrast ? 'text-black underline font-bold' : 
              isTron ? 'text-cyan-400 hover:text-cyan-200' :
              isMario ? 'text-blue-600 font-black' :
              'text-emerald-500 font-bold hover:underline'
          }`}>Register</button>
        </p>
      </div>
      
      <div className="mt-8 text-center">
        <p className={`text-[10px] ${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-900' : isDark ? 'text-slate-600' : 'text-gray-400'}`}>Version v0.8c - Created by DBG</p>
      </div>
    </div>
  );
};

const RegisterScreen = ({ onSwitch, musicProps, theme, toggleTheme }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        name: name,
        email: email, 
        avatarUrl: '',
        totalPoints: 0,
        stats: { perfect: 0, aggregate: 0, outcome: 0, missed: 0 },
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full justify-center max-w-md mx-auto w-full relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <MusicToggle {...musicProps} theme={theme} />
      </div>
      <button onClick={() => onSwitch('login')} className={`absolute top-6 left-4 flex items-center gap-1 ${
        isContrast ? 'text-black font-bold' : 
        isTron ? 'text-cyan-600 hover:text-cyan-400' :
        isMario ? 'text-red-600 font-bold hover:text-red-400' :
        'text-slate-400 hover:text-emerald-500'
      }`}><ArrowLeft size={18} /> Back</button>
      <div className="mb-6 mt-8"><h1 className={`text-2xl font-bold ${
        isContrast ? 'text-black' : 
        isTron ? 'text-cyan-400 font-mono' :
        isMario ? 'text-red-600 font-black' :
        isDark ? 'text-white' : 'text-gray-900'
      }`}>Create Account</h1></div>
      
      <form onSubmit={handleRegister} className="space-y-4">
        <AuthInput icon={User} type="text" placeholder="Display Name" value={name} onChange={setName} theme={theme} />
        <AuthInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} theme={theme} />
        <AuthInput icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} theme={theme} />
        {error && <p className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        <button disabled={loading} type="submit" className={`w-full font-bold py-3.5 rounded-xl mt-2 ${
            isContrast ? 'bg-black text-white border-2 border-black hover:bg-gray-800' : 
            isTron ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500 hover:shadow-[0_0_20px_cyan]' :
            isMario ? 'bg-green-500 text-white border-b-4 border-green-700 hover:border-b-0 hover:translate-y-1' :
            'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

const AdminDashboard = ({ fixtures, onClose, theme, allUsers }) => {
  const [selectedStageId, setSelectedStageId] = useState('md1'); // Default to md1
  const [newMatch, setNewMatch] = useState({ teamA: '', teamB: '', date: '', time: '' });
  const [processing, setProcessing] = useState(false);
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING);
  const [showRules, setShowRules] = useState(false);
  const [activeTab, setActiveTab] = useState('fixtures'); // 'fixtures' or 'leagues' or 'content' or 'admins'
  const [leagues, setLeagues] = useState([]);
  const [importText, setImportText] = useState('');
  const [resultsText, setResultsText] = useState('');
  const [parsedMatches, setParsedMatches] = useState([]);
  const [parsedResults, setParsedResults] = useState([]);
  const [helpText, setHelpText] = useState('');
  const [adminList, setAdminList] = useState([]); // Dynamic admin list
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  // Load Data
  useEffect(() => {
    const loadRules = async () => {
      const docSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'scoring'));
      if (docSnap.exists()) setScoringRules(docSnap.data());

      const helpSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'help'));
      if (helpSnap.exists()) setHelpText(helpSnap.data().text || '');

      const adminsSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admins'));
      if (adminsSnap.exists()) setAdminList(adminsSnap.data().list || []);
    };
    loadRules();

    const unsubLeagues = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'leagues'), (snap) => {
      setLeagues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubLeagues();
  }, []);

  // --- ADMIN MANAGEMENT ---
  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminEmail.includes('@')) return alert("Invalid Email");
    const newList = [...adminList, newAdminEmail];
    setAdminList(newList);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admins'), { list: newList });
    setNewAdminEmail('');
  };

  const handleRemoveAdmin = async (emailToRemove) => {
    const newList = adminList.filter(e => e !== emailToRemove);
    setAdminList(newList);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admins'), { list: newList });
  };

  const handleSaveRules = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'scoring'), scoringRules);
    setShowRules(false);
    alert('Scoring rules updated!');
  };

  const handleSaveHelp = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'help'), { text: helpText });
    alert('Help text updated!');
  };

  const handleAddMatch = async () => {
    if (!newMatch.teamA || !newMatch.teamB) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), {
      stageId: selectedStageId,
      ...newMatch,
      status: 'UPCOMING',
      result: null,
      timestamp: Date.now()
    });
    setNewMatch({ teamA: '', teamB: '', date: '', time: '' });
  };

  const parseImport = () => {
     const rows = importText.split(/\r?\n/);
     const matches = rows.map(row => {
         const cols = row.split(/\t|  +/); 
         if (cols.length >= 4) return { teamA: cols[0].trim(), teamB: cols[1].trim(), date: cols[2].trim(), time: cols[3].trim() };
         return null;
     }).filter(m => m);
     setParsedMatches(matches);
  };

  const confirmImport = async () => {
    setProcessing(true);
    try {
        const batch = writeBatch(db);
        parsedMatches.forEach(m => {
            const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'));
            batch.set(docRef, {
                stageId: selectedStageId,
                ...m,
                status: 'UPCOMING',
                result: null,
                timestamp: Date.now()
            });
        });
        await batch.commit();
        setImportText('');
        setParsedMatches([]);
        alert(`Imported ${parsedMatches.length} matches!`);
    } catch(e) { alert(e.message); }
    setProcessing(false);
  };

  // --- BULK RESULT IMPORT LOGIC ---
  const parseResults = () => {
    const rows = resultsText.split(/\r?\n/);
    const results = [];
    
    rows.forEach(row => {
        const cleanRow = row.trim();
        if (!cleanRow) return;

        const match = cleanRow.match(/^(.+?)\s+(\d+)\s*[-:–]?\s*(\d+)\s+(.+)$/);
        if (match) {
            const teamA = match[1].trim();
            const scoreA = match[2];
            const scoreB = match[3];
            const teamB = match[4].trim();
            
            const fixture = fixtures.find(f => 
                (f.teamA.toLowerCase().includes(teamA.toLowerCase()) || teamA.toLowerCase().includes(f.teamA.toLowerCase())) &&
                (f.teamB.toLowerCase().includes(teamB.toLowerCase()) || teamB.toLowerCase().includes(f.teamB.toLowerCase()))
            );

            if (fixture) {
                results.push({
                    match: fixture,
                    home: scoreA,
                    away: scoreB,
                    text: row
                });
            }
        }
    });
    
    if (results.length === 0) {
        alert("No matches found. Ensure format is: TeamA Score-Score TeamB");
    }
    setParsedResults(results);
  };

  const confirmResults = async () => {
    setProcessing(true);
    try {
        for (const res of parsedResults) {
            await handleUpdateScore(res.match, res.home, res.away, null); 
        }
        setResultsText('');
        setParsedResults([]);
        alert(`Updated scores for ${parsedResults.length} matches!`);
    } catch (e) { alert(e.message); }
    setProcessing(false);
  };


  const handleDeleteMatch = async (id) => {
    if (confirm("Delete match?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'fixtures', id));
    }
  };

  const handleDeleteLeague = async (id) => {
    if(confirm("Are you sure? This will delete the league for all members.")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', id));
    }
  };

  // --- Export Data ---
  const handleExportData = async () => {
    setProcessing(true);
    try {
      const [usersSnap, fixturesSnap, predsSnap] = await Promise.all([
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users')),
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures')),
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'))
      ]);

      const users = {};
      usersSnap.forEach(d => users[d.id] = d.data().name);

      const fixtures = {};
      fixturesSnap.forEach(d => fixtures[d.id] = d.data());

      const header = ["MatchID", "Stage", "HomeTeam", "AwayTeam", "Date", "Time", "PlayerName", "PredHome", "PredAway", "PredPens", "Points", "Type"];
      const rows = [header.join(",")];

      predsSnap.forEach(doc => {
        const p = doc.data();
        const match = fixtures[p.matchId];
        const playerName = users[p.userId] || "Unknown";

        if (match) {
          const row = [
            p.matchId,
            match.stageId,
            match.teamA,
            match.teamB,
            match.date,
            match.time,
            playerName,
            p.prediction.home,
            p.prediction.away,
            p.prediction.penaltyWinner || "",
            p.points || 0,
            p.type || ""
          ];
          rows.push(row.map(cell => `"${cell}"`).join(","));
        }
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "mesh_predictor_backup.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (e) {
      alert("Export failed: " + e.message);
    }
    setProcessing(false);
  };

  const handleRecalculateAll = async () => {
    if (!confirm("WARNING: This will reset all scores to 0 and recalculate them based on current completed matches. Continue?")) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const usersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      const userMap = {};
      usersSnapshot.forEach(doc => {
         userMap[doc.id] = { 
           ref: doc.ref, 
           data: { ...doc.data(), totalPoints: 0, stats: { perfect: 0, aggregate: 0, outcome: 0, missed: 0 } } 
         };
      });
      const fixturesSnapshot = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), where('status', '==', 'COMPLETED')));
      const predsSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'));

      predsSnapshot.forEach(predDoc => {
          const pData = predDoc.data();
          const matchDoc = fixturesSnapshot.docs.find(f => f.id === pData.matchId);
          if (matchDoc) {
              const result = matchDoc.data().result;
              const calculation = calculatePoints(pData.prediction, result, scoringRules);
              batch.update(predDoc.ref, { points: calculation.points, type: calculation.type });
              if (userMap[pData.userId]) {
                  const u = userMap[pData.userId].data;
                  u.totalPoints += calculation.points;
                  if (calculation.type.includes('Perfect')) u.stats.perfect++;
                  else if (calculation.type.includes('Aggregate')) u.stats.aggregate++;
                  else if (calculation.type.includes('Outcome')) u.stats.outcome++;
                  else u.stats.missed++;
              }
          }
      });
      Object.values(userMap).forEach(({ ref, data }) => batch.update(ref, { totalPoints: data.totalPoints, stats: data.stats }));
      await batch.commit();
      alert("Leaderboard fully recalculated!");
    } catch (e) { console.error(e); alert("Error recalculating: " + e.message); } 
    finally { setProcessing(false); }
  };

  const updateScoreLogic = async (match, home, away, penaltyWinner) => {
      const newResult = { home: home ?? null, away: away ?? null, penaltyWinner: penaltyWinner ?? null };
      const batch = writeBatch(db);
      const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'fixtures', match.id);
      batch.update(matchRef, { result: newResult, status: 'COMPLETED' });
      const predsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'), where('matchId', '==', match.id));
      const predsSnapshot = await getDocs(predsQuery);
      const usersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      const userMap = {};
      usersSnapshot.forEach(doc => { userMap[doc.id] = { ref: doc.ref, data: doc.data() }; });
      predsSnapshot.forEach((predDoc) => {
        const pData = predDoc.data();
        const oldPoints = pData.points || 0;
        const oldType = pData.type || 'Miss';
        const calculation = calculatePoints(pData.prediction, newResult, scoringRules);
        batch.update(predDoc.ref, { points: calculation.points, type: calculation.type });
        if (userMap[pData.userId]) {
          const u = userMap[pData.userId].data;
          u.totalPoints = (u.totalPoints || 0) - oldPoints + calculation.points;
          if (!u.stats) u.stats = { perfect: 0, aggregate: 0, outcome: 0, missed: 0 };
          if (oldPoints > 0 || oldType !== 'Miss') { 
             if (oldType.includes('Perfect')) u.stats.perfect = Math.max(0, (u.stats.perfect || 0) - 1);
             else if (oldType.includes('Aggregate')) u.stats.aggregate = Math.max(0, (u.stats.aggregate || 0) - 1);
             else if (oldType.includes('Outcome')) u.stats.outcome = Math.max(0, (u.stats.outcome || 0) - 1);
             else u.stats.missed = Math.max(0, (u.stats.missed || 0) - 1);
          }
          if (calculation.type.includes('Perfect')) u.stats.perfect = (u.stats.perfect || 0) + 1;
          else if (calculation.type.includes('Aggregate')) u.stats.aggregate = (u.stats.aggregate || 0) + 1;
          else if (calculation.type.includes('Outcome')) u.stats.outcome = (u.stats.outcome || 0) + 1;
          else u.stats.missed = (u.stats.missed || 0) + 1;
        }
      });
      Object.values(userMap).forEach(({ ref, data }) => {
        batch.update(ref, { totalPoints: data.totalPoints, stats: data.stats || {} });
      });
      await batch.commit();
  };

  const handleUpdateScore = async (match, home, away, penaltyWinner) => {
    if (processing) return;
    setProcessing(true);
    try {
      await updateScoreLogic(match, home, away, penaltyWinner);
      alert("Score updated & Leaderboard adjusted!");
    } catch (e) { console.error(e); alert("Error: " + e.message); } 
    finally { setProcessing(false); }
  };

  const activeFixtures = fixtures.filter(f => f.stageId === selectedStageId);

  // Admin user selection
  const availableUsersForAdmin = allUsers ? allUsers.filter(u => !adminList.includes(u.email)) : [];

  return (
    <div className="pb-20">
      <header className={`p-4 flex justify-between items-center sticky top-0 z-20 border-b ${isContrast ? 'bg-white border-black border-b-2' : isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
        <h2 className="text-amber-500 font-bold flex items-center gap-2"><Settings size={18} /> Admin Console</h2>
        <div className="flex items-center gap-3">
             <button onClick={handleExportData} disabled={processing} className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${isContrast ? 'bg-white border-black text-black hover:bg-gray-200' : isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-blue-900 hover:text-blue-200' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`} title="Download Backup CSV">
               <Download size={14} className={processing ? 'animate-spin' : ''}/> {processing ? '...' : 'Export'}
             </button>
             <button onClick={handleRecalculateAll} disabled={processing} className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${isContrast ? 'bg-white border-black text-black hover:bg-gray-200' : isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-red-900 hover:text-red-200' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-red-100 hover:text-red-600'}`} title="Reset & Recalculate All Scores">
               <RefreshCw size={14} className={processing ? 'animate-spin' : ''}/> {processing ? '...' : 'Recalc'}
             </button>
             <button onClick={onClose} className={`text-xs font-bold ${isContrast ? 'text-black' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Exit</button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button onClick={() => setActiveTab('fixtures')} className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'fixtures' ? (isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-500 text-white') : (isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border border-gray-300 text-gray-600')}`}>Fixtures</button>
          <button onClick={() => setActiveTab('leagues')} className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'leagues' ? (isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-500 text-white') : (isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border border-gray-300 text-gray-600')}`}>Leagues</button>
          <button onClick={() => setActiveTab('content')} className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'content' ? (isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-500 text-white') : (isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border border-gray-300 text-gray-600')}`}>App Content</button>
          <button onClick={() => setActiveTab('admins')} className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'admins' ? (isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-500 text-white') : (isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border border-gray-300 text-gray-600')}`}>Admins</button>
        </div>

        {activeTab === 'fixtures' && (
          <>
            {/* Stage Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {STAGES.map(stage => (
                    <button key={stage.id} onClick={() => setSelectedStageId(stage.id)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedStageId === stage.id ? (isContrast ? 'bg-black text-white border-black' : 'bg-emerald-500 text-white border-emerald-500') : (isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-gray-600 border-gray-300')}`}>{stage.name}</button>
                ))}
            </div>

            {/* Add Match / Bulk Import */}
             <div className={`p-4 rounded-xl border space-y-4 ${isContrast ? 'bg-white border-2 border-black' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                {/* Manual Add */}
                <div>
                  <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-emerald-500'}`}><Plus size={14}/> Add Match</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                      <input className={`border rounded p-2 text-sm ${isContrast ? 'bg-white border-black border-2 text-black' : isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Team A" value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
                      <input className={`border rounded p-2 text-sm ${isContrast ? 'bg-white border-black border-2 text-black' : isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Team B" value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
                      <input className={`border rounded p-2 text-sm ${isContrast ? 'bg-white border-black border-2 text-black' : isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Date" value={newMatch.date} onChange={e => setNewMatch({...newMatch, date: e.target.value})} />
                      <input className={`border rounded p-2 text-sm ${isContrast ? 'bg-white border-black border-2 text-black' : isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
                  </div>
                  <button onClick={handleAddMatch} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-300'}`}>Add to Schedule</button>
                </div>

                {/* Bulk Fixture Import */}
                <div className={`pt-4 border-t ${isContrast ? 'border-black' : isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-blue-500'}`}><Upload size={14}/> Bulk Import Fixtures</h4>
                    <textarea className={`w-full h-16 rounded p-2 text-xs mb-2 border ${isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`} placeholder="Paste: TeamA  TeamB  Date  Time" value={importText} onChange={e => setImportText(e.target.value)} />
                    {parsedMatches.length > 0 ? (
                       <button onClick={confirmImport} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>Confirm {parsedMatches.length} Fixtures</button>
                    ) : (
                      <button onClick={parseImport} disabled={!importText} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm disabled:opacity-50 ${isContrast ? 'bg-white text-black border-2 border-black hover:bg-gray-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Parse Fixtures</button>
                    )}
                </div>

                {/* Bulk RESULT Import */}
                <div className={`pt-4 border-t ${isContrast ? 'border-black' : isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-green-500'}`}><ClipboardList size={14}/> Bulk Result Update</h4>
                    <textarea className={`w-full h-16 rounded p-2 text-xs mb-2 border ${isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`} placeholder="Paste: TeamA 2-1 TeamB" value={resultsText} onChange={e => setResultsText(e.target.value)} />
                    {parsedResults.length > 0 ? (
                       <button onClick={confirmResults} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-green-600 text-white hover:bg-green-500'}`}>Confirm {parsedResults.length} Results</button>
                    ) : (
                      <button onClick={parseResults} disabled={!resultsText} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm disabled:opacity-50 ${isContrast ? 'bg-white text-black border-2 border-black hover:bg-gray-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Parse Results</button>
                    )}
                </div>
            </div>

            {/* List Matches */}
            <div className="space-y-3">
                {activeFixtures.map(match => (
                    <div key={match.id} className={`border p-3 rounded-xl flex flex-col gap-3 ${isContrast ? 'bg-white border-2 border-black' : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex-1">
                                <div className={`flex items-center gap-2 font-bold text-sm mb-1 ${isContrast ? 'text-black' : isDark ? 'text-white' : 'text-gray-900'}`}>{match.teamA} <span className="text-slate-400 text-xs">vs</span> {match.teamB}</div>
                                <div className="text-xs text-slate-500">{match.date} • {match.time}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center gap-1 p-1 rounded border ${isContrast ? 'bg-white border-black' : isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
                                  <input disabled={processing} type="number" className={`w-8 bg-transparent text-center text-xs focus:outline-none ${isContrast ? 'text-black font-bold' : isDark ? 'text-white' : 'text-gray-900'}`} placeholder="H" defaultValue={match.result?.home} onBlur={(e) => handleUpdateScore(match, e.target.value, match.result?.away, match.result?.penaltyWinner)} />
                                  <span className="text-slate-400">:</span>
                                  <input disabled={processing} type="number" className={`w-8 bg-transparent text-center text-xs focus:outline-none ${isContrast ? 'text-black font-bold' : isDark ? 'text-white' : 'text-gray-900'}`} placeholder="A" defaultValue={match.result?.away} onBlur={(e) => handleUpdateScore(match, match.result?.home, e.target.value, match.result?.penaltyWinner)} />
                              </div>
                              <button onClick={() => handleDeleteMatch(match.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className={`flex items-center gap-2 text-xs pt-2 border-t ${isContrast ? 'border-black' : isDark ? 'border-slate-700/50' : 'border-gray-100'}`}>
                            <span className={`font-bold ${isContrast ? 'text-black' : 'text-slate-400'}`}>Penalties?</span>
                            <button onClick={() => handleUpdateScore(match, match.result?.home, match.result?.away, match.result?.penaltyWinner === 'home' ? null : 'home')} className={`px-2 py-1 rounded border ${match.result?.penaltyWinner === 'home' ? (isContrast ? 'bg-black text-white' : 'bg-emerald-500 text-white border-emerald-500') : (isContrast ? 'border-black text-black' : isDark ? 'border-slate-600 text-slate-400' : 'border-gray-300 text-gray-500')}`}>{match.teamA} Wins</button>
                            <button onClick={() => handleUpdateScore(match, match.result?.home, match.result?.away, match.result?.penaltyWinner === 'away' ? null : 'away')} className={`px-2 py-1 rounded border ${match.result?.penaltyWinner === 'away' ? (isContrast ? 'bg-black text-white' : 'bg-emerald-500 text-white border-emerald-500') : (isContrast ? 'border-black text-black' : isDark ? 'border-slate-600 text-slate-400' : 'border-gray-300 text-gray-500')}`}>{match.teamB} Wins</button>
                        </div>
                    </div>
                ))}
            </div>
          </>
        )}

        {activeTab === 'leagues' && (
          <div className="space-y-3">
             {leagues.map(league => (
               <div key={league.id} className={`p-3 rounded-xl border flex justify-between items-center ${isContrast ? 'bg-white border-2 border-black' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                 <div>
                   <div className={`font-bold ${isContrast ? 'text-black' : isDark ? 'text-white' : 'text-gray-900'}`}>{league.name}</div>
                   <div className={`text-xs ${isContrast ? 'text-black' : 'text-slate-500'}`}>{league.members.length} members</div>
                 </div>
                 <button onClick={() => handleDeleteLeague(league.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded"><Trash2 size={18} /></button>
               </div>
             ))}
             {leagues.length === 0 && <div className={`text-center py-8 ${isContrast ? 'text-black' : 'text-slate-500'}`}>No leagues created yet.</div>}
          </div>
        )}

        {activeTab === 'content' && (
           <div className={`p-4 rounded-xl border space-y-4 ${isContrast ? 'bg-white border-2 border-black' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-emerald-500'}`}><FileText size={14}/> Edit Help & Rules</h4>
              <textarea 
                 className={`w-full h-64 rounded p-3 text-sm mb-3 border ${isContrast ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-900 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-300'}`}
                 value={helpText}
                 onChange={e => setHelpText(e.target.value)}
                 placeholder="Enter app rules here..."
              />
              <button onClick={handleSaveHelp} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>Save Content</button>
              
              {/* Scoring Rules inside Content Tab (Optional Duplicate, but requested in previous turns to be editable) */}
              <div className="pt-4 border-t border-gray-700">
                  <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-emerald-500'}`}>Scoring Rules</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {Object.keys(DEFAULT_SCORING).map(key => (
                      <div key={key} className="space-y-1">
                        <label className={`text-[10px] uppercase font-bold ${isContrast ? 'text-black' : isDark ? 'text-slate-500' : 'text-gray-500'}`}>{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                        <input type="number" className={`w-full border rounded p-2 text-sm ${isContrast ? 'bg-white border-black text-black border-2' : isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={scoringRules[key] || 0} onChange={(e) => setScoringRules({...scoringRules, [key]: parseInt(e.target.value)})} />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveRules} className={`w-full font-bold py-2 rounded-lg transition-colors text-sm ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>Save Scoring Rules</button>
              </div>
           </div>
        )}

        {activeTab === 'admins' && (
           <div className={`p-4 rounded-xl border space-y-4 ${isContrast ? 'bg-white border-2 border-black' : isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
               <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isContrast ? 'text-black' : 'text-emerald-500'}`}><Shield size={14}/> Manage Admins</h4>
               
               <div className="flex gap-2 mb-4">
                 <select 
                    className={`flex-1 border rounded p-2 text-sm ${isContrast ? 'bg-white border-black text-black border-2' : isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                 >
                    <option value="">Select a user to add...</option>
                    {availableUsersForAdmin.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                 </select>
                 <button onClick={handleAddAdmin} className={`px-4 rounded font-bold text-xs ${isContrast ? 'bg-black text-white border-2 border-black' : 'bg-emerald-600 text-white'}`}>Add</button>
               </div>

               <div className="space-y-2">
                 {/* Hardcoded Super Admin */}
                 <div className={`p-2 rounded flex justify-between items-center ${isContrast ? 'bg-gray-100 border border-black' : isDark ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                    <span className={`text-sm ${isContrast ? 'text-black font-bold' : isDark ? 'text-white' : 'text-gray-900'}`}>{ADMIN_EMAIL} <span className="text-[10px] opacity-60">(Owner)</span></span>
                    <Shield size={14} className="text-emerald-500" />
                 </div>
                 
                 {/* Additional Admins */}
                 {adminList.filter(e => e !== ADMIN_EMAIL).map(email => (
                    <div key={email} className={`p-2 rounded flex justify-between items-center ${isContrast ? 'border border-black' : isDark ? 'bg-slate-800' : 'bg-white border border-gray-200'}`}>
                      <span className={`text-sm ${isContrast ? 'text-black' : isDark ? 'text-slate-300' : 'text-gray-700'}`}>{email}</span>
                      <button onClick={() => handleRemoveAdmin(email)} className="text-red-500 hover:bg-red-500/10 p-1 rounded"><Trash2 size={14} /></button>
                    </div>
                 ))}
               </div>
           </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = ({ user, onLogout, musicProps, theme, toggleTheme }) => {
  const [fixtures, setFixtures] = useState([]);
  const [myPredictions, setMyPredictions] = useState({});
  const [stagedPredictions, setStagedPredictions] = useState({}); 
  const [leaderboard, setLeaderboard] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [leagues, setLeagues] = useState([]);
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showFullTable, setShowFullTable] = useState(false);
  const [showLeagueManager, setShowLeagueManager] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
  
  // NEW STATES for features
  const [adminList, setAdminList] = useState([ADMIN_EMAIL]);
  const [viewMatchPredictions, setViewMatchPredictions] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false); // Added state for StatsModal

  const isContrast = theme === 'contrast';
  const isDark = theme === 'dark';
  const isTron = theme === 'tron';
  const isMario = theme === 'mario';

  // --- DATA SYNC ---
  useEffect(() => {
    if (!user) return;

    const unsubFixtures = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), orderBy('timestamp')), (snap) => {
        const sortedList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        sortedList.sort(sortFixturesByDate); 
        setFixtures(sortedList);
    });

    const unsubUsers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), orderBy('totalPoints', 'desc')), (snap) => {
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Apply custom sort: Points > Perfect > Aggregate > Outcome > Alphabetical
        users.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if ((b.stats?.perfect || 0) !== (a.stats?.perfect || 0)) return (b.stats?.perfect || 0) - (a.stats?.perfect || 0);
            if ((b.stats?.aggregate || 0) !== (a.stats?.aggregate || 0)) return (b.stats?.aggregate || 0) - (a.stats?.aggregate || 0);
            if ((b.stats?.outcome || 0) !== (a.stats?.outcome || 0)) return (b.stats?.outcome || 0) - (a.stats?.outcome || 0);
            return a.name.localeCompare(b.name);
        });
        setLeaderboard(users);
        setAllUsers(users);
    });

    const unsubLeagues = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'leagues'), (snap) => {
        setLeagues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qPreds = query(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'), where('userId', '==', user.uid));
    const unsubPreds = onSnapshot(qPreds, (snap) => {
        const preds = {};
        snap.docs.forEach(d => { 
            const data = d.data();
            preds[data.matchId] = { ...data.prediction, points: data.points, type: data.type }; 
        });
        setMyPredictions(preds);
        setStagedPredictions(preds); 
    });

    // NEW: Fetch Admin List
    const unsubAdmins = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admins'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminList(docSnap.data().list || [ADMIN_EMAIL]);
      }
    });

    return () => { unsubFixtures(); unsubUsers(); unsubPreds(); unsubLeagues(); unsubAdmins(); };
  }, [user]);

  // --- HANDLERS ---

  const handleStagePredict = (matchId, key, val) => {
    const intVal = parseInt(val);

    if (val === "") {
        const currentPred = stagedPredictions[matchId] || { home: '', away: '', penaltyWinner: null };
        const newPred = { ...currentPred, [key]: val };
        setStagedPredictions(prev => ({ ...prev, [matchId]: newPred }));
        return;
    }
    
    if (isNaN(intVal) || intVal < 0 || intVal > 20) return;

    const currentPred = stagedPredictions[matchId] || { home: '', away: '', penaltyWinner: null };
    const newPred = { ...currentPred, [key]: val };
    setStagedPredictions(prev => ({ ...prev, [matchId]: newPred }));
  };

  const handleSubmitPredictions = async () => {
    setSubmitting(true);
    try {
        const batch = writeBatch(db);
        Object.entries(stagedPredictions).forEach(([matchId, predictionData]) => {
            const { points, type, ...cleanPrediction } = predictionData;
            const { points: dbPoints, type: dbType, ...cleanDbPrediction } = myPredictions[matchId] || {};

            if (JSON.stringify(cleanPrediction) !== JSON.stringify(cleanDbPrediction)) {
                const docId = `${matchId}_${user.uid}`;
                batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'predictions', docId), {
                    matchId, userId: user.uid, prediction: cleanPrediction, userName: user.displayName
                }, { merge: true });
            }
        });
        await batch.commit();
        alert("Predictions submitted successfully!");
    } catch (error) {
        console.error("Error submitting:", error);
        alert("Error saving predictions.");
    } finally { setSubmitting(false); }
  };

  // --- EXPORT DATA ---
  const handleExportData = async () => {
    try {
      // 1. Fetch ALL needed data
      const [usersSnap, fixturesSnap, predsSnap] = await Promise.all([
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users')),
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures')),
        getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'))
      ]);

      const users = {};
      usersSnap.forEach(d => users[d.id] = d.data().name);

      const fixtures = {};
      fixturesSnap.forEach(d => fixtures[d.id] = d.data());

      // 2. Build CSV Content
      const header = ["MatchID", "Stage", "HomeTeam", "AwayTeam", "Date", "Time", "PlayerName", "PredHome", "PredAway", "PredPens", "Points", "Type"];
      const rows = [header.join(",")];

      predsSnap.forEach(doc => {
        const p = doc.data();
        const match = fixtures[p.matchId];
        const playerName = users[p.userId] || "Unknown";

        if (match) {
          const row = [
            p.matchId,
            match.stageId,
            match.teamA,
            match.teamB,
            match.date,
            match.time,
            playerName,
            p.prediction.home,
            p.prediction.away,
            p.prediction.penaltyWinner || "",
            p.points || 0,
            p.type || ""
          ];
          rows.push(row.map(cell => `"${cell}"`).join(","));
        }
      });

      // 3. Download
      const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "mesh_predictor_backup.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (e) {
      alert("Export failed: " + e.message);
    }
  };

  const activeFixtures = fixtures.filter(f => {
      const stage = STAGES.find(s => s.id === f.stageId);
      return stage?.status !== 'PAST';
  });

  const visibleFixtures = activeFixtures.filter(match => {
      if (showCompleted) return true;
      const isComplete = match.status === 'COMPLETED' || match.result;
      return !isComplete;
  });

  const hasChanges = Object.keys(stagedPredictions).some(key => {
      const { points: p1, type: t1, ...s } = stagedPredictions[key] || {};
      const { points: p2, type: t2, ...d } = myPredictions[key] || {};
      return JSON.stringify(s) !== JSON.stringify(d);
  });

  // Updated Admin Check
  const isAdmin = adminList.includes(user.email) || user.email === ADMIN_EMAIL;

  if (isAdminMode) return <AdminDashboard fixtures={fixtures} onClose={() => setIsAdminMode(false)} theme={theme} allUsers={allUsers} />;

  const myStats = leaderboard.find(u => u.email === user.email);
  const myLeagues = leagues.filter(l => l.members.includes(user.uid));

  return (
    <div className={`pb-24 min-h-screen ${isContrast ? 'bg-white' : isTron ? 'bg-gray-950 text-cyan-100' : isMario ? 'bg-sky-200' : isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
      <AnimationStyles />
      {/* {showPitchInvasion && <PitchInvasion onClose={() => setShowPitchInvasion(false)} />} */}
      {/* {showVarCheck && <VarOverlay />} */}

      <header className={`sticky top-0 z-20 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center shadow-lg relative ${
        isContrast ? 'bg-white border-black border-b-2' :
        isTron ? 'bg-gray-900/90 border-cyan-500/50 border-b shadow-[0_0_15px_rgba(6,182,212,0.3)]' :
        isMario ? 'bg-red-600 border-yellow-400 border-b-4' :
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="flex items-center gap-2 cursor-pointer">
          <span className="text-2xl select-none">⚽</span>
          <h1 className={`text-sm md:text-lg font-bold tracking-wide truncate ${
             isContrast ? 'text-black' : 
             isTron ? 'text-cyan-400 font-mono tracking-widest' :
             isMario ? 'text-white drop-shadow-md font-black italic' :
             isDark ? 'text-white' : 'text-gray-900'
          }`}>Mesh <span className={`${isMario ? 'text-yellow-300' : isTron ? 'text-white' : 'text-emerald-500'}`}>Predictor</span></h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          <button onClick={handleExportData} className={`p-2 rounded-full transition-colors ${isContrast ? 'text-black border-2 border-black hover:bg-gray-200' : isTron ? 'text-cyan-500 border border-cyan-800 hover:bg-cyan-900/30' : isMario ? 'text-white hover:text-yellow-200 border-2 border-white/20' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} title="Export Predictions"><Download size={18} /></button>
          <button onClick={() => setShowHelpModal(true)} className={`p-2 rounded-full transition-colors ${isContrast ? 'text-black border-2 border-black hover:bg-gray-200' : isTron ? 'text-cyan-500 border border-cyan-800 hover:bg-cyan-900/30' : isMario ? 'text-white hover:text-yellow-200 border-2 border-white/20' : isDark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} title="Help & Rules"><HelpCircle size={18} /></button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <MusicToggle {...musicProps} theme={theme} />
          {isAdmin && (
              <button onClick={() => setIsAdminMode(true)} className={`p-2 rounded-full border ${isContrast ? 'bg-white border-black text-black hover:bg-gray-200' : isTron ? 'bg-gray-900 text-cyan-400 border-cyan-500 hover:shadow-[0_0_10px_cyan]' : isMario ? 'bg-white text-black border-black border-2' : isDark ? 'bg-slate-800 text-amber-400 border-amber-400/30' : 'bg-white text-amber-500 border-amber-500/30'}`} title="Admin">
                  <Settings size={16} />
              </button>
          )}
          <button 
            onClick={() => setShowLeagueManager(true)}
            className={`p-2 rounded-full border transition-colors ${isContrast ? 'bg-white border-black text-black hover:bg-gray-200' : isTron ? 'text-cyan-400 border-cyan-500/50 hover:bg-cyan-900/20' : isMario ? 'bg-yellow-400 text-black border-black border-2 hover:bg-yellow-300' : isDark ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-gray-50'}`}
            title="Users & Leagues"
          >
            <Users size={16} />
          </button>
          <button 
            onClick={() => setShowProfileModal(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border flex items-center gap-2 transition-colors ${
              isContrast ? 'bg-white border-black text-black hover:bg-gray-200' : 
              isTron ? 'bg-gray-900 text-cyan-400 border-cyan-500/50 hover:shadow-[0_0_10px_cyan]' :
              isMario ? 'bg-white border-2 border-black text-black hover:bg-gray-100' :
              isDark ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-gray-50'
            }`}
          >
            <Avatar url={myStats?.avatarUrl} name={myStats?.name} size="sm" />
            <span>{myStats?.totalPoints || 0} PTS</span>
          </button>
          <button onClick={() => signOut(auth)} className={`p-2 hover:text-red-500 ${isContrast ? 'text-black' : isTron ? 'text-cyan-700 hover:text-red-400' : isMario ? 'text-white hover:text-yellow-200' : isDark ? 'text-slate-400' : 'text-gray-400'}`}><LogOut size={18} /></button>
        </div>

        {/* Mobile Menu Toggle + Points Badge */}
        <div className="flex md:hidden items-center gap-2">
           <button 
            onClick={() => setShowProfileModal(true)}
            className={`px-2 py-1 rounded-full text-xs font-mono border flex items-center gap-2 ${isContrast ? 'bg-white text-black border-black' : isTron ? 'bg-gray-900 text-cyan-400 border-cyan-500' : isMario ? 'bg-white text-black border-2 border-black' : isDark ? 'bg-slate-800 text-emerald-400 border-emerald-500/30' : 'bg-white text-emerald-600 border-emerald-200'}`}
          >
            <Avatar url={myStats?.avatarUrl} name={myStats?.name} size="sm" />
            <span>{myStats?.totalPoints || 0}</span>
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`p-2 rounded-md ${isContrast ? 'text-black' : isTron ? 'text-cyan-400' : isMario ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className={`absolute top-full right-0 w-64 p-4 border-b border-l shadow-2xl flex flex-col gap-3 z-50 ${
            isContrast ? 'bg-white border-black border-2' : 
            isTron ? 'bg-gray-900 border-cyan-500 border-l border-b' :
            isMario ? 'bg-yellow-100 border-4 border-yellow-500' :
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
          }`}>
             <div className="flex justify-between items-center">
                <span className={`text-xs font-bold uppercase ${isContrast ? 'text-black' : isTron ? 'text-cyan-600' : isMario ? 'text-red-600' : isDark ? 'text-slate-500' : 'text-gray-500'}`}>Menu</span>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
             </div>
             
             <button onClick={() => { setShowHelpModal(true); setIsMobileMenuOpen(false); }} className={`w-full text-left p-2 rounded flex items-center gap-3 ${isContrast ? 'text-black hover:bg-gray-100' : isTron ? 'text-cyan-400 hover:bg-cyan-900/30' : isMario ? 'text-black hover:bg-white/50' : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
                <HelpCircle size={18} /> Help & Rules
             </button>

             <button onClick={() => { handleExportData(); setIsMobileMenuOpen(false); }} className={`w-full text-left p-2 rounded flex items-center gap-3 ${isContrast ? 'text-black hover:bg-gray-100' : isTron ? 'text-cyan-400 hover:bg-cyan-900/30' : isMario ? 'text-black hover:bg-white/50' : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
                <Download size={18} /> Export Predictions
             </button>

             <div className={`flex justify-between items-center p-2 rounded border cursor-pointer ${isContrast ? 'border-black hover:bg-gray-100' : isTron ? 'border-cyan-900 hover:bg-cyan-900/20' : isMario ? 'border-yellow-500 bg-white/50' : 'border-transparent hover:border-slate-700'}`} onClick={() => musicProps.onToggle()}>
                <span className={`text-sm font-medium ${isContrast ? 'text-black' : isTron ? 'text-cyan-100' : isMario ? 'text-black' : isDark ? 'text-white' : 'text-gray-900'}`}>Theme Music</span>
                <MusicToggle {...musicProps} theme={theme} />
             </div>

             {isAdmin && (
               <button onClick={() => { setIsAdminMode(true); setIsMobileMenuOpen(false); }} className={`w-full text-left p-2 rounded flex items-center gap-3 ${isContrast ? 'text-black font-bold hover:bg-gray-100' : isTron ? 'text-cyan-400 hover:bg-cyan-900/30' : isMario ? 'text-black hover:bg-white/50' : isDark ? 'text-amber-400 hover:bg-slate-800' : 'text-amber-600 hover:bg-gray-100'}`}>
                 <Settings size={18} /> Admin Console
               </button>
             )}

             <button onClick={() => { setShowLeagueManager(true); setIsMobileMenuOpen(false); }} className={`w-full text-left p-2 rounded flex items-center gap-3 ${isContrast ? 'text-black font-bold hover:bg-gray-100' : isTron ? 'text-cyan-400 hover:bg-cyan-900/30' : isMario ? 'text-black hover:bg-white/50' : isDark ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-gray-100'}`}>
               <Users size={18} /> My Leagues
             </button>

             <button onClick={() => signOut(auth)} className={`w-full text-left p-2 rounded flex items-center gap-3 ${isContrast ? 'text-red-600 font-bold hover:bg-gray-100' : isTron ? 'text-cyan-700 hover:bg-cyan-900/30' : isMario ? 'text-red-600 hover:bg-white/50' : isDark ? 'text-red-400 hover:bg-slate-800' : 'text-red-600 hover:bg-gray-100'}`}>
               <LogOut size={18} /> Log Out
             </button>
          </div>
        )}
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        
        {/* Leaderboard (Moved to Top) */}
        <section>
             <div className="flex justify-between items-end mb-3 px-1">
                <h2 className={`text-xs font-bold uppercase tracking-wider ${isContrast ? 'text-black' : isTron ? 'text-cyan-500' : isMario ? 'text-blue-700' : isDark ? 'text-slate-500' : 'text-gray-500'}`}>Leaderboard</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowStatsModal(true)} className={`text-xs font-bold flex items-center gap-1 ${isContrast ? 'text-black hover:underline' : isTron ? 'text-cyan-400 hover:text-white' : isMario ? 'text-red-600 bg-white px-2 py-1 rounded-full border-2 border-black hover:scale-105' : 'text-blue-500 hover:text-blue-400'}`}>
                      <TrendingUp size={12} /> View Graph
                  </button>
                  <button onClick={() => setShowFullTable(true)} className={`text-xs font-bold flex items-center gap-1 ${isContrast ? 'text-black hover:underline' : isTron ? 'text-cyan-400 hover:text-white' : isMario ? 'text-red-600 bg-white px-2 py-1 rounded-full border-2 border-black hover:scale-105' : 'text-emerald-500 hover:text-emerald-400'}`}>
                      View Full Table <ChevronRight size={12} />
                  </button>
                </div>
            </div>
            <div className={`rounded-xl border overflow-hidden ${
              isContrast ? 'bg-white border-black border-2' : 
              isTron ? 'bg-gray-900 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]' :
              isMario ? 'bg-white border-4 border-yellow-400' :
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
            }`}>
                {leaderboard.slice(0, 5).map((player, idx) => (
                    <div 
                      key={player.id || idx} 
                      onClick={() => setSelectedPlayer(player)}
                      className={`flex justify-between p-3 border-b last:border-0 cursor-pointer transition-colors ${
                        isContrast ? 'border-black hover:bg-gray-100 text-black' : 
                        isTron ? 'border-cyan-900 hover:bg-cyan-900/30 text-cyan-100' :
                        isMario ? 'border-yellow-200 hover:bg-yellow-50 text-gray-900' :
                        isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50'
                      } ${player.email === user.email ? (isContrast ? 'bg-gray-100' : isTron ? 'bg-cyan-900/40' : isMario ? 'bg-yellow-100' : isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`font-mono w-6 text-center ${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-600' : isMario ? 'text-red-500 font-black' : 'text-slate-500'}`}>{idx + 1}</span>
                            <div className="flex items-center gap-2">
                               <Avatar url={player.avatarUrl} name={player.name} size="sm" />
                               <span className={`font-bold ${isContrast ? 'text-black' : isTron ? 'text-cyan-100 font-mono' : isMario ? 'text-gray-900' : isDark ? 'text-white' : 'text-gray-900'}`}>{player.name} {player.email === user.email && '(You)'}</span>
                            </div>
                        </div>
                        <span className={`font-bold ${isContrast ? 'text-black' : isTron ? 'text-cyan-400' : isMario ? 'text-green-600' : 'text-emerald-500'}`}>{player.totalPoints} pts</span>
                    </div>
                ))}
            </div>
        </section>

        {/* Fixtures */}
        <section>
           <div className="flex justify-between items-end mb-3 px-1">
            <div>
                <h2 className={`text-xs font-bold uppercase tracking-wider ${isContrast ? 'text-black' : isTron ? 'text-cyan-500' : isMario ? 'text-blue-700' : isDark ? 'text-slate-500' : 'text-gray-500'}`}>Your Predictions</h2>
            </div>
            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                isContrast ? 'bg-white border-black text-black font-bold hover:bg-gray-200' : 
                isTron ? 'bg-gray-900 border-cyan-700 text-cyan-400 hover:bg-cyan-900/50' :
                isMario ? 'bg-white border-2 border-black text-black font-bold hover:bg-gray-100' :
                isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
              }`}
            >
              {showCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
          </div>
          <div className="space-y-4">
            {visibleFixtures.length === 0 && <div className={`p-8 text-center text-sm rounded-xl border ${isContrast ? 'bg-white border-black text-black font-bold' : isTron ? 'bg-gray-900 border-cyan-900 text-cyan-700' : isMario ? 'bg-white border-4 border-dashed border-gray-300 text-gray-400' : isDark ? 'bg-slate-800/50 text-slate-500 border-slate-800' : 'bg-white text-gray-400 border-gray-200'}`}>No matches to show.</div>}
            {visibleFixtures.map((match) => {
               const isKnockout = STAGES.find(s => s.id === match.stageId)?.type === 'knockout';
               const pastDeadline = isPastDeadline(match.date);
               const isLocked = match.status === 'COMPLETED' || match.result || pastDeadline; 
               const myPred = myPredictions[match.id];

               return (
              <div key={match.id} className={`rounded-xl overflow-hidden border shadow-lg relative transition-all ${
                isContrast ? 'bg-white border-black border-2' : 
                isTron ? `bg-gray-900 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)] ${isLocked ? 'opacity-60 grayscale' : ''}` :
                isMario ? 'bg-white border-4 border-yellow-400' :
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
              } ${isLocked && !isTron ? 'opacity-90' : ''}`}>
                 
                 {/* Bus Animation */}
                 {/* {busAnimationMatchId === match.id && (
                   <div className="absolute bottom-4 left-0 w-full h-12 z-20 overflow-hidden pointer-events-none">
                     <div className="animate-bus-enter text-4xl">🚌</div>
                   </div>
                 )} */}

                 {isLocked && (
                    <div className={`absolute inset-0 z-10 pointer-events-none ${isContrast ? 'bg-gray-100/10' : isTron ? 'bg-black/50' : isMario ? 'bg-black/5' : isDark ? 'bg-black/40' : 'bg-gray-200/40'}`} />
                 )}
                 <div className={`p-2.5 border-b flex justify-between items-center ${
                   isLocked 
                    ? (isContrast ? 'bg-gray-200 border-black' : isTron ? 'bg-gray-950 border-cyan-900' : isMario ? 'bg-gray-200 border-gray-300' : isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-200 border-gray-300')
                    : (isContrast ? 'bg-white border-black text-black' : isTron ? 'bg-gray-900 border-cyan-900' : isMario ? 'bg-red-600 text-white border-yellow-400 border-b-4' : isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-gray-50 border-gray-100')
                 }`}>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${isContrast ? 'bg-black text-white' : isTron ? 'bg-cyan-900 text-cyan-400' : isMario ? 'bg-yellow-400 text-red-600' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>{STAGES.find(s=>s.id===match.stageId)?.name.replace('Group Stage - ', '')}</span>
                    <div className="flex items-center gap-2">
                         {/* Locked View Predictions Button */}
                         {isLocked && (
                           <button 
                             onClick={() => setViewMatchPredictions(match)}
                             className={`pointer-events-auto relative z-20 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors ${isContrast ? 'bg-white text-black border-black hover:bg-gray-200' : isTron ? 'bg-cyan-950 text-cyan-400 border-cyan-600 hover:bg-cyan-900' : isMario ? 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50' : isDark ? 'bg-slate-800 text-emerald-400 border-slate-600 hover:bg-slate-700' : 'bg-white text-emerald-600 border-gray-300 hover:bg-gray-100'}`}
                           >
                             <Eye size={12} /> View Predictions
                           </button>
                         )}
                         {isLocked && <Lock size={12} className="text-red-500" />}
                         <span className={`text-xs font-mono ${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-600' : isMario ? 'text-white' : 'text-slate-500'}`}>{match.date} {match.time}</span>
                    </div>
                 </div>
                 <div className={`p-5 ${isLocked && (isContrast ? 'bg-gray-100' : isDark ? 'bg-slate-900/30' : 'bg-gray-50')}`}>
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex flex-col items-center w-1/3">
                          <span className={`font-bold text-sm mb-2 ${isContrast ? 'text-black' : isTron ? 'text-cyan-400' : isMario ? 'text-gray-900 font-black' : isDark ? 'text-white' : 'text-gray-900'}`}>{match.teamA}</span>
                          <input 
                              type="number" 
                              disabled={isLocked}
                              className={`w-12 h-12 border rounded-lg text-center text-xl font-bold outline-none disabled:opacity-100 ${
                                isLocked 
                                  ? (isContrast ? 'bg-white border-black text-black' : isTron ? 'bg-gray-900 border-cyan-900 text-cyan-700' : isMario ? 'bg-gray-100 border-gray-300 text-gray-500' : isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-400') 
                                  : (
                                    isContrast ? 'bg-white border-black text-black focus:bg-yellow-100 border-2' : 
                                    isTron ? 'bg-gray-950 border-cyan-500 text-cyan-400 focus:shadow-[0_0_10px_cyan] font-mono' :
                                    isMario ? 'bg-white border-4 border-black rounded-xl focus:border-yellow-400' :
                                    isDark ? 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
                                  )
                              }`}
                              value={stagedPredictions[match.id]?.home || ''} 
                              onChange={e => handleStagePredict(match.id, 'home', e.target.value)} 
                              style={isLocked && isContrast ? { WebkitTextFillColor: 'black', opacity: 1 } : {}}
                          />
                      </div>
                      <span className={`${isContrast ? 'text-black font-bold' : isTron ? 'text-cyan-700' : 'text-slate-500'}`}>:</span>
                      <div className="flex flex-col items-center w-1/3">
                          <span className={`font-bold text-sm mb-2 ${isContrast ? 'text-black' : isTron ? 'text-cyan-400' : isMario ? 'text-gray-900 font-black' : isDark ? 'text-white' : 'text-gray-900'}`}>{match.teamB}</span>
                          <input 
                              type="number" 
                              disabled={isLocked}
                              className={`w-12 h-12 border rounded-lg text-center text-xl font-bold outline-none disabled:opacity-100 ${
                                isLocked 
                                  ? (isContrast ? 'bg-white border-black text-black' : isTron ? 'bg-gray-900 border-cyan-900 text-cyan-700' : isMario ? 'bg-gray-100 border-gray-300 text-gray-500' : isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-400') 
                                  : (
                                    isContrast ? 'bg-white border-black text-black focus:bg-yellow-100 border-2' : 
                                    isTron ? 'bg-gray-950 border-cyan-500 text-cyan-400 focus:shadow-[0_0_10px_cyan] font-mono' :
                                    isMario ? 'bg-white border-4 border-black rounded-xl focus:border-yellow-400' :
                                    isDark ? 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'
                                  )
                              }`}
                              value={stagedPredictions[match.id]?.away || ''} 
                              onChange={e => handleStagePredict(match.id, 'away', e.target.value)} 
                              style={isLocked && isContrast ? { WebkitTextFillColor: 'black', opacity: 1 } : {}}
                           />
                      </div>
                   </div>
                   
                   {/* Knockout Penalty Prediction */}
                   {isKnockout && (
                     <div className={`rounded p-3 text-center border ${isContrast ? 'bg-white border-black border-2' : isTron ? 'bg-cyan-900/10 border-cyan-800' : isMario ? 'bg-yellow-100 border-4 border-yellow-400' : isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-gray-50 border-gray-100'} ${isLocked ? 'opacity-75' : ''}`}>
                        <div className={`text-[10px] uppercase font-bold mb-2 ${isContrast ? 'text-black' : isTron ? 'text-cyan-500' : isMario ? 'text-red-600' : 'text-slate-400'}`}>If Penalties, who wins?</div>
                        <div className="flex justify-center gap-2">
                          <button 
                             disabled={isLocked}
                             onClick={() => handleStagePredict(match.id, 'penaltyWinner', 'home')}
                             className={`text-xs px-3 py-1.5 rounded transition-all ${
                                stagedPredictions[match.id]?.penaltyWinner === 'home' 
                                ? (isContrast ? 'bg-black text-white font-bold' : isTron ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_cyan]' : isMario ? 'bg-green-500 text-white font-black border-b-4 border-green-700' : 'bg-emerald-500 text-white font-bold') 
                                : (isContrast ? 'bg-white text-black border border-black hover:bg-gray-200' : isTron ? 'bg-transparent text-cyan-600 border border-cyan-800 hover:text-cyan-400' : isMario ? 'bg-white text-gray-500 border-2 border-gray-300' : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50')
                             }`}
                          >
                            {match.teamA}
                          </button>
                          <button 
                             disabled={isLocked}
                             onClick={() => handleStagePredict(match.id, 'penaltyWinner', 'away')}
                             className={`text-xs px-3 py-1.5 rounded transition-all ${
                                stagedPredictions[match.id]?.penaltyWinner === 'away' 
                                ? (isContrast ? 'bg-black text-white font-bold' : isTron ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_cyan]' : isMario ? 'bg-green-500 text-white font-black border-b-4 border-green-700' : 'bg-emerald-500 text-white font-bold') 
                                : (isContrast ? 'bg-white text-black border border-black hover:bg-gray-200' : isTron ? 'bg-transparent text-cyan-600 border border-cyan-800 hover:text-cyan-400' : isMario ? 'bg-white text-gray-500 border-2 border-gray-300' : isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50')
                             }`}
                          >
                            {match.teamB}
                          </button>
                        </div>
                     </div>
                   )}

                   {/* Actual Result & Points Display (Only if Locked/Completed) */}
                   {isLocked && match.result && (
                      <div className={`mt-4 pt-4 border-t flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 ${isContrast ? 'border-black' : isTron ? 'border-cyan-900' : isMario ? 'border-yellow-400' : isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                          <div className="text-left">
                              <span className={`text-[10px] uppercase font-bold block mb-1 ${isContrast ? 'text-black' : isTron ? 'text-cyan-600' : isMario ? 'text-red-500' : 'text-slate-400'}`}>Official Result</span>
                              <span className={`font-bold text-xl tracking-wider ${isContrast ? 'text-black' : isTron ? 'text-cyan-400 font-mono' : isDark ? 'text-white' : 'text-gray-900'}`}>{match.result.home} - {match.result.away}</span>
                              {match.result.penaltyWinner && (
                                <span className={`text-[10px] block mt-1 ${isContrast ? 'text-black' : isTron ? 'text-cyan-300' : 'text-emerald-500'}`}>
                                  {match.result.penaltyWinner === 'home' ? match.teamA : match.teamB} on pens
                                </span>
                              )}
                          </div>
                          <div className="text-right">
                               <span className={`text-[10px] uppercase font-bold block mb-1 ${isContrast ? 'text-black' : isTron ? 'text-cyan-600' : isMario ? 'text-red-500' : 'text-slate-400'}`}>You Earned</span>
                               <div className={`text-2xl font-black ${isContrast ? 'text-black' : isTron ? 'text-cyan-300 shadow-cyan-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]' : myPred?.points > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                   {myPred?.points || 0}
                               </div>
                               <div className={`text-[10px] font-medium ${isContrast ? 'text-black' : isTron ? 'text-cyan-700' : 'text-slate-400'}`}>{myPred ? (myPred.type || 'Miss') : 'No Prediction'}</div>
                          </div>
                      </div>
                   )}

                 </div>
              </div>
            )})}
          </div>

          {hasChanges && (
              <div className="fixed bottom-6 left-0 right-0 px-4 z-30 flex justify-center">
                  <button 
                    onClick={handleSubmitPredictions} 
                    disabled={submitting}
                    className={`font-bold py-3 px-8 rounded-xl shadow-2xl animate-bounce active:scale-95 transition-transform flex items-center gap-2 ${
                        isContrast ? 'bg-black text-white border-2 border-white' : 
                        isTron ? 'bg-cyan-600 text-white shadow-[0_0_20px_cyan] border border-cyan-400' : 
                        isMario ? 'bg-green-500 text-white border-b-4 border-green-800 hover:translate-y-1 hover:border-b-0' :
                        'bg-emerald-500 text-white shadow-emerald-500/40'
                    }`}
                  >
                    {submitting ? <RefreshCw className="animate-spin" /> : null}
                    Submit Predictions
                  </button>
              </div>
          )}
        </section>

        <div className="text-center py-4">
             <p className={`text-[10px] ${isContrast ? 'text-black' : isTron ? 'text-cyan-900' : isDark ? 'text-slate-600' : 'text-gray-400'}`}>Version v0.8c - Created by DBG</p>
        </div>
      </div>

      {showFullTable && <FullTableModal leaderboard={leaderboard} leagues={myLeagues} onClose={() => setShowFullTable(false)} onSelectPlayer={setSelectedPlayer} theme={theme} />}
      {showLeagueManager && <LeagueManagerModal user={user} allUsers={allUsers} myLeagues={myLeagues} onClose={() => setShowLeagueManager(false)} theme={theme} />}
      {selectedPlayer && <PlayerDetailModal player={selectedPlayer} fixtures={fixtures} onClose={() => setSelectedPlayer(null)} theme={theme} />}
      {showProfileModal && <ProfileModal user={user} currentData={myStats} onClose={() => setShowProfileModal(false)} theme={theme} />}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} theme={theme} />}
      {viewMatchPredictions && <MatchPredictionsModal match={viewMatchPredictions} onClose={() => setViewMatchPredictions(null)} theme={theme} />}
      {showStatsModal && <StatsModal leaderboard={leaderboard} leagues={myLeagues} onClose={() => setShowStatsModal(false)} theme={theme} />}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light' | 'contrast' | 'tron' | 'mario'

  const toggleTheme = () => {
    const modes = ['dark', 'light', 'contrast', 'tron', 'mario'];
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  // AUDIO SETUP
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize Audio object
    audioRef.current = new Audio('/theme.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5; // Set default volume to 50%

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleMusic = () => {
    if (!audioRef.current) return;

    if (isMusicPlaying) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.log("Audio play failed:", error);
        // Browser might block if no interaction, but click handler usually allows it
      });
      setIsMusicPlaying(true);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className={`h-screen flex items-center justify-center text-emerald-500 ${theme === 'contrast' ? 'bg-white' : theme === 'dark' ? 'bg-slate-950' : 'bg-gray-100'}`}><span className="text-4xl animate-bounce">⚽</span></div>;

  const musicProps = { isPlaying: isMusicPlaying, onToggle: toggleMusic };

  if (!user) {
    return (
      <div className={`min-h-screen font-sans relative overflow-hidden ${theme === 'contrast' ? 'bg-white' : theme === 'tron' ? 'bg-gray-950 text-cyan-400' : theme === 'mario' ? 'bg-sky-300' : theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
        <div className={`absolute top-0 left-0 w-full h-64 rounded-b-[50px] blur-3xl pointer-events-none ${theme === 'contrast' ? 'hidden' : theme === 'tron' ? 'bg-cyan-900/20' : theme === 'mario' ? 'bg-white/30' : theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-200/50'}`}></div>
        {view === 'login' ? <LoginScreen onSwitch={setView} musicProps={musicProps} theme={theme} toggleTheme={toggleTheme} /> : <RegisterScreen onSwitch={setView} musicProps={musicProps} theme={theme} toggleTheme={toggleTheme} />}
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden ${theme === 'contrast' ? 'bg-white' : theme === 'tron' ? 'bg-gray-950 text-cyan-400' : theme === 'mario' ? 'bg-sky-300' : theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
      <div className={`absolute top-0 left-0 w-full h-64 rounded-b-[50px] blur-3xl pointer-events-none ${theme === 'contrast' ? 'hidden' : theme === 'tron' ? 'bg-cyan-900/20' : theme === 'mario' ? 'bg-white/30' : theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-200/50'}`}></div>
      <Dashboard user={user} onLogout={() => signOut(auth)} musicProps={musicProps} theme={theme} toggleTheme={toggleTheme} />
    </div>
  );
};

export default App;
