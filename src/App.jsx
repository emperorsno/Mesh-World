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
  getDoc
} from 'firebase/firestore';
import { Activity, ChevronRight, X, Trophy, CheckCircle2, AlertCircle, Lock, LogOut, Mail, User, Key, ArrowLeft, Settings, Plus, Trash2, Calendar, RefreshCw, Shield, Volume2, VolumeX, Eye, EyeOff, Edit2, Camera, Sun, Moon } from 'lucide-react';

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

const STAGES = [
  { id: 'md1', name: 'Group Stage - Matchday 1', dates: 'June 11–17, 2026', status: 'ACTIVE', type: 'group' },
  { id: 'md2', name: 'Group Stage - Matchday 2', dates: 'June 18–23, 2026', status: 'FUTURE', type: 'group' },
  { id: 'md3', name: 'Group Stage - Matchday 3', dates: 'June 24–27, 2026', status: 'FUTURE', type: 'group' },
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

// --- SCORING ENGINE ---
const calculatePoints = (prediction, result, rules = DEFAULT_SCORING) => {
  if (!prediction || !result) return { points: 0, type: 'Miss' };
  
  let points = 0;
  let mainType = 'Miss';

  const pHome = parseInt(prediction.home);
  const pAway = parseInt(prediction.away);
  const rHome = parseInt(result.home);
  const rAway = parseInt(result.away);

  // 1. Main Prediction Logic (Score after 120mins)
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

  // 2. Penalty Bonus Logic
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

// --- COMPONENTS ---

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
        onError={(e) => { e.target.onerror = null; e.target.src = ''; }} // Fallback if image fails
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white border-2 border-emerald-400/50`}>
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

const AuthInput = ({ icon: Icon, type, placeholder, value, onChange, label, isDarkMode }) => (
  <div className="space-y-1">
    {label && <label className={`text-xs font-bold uppercase ml-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{label}</label>}
    <div className="relative group">
      <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-emerald-400' : 'text-gray-400 group-focus-within:text-emerald-600'}`}>
        <Icon size={18} />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg py-3 pl-10 pr-4 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all ${
          isDarkMode 
            ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' 
            : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
        }`}
      />
    </div>
  </div>
);

const MusicToggle = ({ isPlaying, onToggle, isDarkMode }) => (
  <button 
    onClick={onToggle} 
    className={`p-2 rounded-full transition-all ${
      isPlaying 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
        : isDarkMode 
            ? 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
            : 'bg-white text-gray-400 border border-gray-200 hover:text-gray-600'
    }`}
    title={isPlaying ? "Mute Music" : "Play Music"}
  >
    {isPlaying ? <Volume2 size={18} /> : <VolumeX size={18} />}
  </button>
);

const ThemeToggle = ({ isDarkMode, onToggle }) => (
  <button 
    onClick={onToggle} 
    className={`p-2 rounded-full transition-all ${
      isDarkMode 
        ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-yellow-400' 
        : 'bg-white text-gray-400 border border-gray-200 hover:text-indigo-600'
    }`}
    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
  >
    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
  </button>
);

// --- MODALS ---

const ProfileModal = ({ user, currentData, onClose, isDarkMode }) => {
  const [name, setName] = useState(currentData?.name || user.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentData?.avatarUrl || '');
  const [saving, setSaving] = useState(false);

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
      <div className={`w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'}`}>
          <h3 className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <User size={18} /> Edit Profile
          </h3>
          <button onClick={onClose} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-center mb-6">
             <div className="relative group">
                <Avatar url={avatarUrl} name={name} size="lg" />
                <div className={`absolute -bottom-2 -right-2 rounded-full p-1 border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'}`}>
                  <Camera size={12} className={isDarkMode ? 'text-slate-300' : 'text-gray-500'} />
                </div>
             </div>
          </div>

          <div className="space-y-2">
             <label className={`text-xs font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Display Name</label>
             <input 
               className={`w-full border rounded p-2 ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
          </div>

          <div className="space-y-2">
             <label className={`text-xs font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Avatar Image URL</label>
             <input 
               className={`w-full border rounded p-2 text-xs ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
               value={avatarUrl}
               onChange={(e) => setAvatarUrl(e.target.value)}
               placeholder="https://example.com/image.jpg"
             />
             <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Paste a link to an image (jpg/png) to set your avatar.</p>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
          >
            {saving ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle2 size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const FullTableModal = ({ leaderboard, onClose, onSelectPlayer, isDarkMode }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-2 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-800 border-slate-800' : 'bg-gray-50 border-gray-100'}`}>
          <h3 className="font-bold text-emerald-500 flex items-center gap-2">
            <Trophy size={18} /> Full Standings
          </h3>
          <button onClick={onClose} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}><X size={20}/></button>
        </div>
        
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className={`sticky top-0 z-10 font-bold ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
              <tr>
                <th className="p-3 w-8">#</th>
                <th className="p-3">Player</th>
                <th className="p-3 text-center text-emerald-500" title="Exact Score">Perf</th>
                <th className="p-3 text-center text-blue-500" title="Correct Goal Diff">Agg</th>
                <th className="p-3 text-center text-yellow-500" title="Correct Outcome">Out</th>
                <th className="p-3 text-center text-red-500" title="Incorrect">Miss</th>
                <th className={`p-3 text-right font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Pts</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-gray-100'}`}>
              {leaderboard.map((user, idx) => (
                <tr 
                  key={user.id} 
                  onClick={() => onSelectPlayer(user)}
                  className={`transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-3 text-slate-500">{idx + 1}</td>
                  <td className={`p-3 font-medium flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Avatar url={user.avatarUrl} name={user.name} size="sm" />
                    <span className="whitespace-nowrap">{user.name}</span>
                  </td>
                  <td className="p-3 text-center text-slate-400">{user.stats?.perfect || 0}</td>
                  <td className="p-3 text-center text-slate-400">{user.stats?.aggregate || 0}</td>
                  <td className="p-3 text-center text-slate-400">{user.stats?.outcome || 0}</td>
                  <td className="p-3 text-center text-slate-500">{user.stats?.missed || 0}</td>
                  <td className="p-3 text-right font-bold text-emerald-500 text-sm">{user.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`p-3 border-t text-[10px] flex justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <span>Tap any player to view their predictions</span>
        </div>
      </div>
    </div>
  );
};

const PlayerDetailModal = ({ player, fixtures, onClose, isDarkMode }) => {
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreds = async () => {
       const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'), where('userId', '==', player.id));
       const snap = await getDocs(q);
       const preds = {};
       snap.docs.forEach(d => { preds[d.data().matchId] = d.data(); });
       setPredictions(preds);
       setLoading(false);
    };
    fetchPreds();
  }, [player]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
        <div className={`p-4 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <Avatar url={player.avatarUrl} name={player.name} size="md" />
            <div>
              <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{player.name}</h3>
              <p className="text-slate-500 text-xs">Prediction History</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-800'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {loading ? <div className="text-center p-4 text-slate-500">Loading...</div> : (
            fixtures.map((match) => {
                const pred = predictions[match.id];
                const isComplete = match.status === 'COMPLETED';
                
                if (!pred && !isComplete) return null;

                return (
                  <div key={match.id} className={`rounded-lg p-3 border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="text-xs text-slate-500 font-bold uppercase mb-2 flex justify-between">
                        <span>{match.teamA} vs {match.teamB}</span>
                        <span className="font-mono">{match.date}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                            {pred ? (
                                <>
                                  <span className="text-emerald-500 font-bold">Pred: {pred.prediction.home} - {pred.prediction.away}</span>
                                  {pred.prediction.penaltyWinner && <span className="text-[10px] text-emerald-500/70">Pens: {pred.prediction.penaltyWinner}</span>}
                                </>
                            ) : (
                                <span className="text-slate-400 italic">No Prediction</span>
                            )}
                        </div>
                        {isComplete ? (
                            <div className="text-right">
                                <span className={`font-bold block ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Result: {match.result?.home} - {match.result?.away}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${pred?.points > 0 ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/50' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                    {pred ? `${pred.points} pts (${pred.type || 'Miss'})` : '0 pts (No Pred)'}
                                </span>
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Match Pending</span>
                        )}
                    </div>
                  </div>
                );
            })
          )}
          {!loading && Object.keys(predictions).length === 0 && fixtures.filter(f => f.status === 'COMPLETED').length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm italic">No predictions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- SCREENS ---

const LoginScreen = ({ onSwitch, musicProps, isDarkMode, toggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
        <MusicToggle {...musicProps} isDarkMode={isDarkMode} />
      </div>

      <div className="mb-8 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mx-auto mb-4 shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <span className="text-3xl">⚽</span>
        </div>
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Mesh Predictor</h1>
        <p className="text-slate-500 text-sm">Sign in to play</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <AuthInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} isDarkMode={isDarkMode} />
        <AuthInput icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} isDarkMode={isDarkMode} />
        {error && <p className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        
        <button disabled={loading} type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 mt-4 disabled:opacity-50">
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-slate-500 text-sm">
          No account? <button onClick={() => onSwitch('register')} className="text-emerald-500 font-bold hover:underline">Register</button>
        </p>
      </div>
      
      <div className="mt-8 text-center">
        <p className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>Version v0.3 - Created by DBG</p>
      </div>
    </div>
  );
};

const RegisterScreen = ({ onSwitch, musicProps, isDarkMode, toggleTheme }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
        <MusicToggle {...musicProps} isDarkMode={isDarkMode} />
      </div>
      <button onClick={() => onSwitch('login')} className="absolute top-6 left-4 text-slate-400 hover:text-emerald-500 flex items-center gap-1"><ArrowLeft size={18} /> Back</button>
      <div className="mb-6 mt-8"><h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Create Account</h1></div>
      
      <form onSubmit={handleRegister} className="space-y-4">
        <AuthInput icon={User} type="text" placeholder="Display Name" value={name} onChange={setName} isDarkMode={isDarkMode} />
        <AuthInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} isDarkMode={isDarkMode} />
        <AuthInput icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} isDarkMode={isDarkMode} />
        {error && <p className="text-red-500 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        <button disabled={loading} type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl mt-2">
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
};

const AdminDashboard = ({ fixtures, onClose, isDarkMode }) => {
  const [selectedStageId, setSelectedStageId] = useState('md1'); // Default to md1
  const [newMatch, setNewMatch] = useState({ teamA: '', teamB: '', date: '', time: '' });
  const [processing, setProcessing] = useState(false);
  const [scoringRules, setScoringRules] = useState(DEFAULT_SCORING);
  const [showRules, setShowRules] = useState(false);

  // Load Scoring Rules
  useEffect(() => {
    const loadRules = async () => {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'scoring');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setScoringRules(docSnap.data());
      }
    };
    loadRules();
  }, []);

  const handleSaveRules = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'scoring'), scoringRules);
    setShowRules(false);
    alert('Scoring rules updated!');
  };

  const handleAddMatch = async () => {
    if (!newMatch.teamA || !newMatch.teamB) return;
    const matchData = {
      stageId: selectedStageId,
      ...newMatch,
      status: 'UPCOMING',
      result: null,
      timestamp: Date.now()
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), matchData);
    setNewMatch({ teamA: '', teamB: '', date: '', time: '' });
  };

  const handleDeleteMatch = async (id) => {
    if (confirm("Delete match?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'fixtures', id));
    }
  };

  // --- Recalculate All Points ---
  const handleRecalculateAll = async () => {
    if (!confirm("WARNING: This will reset all scores to 0 and recalculate them based on current completed matches. Continue?")) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);

      // 1. Fetch all Users & Reset local state
      const usersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      const userMap = {};
      usersSnapshot.forEach(doc => {
         // Initialize with 0 points
         userMap[doc.id] = { 
           ref: doc.ref, 
           data: { 
             ...doc.data(), 
             totalPoints: 0, 
             stats: { perfect: 0, aggregate: 0, outcome: 0, missed: 0 } 
           } 
         };
      });

      // 2. Fetch all Completed Fixtures
      const fixturesSnapshot = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), where('status', '==', 'COMPLETED')));
      
      // 3. Fetch all Predictions
      const predsSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'));

      // 4. Loop through predictions
      predsSnapshot.forEach(predDoc => {
          const pData = predDoc.data();
          const matchDoc = fixturesSnapshot.docs.find(f => f.id === pData.matchId);
          
          // Only score if match is completed
          if (matchDoc) {
              const result = matchDoc.data().result;
              const calculation = calculatePoints(pData.prediction, result, scoringRules);
              
              // Update prediction with correct points (in case rules changed)
              batch.update(predDoc.ref, { points: calculation.points, type: calculation.type });

              // Add to User Total
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

      // 5. Commit User Updates
      Object.values(userMap).forEach(({ ref, data }) => {
          batch.update(ref, { totalPoints: data.totalPoints, stats: data.stats });
      });

      await batch.commit();
      alert("Leaderboard fully recalculated!");
    } catch (e) {
      console.error(e);
      alert("Error recalculating: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // --- Update Score ---
  const handleUpdateScore = async (match, home, away, penaltyWinner) => {
    if (processing) return;
    setProcessing(true);

    try {
      const newResult = { 
        home: home ?? null, 
        away: away ?? null, 
        penaltyWinner: penaltyWinner ?? null 
      };
      
      const batch = writeBatch(db);

      // 1. Update Match
      const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'fixtures', match.id);
      batch.update(matchRef, { result: newResult, status: 'COMPLETED' });

      // 2. Get Preds & Users
      const predsQuery = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'predictions'),
        where('matchId', '==', match.id)
      );
      const predsSnapshot = await getDocs(predsQuery);

      const usersSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
      const userMap = {};
      usersSnapshot.forEach(doc => { userMap[doc.id] = { ref: doc.ref, data: doc.data() }; });

      // 3. Loop Preds
      predsSnapshot.forEach((predDoc) => {
        const pData = predDoc.data();
        
        const oldPoints = pData.points || 0;
        const oldType = pData.type || 'Miss';

        const calculation = calculatePoints(pData.prediction, newResult, scoringRules);
        
        // Update Prediction
        batch.update(predDoc.ref, { points: calculation.points, type: calculation.type });

        // Update User
        if (userMap[pData.userId]) {
          const u = userMap[pData.userId].data;
          
          // Subtract old, Add new
          u.totalPoints = (u.totalPoints || 0) - oldPoints + calculation.points;
          
          if (!u.stats) u.stats = { perfect: 0, aggregate: 0, outcome: 0, missed: 0 };
          
          // Decrement old stat
          if (oldPoints > 0 || oldType !== 'Miss') { 
             if (oldType.includes('Perfect')) u.stats.perfect = Math.max(0, (u.stats.perfect || 0) - 1);
             else if (oldType.includes('Aggregate')) u.stats.aggregate = Math.max(0, (u.stats.aggregate || 0) - 1);
             else if (oldType.includes('Outcome')) u.stats.outcome = Math.max(0, (u.stats.outcome || 0) - 1);
             else u.stats.missed = Math.max(0, (u.stats.missed || 0) - 1);
          }

          // Increment new stat
          if (calculation.type.includes('Perfect')) u.stats.perfect = (u.stats.perfect || 0) + 1;
          else if (calculation.type.includes('Aggregate')) u.stats.aggregate = (u.stats.aggregate || 0) + 1;
          else if (calculation.type.includes('Outcome')) u.stats.outcome = (u.stats.outcome || 0) + 1;
          else u.stats.missed = (u.stats.missed || 0) + 1;
        }
      });

      // 4. Commit Users
      Object.values(userMap).forEach(({ ref, data }) => {
        batch.update(ref, { totalPoints: data.totalPoints, stats: data.stats || {} });
      });

      await batch.commit();
      alert("Score updated & Leaderboard adjusted!");
    } catch (e) {
      console.error(e);
      alert("Error updating score: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const activeFixtures = fixtures.filter(f => f.stageId === selectedStageId);
  const isKnockout = STAGES.find(s => s.id === selectedStageId)?.type === 'knockout';

  return (
    <div className="pb-20">
      <header className={`p-4 flex justify-between items-center sticky top-0 z-20 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
        <h2 className="text-amber-500 font-bold flex items-center gap-2"><Settings size={18} /> Admin Console</h2>
        <div className="flex items-center gap-3">
             <button 
               onClick={handleRecalculateAll}
               disabled={processing}
               className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-red-900 hover:text-red-200' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-red-100 hover:text-red-600'}`}
               title="Reset & Recalculate All Scores"
             >
               <RefreshCw size={14} className={processing ? 'animate-spin' : ''}/>
               {processing ? 'Working...' : 'Recalculate'}
             </button>
             <button onClick={onClose} className={`text-xs font-bold ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Exit</button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Scoring Rules Toggle */}
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <button onClick={() => setShowRules(!showRules)} className={`w-full p-3 flex justify-between items-center text-xs font-bold hover:bg-opacity-80 ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'}`}>
            <span>Configure Scoring Rules</span>
            <ChevronRight size={16} className={`transform transition-transform ${showRules ? 'rotate-90' : ''}`} />
          </button>
          {showRules && (
             <div className={`p-4 grid grid-cols-2 gap-4 border-t ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                {Object.keys(DEFAULT_SCORING).map(key => (
                  <div key={key} className="space-y-1">
                    <label className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                    <input 
                      type="number" 
                      className={`w-full border rounded p-2 text-sm ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      value={scoringRules[key] || 0}
                      onChange={(e) => setScoringRules({...scoringRules, [key]: parseInt(e.target.value)})}
                    />
                  </div>
                ))}
                <button onClick={handleSaveRules} className="col-span-2 bg-emerald-600 text-white font-bold py-2 rounded text-xs mt-2">Save Rules</button>
             </div>
          )}
        </div>

        {/* Stage Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {STAGES.map(stage => (
                <button key={stage.id} onClick={() => setSelectedStageId(stage.id)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold border transition-all ${selectedStageId === stage.id ? 'bg-emerald-500 text-white border-emerald-500' : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                    {stage.name}
                </button>
            ))}
        </div>

        {/* Add Match */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            <h4 className="text-xs font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2"><Plus size={14}/> Add Match</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <input className={`border rounded p-2 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Team A" value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
                <input className={`border rounded p-2 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Team B" value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
                <input className={`border rounded p-2 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Date" value={newMatch.date} onChange={e => setNewMatch({...newMatch, date: e.target.value})} />
                <input className={`border rounded p-2 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`} placeholder="Time" value={newMatch.time} onChange={e => setNewMatch({...newMatch, time: e.target.value})} />
            </div>
            <button onClick={handleAddMatch} className="w-full bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-300 font-bold py-2 rounded-lg transition-colors text-sm">Add to Schedule</button>
        </div>

        {/* List Matches */}
        <div className="space-y-3">
            {activeFixtures.map(match => (
                <div key={match.id} className={`border p-3 rounded-xl flex flex-col gap-3 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex-1">
                            <div className={`flex items-center gap-2 font-bold text-sm mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{match.teamA} <span className="text-slate-400 text-xs">vs</span> {match.teamB}</div>
                            <div className="text-xs text-slate-500">{match.date} • {match.time}</div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className={`flex items-center gap-1 p-1 rounded border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
                               <input disabled={processing} type="number" className={`w-8 bg-transparent text-center text-xs focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`} placeholder="H" defaultValue={match.result?.home} onBlur={(e) => handleUpdateScore(match, e.target.value, match.result?.away, match.result?.penaltyWinner)} />
                               <span className="text-slate-400">:</span>
                               <input disabled={processing} type="number" className={`w-8 bg-transparent text-center text-xs focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`} placeholder="A" defaultValue={match.result?.away} onBlur={(e) => handleUpdateScore(match, match.result?.home, e.target.value, match.result?.penaltyWinner)} />
                           </div>
                           <button onClick={() => handleDeleteMatch(match.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    {/* Penalty Admin Selector */}
                    <div className={`flex items-center gap-2 text-xs pt-2 border-t ${isDarkMode ? 'border-slate-700/50' : 'border-gray-100'}`}>
                        <span className="text-slate-400 font-bold">Penalties?</span>
                        <button 
                           onClick={() => handleUpdateScore(match, match.result?.home, match.result?.away, match.result?.penaltyWinner === 'home' ? null : 'home')}
                           className={`px-2 py-1 rounded border ${match.result?.penaltyWinner === 'home' ? 'bg-emerald-500 text-white border-emerald-500' : isDarkMode ? 'border-slate-600 text-slate-400' : 'border-gray-300 text-gray-500'}`}
                        >
                          {match.teamA} Wins
                        </button>
                        <button 
                           onClick={() => handleUpdateScore(match, match.result?.home, match.result?.away, match.result?.penaltyWinner === 'away' ? null : 'away')}
                           className={`px-2 py-1 rounded border ${match.result?.penaltyWinner === 'away' ? 'bg-emerald-500 text-white border-emerald-500' : isDarkMode ? 'border-slate-600 text-slate-400' : 'border-gray-300 text-gray-500'}`}
                        >
                          {match.teamB} Wins
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user, onLogout, musicProps, isDarkMode, toggleTheme }) => {
  const [fixtures, setFixtures] = useState([]);
  const [myPredictions, setMyPredictions] = useState({});
  const [stagedPredictions, setStagedPredictions] = useState({}); 
  const [leaderboard, setLeaderboard] = useState([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showFullTable, setShowFullTable] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  // --- DATA SYNC ---
  useEffect(() => {
    if (!user) return;

    const unsubFixtures = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'fixtures'), orderBy('timestamp')), (snap) => {
        setFixtures(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), orderBy('totalPoints', 'desc')), (snap) => {
        setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qPreds = query(collection(db, 'artifacts', appId, 'public', 'data', 'predictions'), where('userId', '==', user.uid));
    const unsubPreds = onSnapshot(qPreds, (snap) => {
        const preds = {};
        snap.docs.forEach(d => { 
            const data = d.data();
            preds[data.matchId] = {
                ...data.prediction,
                points: data.points,
                type: data.type
            }; 
        });
        setMyPredictions(preds);
        setStagedPredictions(preds); 
    });

    return () => { unsubFixtures(); unsubUsers(); unsubPreds(); };
  }, [user]);

  // --- HANDLERS ---

  const handleStagePredict = (matchId, key, val) => {
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
                const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'predictions', docId);
                
                batch.set(docRef, {
                    matchId,
                    userId: user.uid,
                    prediction: cleanPrediction,
                    userName: user.displayName
                }, { merge: true });
            }
        });

        await batch.commit();
        alert("Predictions submitted successfully!");
    } catch (error) {
        console.error("Error submitting:", error);
        alert("Error saving predictions.");
    } finally {
        setSubmitting(false);
    }
  };

  const activeFixtures = fixtures.filter(f => {
      const stage = STAGES.find(s => s.id === f.stageId);
      return stage?.status !== 'PAST';
  });

  // Filter based on completion status if toggle is off
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

  if (isAdminMode) return <AdminDashboard fixtures={fixtures} onClose={() => setIsAdminMode(false)} isDarkMode={isDarkMode} />;

  const myStats = leaderboard.find(u => u.email === user.email);
  const isAdmin = user.email === ADMIN_EMAIL;

  return (
    <div className={`pb-24 min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-gray-100'}`}>
      <header className={`sticky top-0 z-20 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center shadow-lg ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <h1 className={`text-sm md:text-lg font-bold tracking-wide truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Mesh WC <span className="text-emerald-500">Predictor</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleTheme} />
          <MusicToggle {...musicProps} isDarkMode={isDarkMode} />
          {isAdmin && (
              <button onClick={() => setIsAdminMode(true)} className={`p-2 rounded-full border ${isDarkMode ? 'bg-slate-800 text-amber-400 border-amber-400/30' : 'bg-white text-amber-500 border-amber-500/30'}`} title="Admin">
                  <Settings size={16} />
              </button>
          )}
          <button 
            onClick={() => setShowProfileModal(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border flex items-center gap-2 transition-colors ${isDarkMode ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-gray-50'}`}
          >
            <Avatar url={myStats?.avatarUrl} name={myStats?.name} size="sm" />
            <span>{myStats?.totalPoints || 0} PTS</span>
          </button>
          <button onClick={() => signOut(auth)} className={`p-2 hover:text-red-500 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}><LogOut size={18} /></button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        
        {/* Leaderboard (Moved to Top) */}
        <section>
             <div className="flex justify-between items-end mb-3 px-1">
                <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Leaderboard</h2>
                <button onClick={() => setShowFullTable(true)} className="text-xs text-emerald-500 font-bold flex items-center gap-1 hover:text-emerald-400">
                    View Full Table <ChevronRight size={12} />
                </button>
            </div>
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                {leaderboard.slice(0, 5).map((player, idx) => (
                    <div 
                      key={player.id || idx} 
                      onClick={() => setSelectedPlayer(player)}
                      className={`flex justify-between p-3 border-b last:border-0 cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50'} ${player.email === user.email ? (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50') : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 font-mono w-6 text-center">{idx + 1}</span>
                            <div className="flex items-center gap-2">
                               <Avatar url={player.avatarUrl} name={player.name} size="sm" />
                               <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{player.name} {player.email === user.email && '(You)'}</span>
                            </div>
                        </div>
                        <span className="font-bold text-emerald-500">{player.totalPoints} pts</span>
                    </div>
                ))}
            </div>
        </section>

        {/* Fixtures */}
        <section>
           <div className="flex justify-between items-end mb-3 px-1">
            <div>
                <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Your Predictions</h2>
                <div className="text-[10px] text-emerald-500 font-bold">Active Matches</div>
            </div>
            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'}`}
            >
              {showCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
          </div>
          <div className="space-y-4">
            {visibleFixtures.length === 0 && <div className={`p-8 text-center text-sm rounded-xl border ${isDarkMode ? 'bg-slate-800/50 text-slate-500 border-slate-800' : 'bg-white text-gray-400 border-gray-200'}`}>No matches to show.</div>}
            {visibleFixtures.map((match) => {
               const isKnockout = STAGES.find(s => s.id === match.stageId)?.type === 'knockout';
               const isLocked = match.status === 'COMPLETED' || match.result; 
               const myPred = myPredictions[match.id];

               return (
              <div key={match.id} className={`rounded-xl overflow-hidden border shadow-lg relative ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${isLocked ? 'opacity-90' : ''}`}>
                 {isLocked && <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none" />}
                 <div className={`p-2.5 border-b flex justify-between items-center ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-gray-50 border-gray-100'}`}>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'}`}>{STAGES.find(s=>s.id===match.stageId)?.name.replace('Group Stage - ', '')}</span>
                    <div className="flex items-center gap-2">
                         {isLocked && <Lock size={12} className="text-slate-500" />}
                         <span className="text-xs text-slate-500 font-mono">{match.date} {match.time}</span>
                    </div>
                 </div>
                 <div className="p-5">
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex flex-col items-center w-1/3">
                          <span className={`font-bold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{match.teamA}</span>
                          <input 
                              type="number" 
                              disabled={isLocked}
                              className={`w-12 h-12 border rounded-lg text-center text-xl font-bold outline-none ${
                                isLocked 
                                  ? (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-400') 
                                  : (isDarkMode ? 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500')
                              }`}
                              value={stagedPredictions[match.id]?.home || ''} 
                              onChange={e => handleStagePredict(match.id, 'home', e.target.value)} 
                          />
                      </div>
                      <span className="text-slate-500 font-bold">:</span>
                      <div className="flex flex-col items-center w-1/3">
                          <span className={`font-bold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{match.teamB}</span>
                          <input 
                              type="number" 
                              disabled={isLocked}
                              className={`w-12 h-12 border rounded-lg text-center text-xl font-bold outline-none ${
                                isLocked 
                                  ? (isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-400') 
                                  : (isDarkMode ? 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500')
                              }`}
                              value={stagedPredictions[match.id]?.away || ''} 
                              onChange={e => handleStagePredict(match.id, 'away', e.target.value)} 
                           />
                      </div>
                   </div>
                   
                   {/* Knockout Penalty Prediction */}
                   {isKnockout && (
                     <div className={`rounded p-3 text-center border ${isDarkMode ? 'bg-slate-900/50 border-slate-700/50' : 'bg-gray-50 border-gray-100'} ${isLocked ? 'opacity-75' : ''}`}>
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">If Penalties, who wins?</div>
                        <div className="flex justify-center gap-2">
                          <button 
                             disabled={isLocked}
                             onClick={() => handleStagePredict(match.id, 'penaltyWinner', 'home')}
                             className={`text-xs px-3 py-1.5 rounded transition-all ${stagedPredictions[match.id]?.penaltyWinner === 'home' ? 'bg-emerald-500 text-white font-bold' : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                          >
                            {match.teamA}
                          </button>
                          <button 
                             disabled={isLocked}
                             onClick={() => handleStagePredict(match.id, 'penaltyWinner', 'away')}
                             className={`text-xs px-3 py-1.5 rounded transition-all ${stagedPredictions[match.id]?.penaltyWinner === 'away' ? 'bg-emerald-500 text-white font-bold' : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                          >
                            {match.teamB}
                          </button>
                        </div>
                     </div>
                   )}

                   {/* Actual Result & Points Display (Only if Locked/Completed) */}
                   {isLocked && match.result && (
                      <div className={`mt-4 pt-4 border-t flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 ${isDarkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                          <div className="text-left">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Official Result</span>
                              <span className={`font-bold text-xl tracking-wider ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{match.result.home} - {match.result.away}</span>
                              {match.result.penaltyWinner && (
                                <span className="text-[10px] text-emerald-500 block mt-1">
                                  {match.result.penaltyWinner === 'home' ? match.teamA : match.teamB} on pens
                                </span>
                              )}
                          </div>
                          <div className="text-right">
                               <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">You Earned</span>
                               <div className={`text-2xl font-black ${myPred?.points > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                   {myPred?.points || 0}
                               </div>
                               <div className="text-[10px] text-slate-400 font-medium">{myPred ? (myPred.type || 'Miss') : 'No Prediction'}</div>
                          </div>
                      </div>
                   )}

                 </div>
              </div>
            )})}
          </div>

          {/* SUBMIT BUTTON */}
          {hasChanges && (
              <div className="fixed bottom-6 left-0 right-0 px-4 z-30 flex justify-center">
                  <button 
                    onClick={handleSubmitPredictions} 
                    disabled={submitting}
                    className="bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl shadow-2xl shadow-emerald-500/40 animate-bounce active:scale-95 transition-transform flex items-center gap-2"
                  >
                    {submitting ? <RefreshCw className="animate-spin" /> : null}
                    Submit Predictions
                  </button>
              </div>
          )}
        </section>

        {/* Version Footer */}
        <div className="text-center py-4">
             <p className={`text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>Version v0.3 - Created by DBG</p>
        </div>
      </div>

      {/* MODALS */}
      {showFullTable && <FullTableModal leaderboard={leaderboard} onClose={() => setShowFullTable(false)} onSelectPlayer={setSelectedPlayer} isDarkMode={isDarkMode} />}
      {selectedPlayer && <PlayerDetailModal player={selectedPlayer} fixtures={fixtures} onClose={() => setSelectedPlayer(null)} isDarkMode={isDarkMode} />}
      {showProfileModal && <ProfileModal user={user} currentData={myStats} onClose={() => setShowProfileModal(false)} isDarkMode={isDarkMode} />}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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

  if (loading) return <div className={`h-screen flex items-center justify-center text-emerald-500 ${isDarkMode ? 'bg-slate-950' : 'bg-gray-100'}`}><span className="text-4xl animate-bounce">⚽</span></div>;

  const musicProps = { isPlaying: isMusicPlaying, onToggle: toggleMusic };

  if (!user) {
    return (
      <div className={`min-h-screen font-sans relative overflow-hidden ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
        <div className={`absolute top-0 left-0 w-full h-64 rounded-b-[50px] blur-3xl pointer-events-none ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-200/50'}`}></div>
        {view === 'login' ? <LoginScreen onSwitch={setView} musicProps={musicProps} isDarkMode={isDarkMode} toggleTheme={toggleTheme} /> : <RegisterScreen onSwitch={setView} musicProps={musicProps} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
      <div className={`absolute top-0 left-0 w-full h-64 rounded-b-[50px] blur-3xl pointer-events-none ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-200/50'}`}></div>
      <Dashboard user={user} onLogout={() => signOut(auth)} musicProps={musicProps} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
    </div>
  );
};

export default App;
