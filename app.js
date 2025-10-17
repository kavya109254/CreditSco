console.log("app.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyA2Ni0bFyJwD-w2pKUG0JLWGT4C2_T97ns",
  authDomain: "creditsco-462f6.firebaseapp.com",
  projectId: "creditsco-462f6",
  storageBucket: "creditsco-462f6.firebasestorage.app",
  messagingSenderId: "449205658179",
  appId: "1:449205658179:web:fe9f9b379f855860656af6",
  measurementId: "G-97NNWXKPSD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login Handler 
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    document.getElementById("errorMessage").style.display = "none";
    document.getElementById("errorMessage").textContent = "";

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const role = userDoc.data().role;

      if (role === "student") window.location.href = "student.html";
      else if (role === "faculty") window.location.href = "faculty.html";
      else if (role === "club_head") window.location.href = "clubHead.html";
      else if (role === "admin") window.location.href = "admin.html";
      else alert("Unknown role!");
    } else {
      const errorBox = document.getElementById("errorMessage");
      errorBox.style.display = "block";
      errorBox.textContent = "User data not found!";
    }

  } catch (error) {
    console.error("LOGIN ERROR:", error.code, error.message);

    let msg = "Incorrect email or password. Please check and try again.";

    if (error.code === "auth/user-not-found") {
      msg = "No account found with this email. Please check again.";
    } else if (error.code === "auth/wrong-password") {
      msg = "Incorrect password. Please try again.";
    } else if (error.code === "auth/invalid-email") {
      msg = "Please enter a valid email address.";
    }

    const errorBox = document.getElementById("errorMessage");
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }
});
