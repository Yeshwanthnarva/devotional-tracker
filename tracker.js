// tracker.js - UPDATED (1 second inactivity, proper time saving)

let currentUser  = null;
let todayCount   = 0;
let sessionCount = 0;
let currentMode  = 'tap';
let timerSeconds = 0;
let timerIntervalId     = null;
let inactivityTimeoutId = null;
let isSaving = false;
let unsubscribeListener = null;
let isTimerActive = false;

// ── DOM Elements ───────────────────────────────────────────────
const todayCountEl    = document.getElementById('today-count');
const malaCountEl     = document.getElementById('mala-count');
const progressFill    = document.getElementById('progress-fill');
const progressLabel   = document.getElementById('progress-label');
const timerEl         = document.getElementById('timer');
const tapCountEl      = document.getElementById('tap-count');
const typingCountEl   = document.getElementById('typing-count');
const tapMode         = document.getElementById('tap-mode');
const typingMode      = document.getElementById('typing-mode');
const tapBtn          = document.getElementById('tap-btn');
const typingText      = document.getElementById('typing-text');
const typingSubmit    = document.getElementById('typing-submit');
const tapModeBtn      = document.getElementById('tap-mode-btn');
const typingModeBtn   = document.getElementById('typing-mode-btn');
const currentMantraEl = document.getElementById('current-mantra');
const timerStatusEl   = document.getElementById('timer-status');

// ── Date Functions ────────────────────────────────────────────
function getToday() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(s) {
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ── LocalStorage Backup ───────────────────────────────────────
function saveLocal() {
    if (!currentUser) return;
    localStorage.setItem(`japa_local_${currentUser.uid}`, JSON.stringify({
        date:  getToday(),
        count: todayCount,
        time:  timerSeconds
    }));
}

function loadLocal() {
    if (!currentUser) return null;
    const raw = localStorage.getItem(`japa_local_${currentUser.uid}`);
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        return data.date === getToday() ? data : null;
    } catch(e) { return null; }
}

// ── UI Update ─────────────────────────────────────────────────
function updateUI() {
    if (todayCountEl)  todayCountEl.textContent  = todayCount;
    if (malaCountEl)   malaCountEl.textContent   = Math.floor(todayCount / 108);
    if (progressLabel) progressLabel.textContent = `${todayCount % 108} / 108 towards next mala`;
    if (progressFill)  progressFill.style.width  = `${((todayCount % 108) / 108) * 100}%`;
    if (currentMode === 'tap' && tapCountEl)  tapCountEl.textContent    = sessionCount;
    else if (typingCountEl)                    typingCountEl.textContent = sessionCount;
}

// ── TIMER (1 second inactivity) ───────────────────────────────
function startTimer() {
    if (timerIntervalId) return;
    isTimerActive = true;
    timerIntervalId = setInterval(() => {
        if (isTimerActive) {
            timerSeconds++;
            if (timerEl) timerEl.textContent = formatTime(timerSeconds);
            saveLocal();
        }
    }, 1000);
    if (timerStatusEl) timerStatusEl.textContent = '⏱️ Chanting...';
}

function stopTimer() {
    isTimerActive = false;
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    if (inactivityTimeoutId) {
        clearTimeout(inactivityTimeoutId);
        inactivityTimeoutId = null;
    }
    if (timerStatusEl) timerStatusEl.textContent = '⏸️ Inactive — tap to continue';
}

function recordActivity() {
    // If timer is not running, start it
    if (!timerIntervalId) {
        startTimer();
    } 
    // If timer exists but is inactive, reactivate it
    else if (!isTimerActive) {
        isTimerActive = true;
        if (timerStatusEl) timerStatusEl.textContent = '⏱️ Chanting...';
    }
    
    // Clear previous inactivity timeout
    if (inactivityTimeoutId) {
        clearTimeout(inactivityTimeoutId);
        inactivityTimeoutId = null;
    }
    
    // Set new inactivity timeout - stops timer after EXACTLY 1 second
    inactivityTimeoutId = setTimeout(() => {
        if (isTimerActive) {
            stopTimer();
        }
    }, 1000);
}

// ── Firebase Save ─────────────────────────────────────────────
async function saveToFirebase() {
    if (!currentUser || isSaving) return;
    isSaving = true;
    const today = getToday();
    const docRef = db.collection('japa').doc(currentUser.uid).collection('daily').doc(today);
    
    try {
        await docRef.set({
            count: todayCount,
            time: timerSeconds,
            malas: Math.floor(todayCount / 108),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        saveLocal();
        console.log('✅ Firebase saved:', todayCount, 'japa,', timerSeconds, 'sec');
    } catch(err) {
        console.error('❌ Firebase save failed:', err);
        showToast('⚠️ Saved locally (will sync when online)', '#ff9800');
    } finally {
        isSaving = false;
    }
}

// ── Firebase Load + Real-time Listener ────────────────────────
async function loadFromFirebase() {
    if (!currentUser) return;
    const today = getToday();
    const docRef = db.collection('japa').doc(currentUser.uid).collection('daily').doc(today);

    // Load local data first
    const local = loadLocal();
    if (local) {
        todayCount   = local.count;
        timerSeconds = local.time;
        if (timerEl) timerEl.textContent = formatTime(timerSeconds);
        updateUI();
    }

    // Unsubscribe previous listener
    if (unsubscribeListener) unsubscribeListener();

    // Real-time listener
    unsubscribeListener = docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const firebaseCount = doc.data().count || 0;
            const firebaseTime  = doc.data().time || 0;

            if (firebaseCount > todayCount) {
                todayCount   = firebaseCount;
                timerSeconds = firebaseTime;
                if (timerEl) timerEl.textContent = formatTime(timerSeconds);
                saveLocal();
                updateUI();
                console.log('🔄 Real-time update:', todayCount);
            }
        } else if (!local && todayCount === 0) {
            todayCount   = 0;
            timerSeconds = 0;
            updateUI();
        }
    }, (err) => {
        console.error('❌ Real-time listener error:', err);
        showToast('⚠️ Offline — using local data', '#ff9800');
    });

    // Push local data if ahead
    try {
        const doc = await docRef.get();
        const firebaseCount = doc.exists ? (doc.data().count || 0) : 0;
        if (todayCount > firebaseCount && todayCount > 0) {
            await saveToFirebase();
            showToast('✅ Data synced to cloud!', '#4caf50');
        }
    } catch(err) {
        console.error('❌ Firebase load failed:', err);
        showToast('⚠️ Offline — using local data', '#ff9800');
    }

    updateUI();
}

// ── Add Japa (Main Action) ────────────────────────────────────
async function addJapa(count) {
    if (!currentUser) { 
        alert('Please login first'); 
        return; 
    }
    
    todayCount   += count;
    sessionCount += count;
    updateUI();
    saveLocal();
    recordActivity();  // This starts/resets the timer
    await saveToFirebase();  // This saves time along with count
    
    showToast(`+${count} 🙏`, '#4caf50');
    
    if (todayCount >= 108) await updateStreak();
}

// ── Toast Notification ────────────────────────────────────────
function showToast(msg, color = '#4caf50') {
    const old = document.getElementById('japa-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'japa-toast';
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:${color};color:white;padding:10px 20px;border-radius:40px;
        z-index:1000;font-size:14px;font-weight:bold;
        box-shadow:0 4px 12px rgba(0,0,0,0.2);animation:japaFade 2s ease forwards;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// Add toast animation style if not exists
if (!document.getElementById('japa-toast-style')) {
    const s = document.createElement('style');
    s.id = 'japa-toast-style';
    s.textContent = `@keyframes japaFade {
        0%{opacity:0;transform:translateX(-50%) translateY(8px)}
        15%{opacity:1;transform:translateX(-50%) translateY(0)}
        75%{opacity:1}100%{opacity:0}}`;
    document.head.appendChild(s);
}

// ── Streak Update ─────────────────────────────────────────────
async function updateStreak() {
    if (!currentUser) return;
    const today = getToday();
    const yesterday = getYesterday();
    const userRef = db.collection('users').doc(currentUser.uid);
    
    try {
        const doc = await userRef.get();
        const data = doc.exists ? doc.data() : {};
        let streak = data.streak || 0;
        const lastDate = data.lastJapaDate || '';
        
        if (lastDate === today) return;
        streak = (lastDate === yesterday) ? streak + 1 : 1;
        await userRef.set({ streak, lastJapaDate: today }, { merge: true });
        console.log('🔥 Streak:', streak);
    } catch(e) { console.error('Streak error:', e); }
}

// ── Typing Mode ───────────────────────────────────────────────
function normalize(t) { return t.replace(/\s/g,'').toLowerCase(); }

function countOccurrences(text, mantra) {
    const t = normalize(text);
    const m = normalize(mantra);
    let n = 0, i = 0;
    while ((i = t.indexOf(m, i)) !== -1) {
        n++;
        i += m.length;
    }
    return n;
}

async function handleTypingSubmit() {
    const text = typingText?.value.trim();
    if (!text) {
        alert('Please type the mantra!');
        return;
    }
    
    let mantra = 'Sri Matre Namaha';
    if (currentUser) {
        try {
            const d = await db.collection('users').doc(currentUser.uid).get();
            if (d.exists) mantra = d.data().mantra || mantra;
        } catch(e) {}
    }
    
    const n = countOccurrences(text, mantra);
    if (n === 0) {
        alert(`Please type "${mantra}" correctly!`);
        return;
    }
    
    await addJapa(n);
    if (typingText) {
        typingText.value = '';
        typingText.focus();
    }
}

// ── Mode Switcher ─────────────────────────────────────────────
function setMode(mode) {
    currentMode = mode;
    updateUI();
    const on = 'background:#d9914a;color:white;border:none';
    const off = 'background:transparent;color:#a35129;border:1px solid #e2c7a4';
    
    if (tapMode) tapMode.classList.toggle('active', mode === 'tap');
    if (typingMode) typingMode.classList.toggle('active', mode === 'typing');
    if (tapModeBtn) tapModeBtn.style.cssText = mode === 'tap' ? on : off;
    if (typingModeBtn) typingModeBtn.style.cssText = mode === 'typing' ? on : off;
}

// ── Load User Mantra ──────────────────────────────────────────
async function loadUserMantra() {
    if (!currentUser || !currentMantraEl) return;
    try {
        const d = await db.collection('users').doc(currentUser.uid).get();
        if (d.exists) {
            currentMantraEl.textContent = `${d.data().mantra || 'Sri Matre Namaha'} — Salutations to the Holy Mother`;
        }
    } catch(e) {}
}

// ── Sync Local to Firebase (when back online) ─────────────────
async function syncLocalToFirebase() {
    if (!currentUser) return;
    const local = loadLocal();
    if (!local) return;
    
    const docRef = db.collection('japa').doc(currentUser.uid).collection('daily').doc(local.date);
    try {
        const doc = await docRef.get();
        const firebaseCount = doc.exists ? (doc.data().count || 0) : 0;
        if (local.count > firebaseCount) {
            await docRef.set({
                count: local.count,
                time: local.time,
                malas: Math.floor(local.count/108),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            showToast('✅ Data synced to cloud!', '#4caf50');
        }
    } catch(e) { console.error('Sync error:', e); }
}

// ── Manual Sync (Exposed to Window) ───────────────────────────
window.manualSync = async function() {
    if (!currentUser) {
        showToast('Please login first', '#ff9800');
        return;
    }
    showToast('🔄 Syncing...', '#2196f3');
    await saveToFirebase();
    await loadFromFirebase();
    showToast('✅ Sync complete!', '#4caf50');
};

// ── Reset Session Count ───────────────────────────────────────
window.resetSessionCount = function() {
    sessionCount = 0;
    updateUI();
    showToast('Session counter reset', '#ff9800');
};

// ── Event Listeners ───────────────────────────────────────────
if (tapBtn) tapBtn.addEventListener('click', () => addJapa(1));
if (typingSubmit) typingSubmit.addEventListener('click', handleTypingSubmit);
if (typingText) {
    typingText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleTypingSubmit();
        }
    });
}
if (tapModeBtn) tapModeBtn.addEventListener('click', () => setMode('tap'));
if (typingModeBtn) typingModeBtn.addEventListener('click', () => setMode('typing'));

// ── Initialize ────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log('✅ User:', user.email, '| Date:', getToday());
        await loadFromFirebase();
        await loadUserMantra();
        setMode('tap');
    } else {
        window.location.href = 'login.html';
    }
});

// ── Save on Page Close ────────────────────────────────────────
window.addEventListener('beforeunload', () => {
    if (unsubscribeListener) unsubscribeListener();
    stopTimer();
    saveLocal();
    saveToFirebase();
});

// ── Sync when Back Online ─────────────────────────────────────
window.addEventListener('online', async () => {
    showToast('🌐 Back online — syncing...', '#2196f3');
    await syncLocalToFirebase();
    setTimeout(() => location.reload(), 1500);
});