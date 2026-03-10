// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAf9irHJ0QF42Ke4yp97z2jZUUKPpnUGdQ",
  authDomain: "devotional-tracker-7a39a.firebaseapp.com",
  projectId: "devotional-tracker-7a39a",
  storageBucket: "devotional-tracker-7a39a.firebasestorage.app",
  messagingSenderId: "485605016342",
  appId: "1:485605016342:web:91aab150045637928c8637"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.firestore();
