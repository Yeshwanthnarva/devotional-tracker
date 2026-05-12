// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyAf9irHJ0QF42Ke4yp97z2jZUUKPpnUGdQ",
    authDomain: "devotional-tracker-7a39a.web.app",
    projectId: "devotional-tracker-7a39a",
    storageBucket: "devotional-tracker-7a39a.firebasestorage.app",
    messagingSenderId: "485605016342",
    appId: "1:485605016342:web:91aab150045637928c8637"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("✅ Firebase ready");