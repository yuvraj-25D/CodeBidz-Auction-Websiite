import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHYzphQrY4s9tQex0QFX-w8Q354qMUDwY",
  authDomain: "bidding-site-c3cfd.firebaseapp.com",
  projectId: "bidding-site-c3cfd",
  storageBucket: "bidding-site-c3cfd.firebasestorage.app",
  messagingSenderId: "892052236548",
  appId: "1:892052236548:web:57a6bfdd16c94e25698851",
  measurementId: "G-2005MSKW5L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services to be used in other JS files
export const auth = getAuth(app);
export const db = getFirestore(app);