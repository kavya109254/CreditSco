// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA2Ni0bFyJwD-w2pKUG0JLWGT4C2_T97ns",
  authDomain: "creditsco-462f6.firebaseapp.com",
  projectId: "creditsco-462f6",
  storageBucket: "creditsco-462f6.firebasestorage.app",
  messagingSenderId: "449205658179",
  appId: "1:449205658179:web:fe9f9b379f855860656af6",
  measurementId: "G-97NNWXKPSD"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Services
export const auth = getAuth(app);
export const db = getFirestore(app);  
