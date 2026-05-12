// auth.js

function saveUserSession(user) {
    if (user) {
        localStorage.setItem('offline_user_session', JSON.stringify({
            uid: user.uid,
            email: user.email
        }));
    }
}

async function ensureUserDoc(user) {
    try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (!doc.exists) {
            await db.collection("users").doc(user.uid).set({
                mantra: "Sri Matre Namaha",
                streak: 0,
                lastJapaDate: ""
            });
        }
    } catch(e) { console.warn("ensureUserDoc error:", e); }
}

// ── Signup form ────────────────────────────────────────────────
const signupForm = document.getElementById("signup-form");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email    = document.getElementById("signup-email").value;
        const password = document.getElementById("signup-password").value;
        const confirm  = document.getElementById("signup-confirm-password").value;
        if (password !== confirm) return alert("Passwords do not match!");
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await ensureUserDoc(cred.user);
            saveUserSession(cred.user);
            window.location.href = "index.html";
        } catch(e) { alert(e.message); }
    });
}

// ── Login form ─────────────────────────────────────────────────
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email    = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            saveUserSession(cred.user);
            window.location.href = "index.html";
        } catch(e) { alert(e.message); }
    });
}

// ── Auth state listener ────────────────────────────────────────
// Skip entirely if Google redirect is in progress —
// login.html handles that case on its own
const googleRedirectInProgress = sessionStorage.getItem('googleRedirectPending');

auth.onAuthStateChanged((user) => {
    // If Google redirect is in progress, do nothing —
    // login.html's getRedirectResult will handle it
    if (googleRedirectInProgress) return;

    const isAuthPage = window.location.href.includes("login.html") ||
                       window.location.href.includes("signup.html");
    if (user) {
        saveUserSession(user);
        if (isAuthPage) window.location.href = "index.html";
    } else {
        const isProtected = window.location.href.includes("tracker.html") ||
                            window.location.href.includes("stats.html")   ||
                            window.location.href.includes("index.html");
        if (isProtected && !localStorage.getItem('offline_user_session')) {
            window.location.href = "login.html";
        }
    }
});

// ── Forgot password ────────────────────────────────────────────
const forgotBtn = document.getElementById("forgot-password");
if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
        const emailEl = document.getElementById("login-email");
        if (!emailEl || !emailEl.value) return alert("Please enter your email first.");
        try {
            await auth.sendPasswordResetEmail(emailEl.value);
            alert("Password reset email sent!");
        } catch(e) { alert(e.message); }
    });
}

// ── Logout ─────────────────────────────────────────────────────
const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem('offline_user_session');
        auth.signOut().then(() => window.location.href = "login.html");
    });
}