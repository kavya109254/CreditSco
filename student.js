import { auth, db } from "./firebase-config.js"; 
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { query, where } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import {
  doc, getDoc, updateDoc, collection, getDocs,
  setDoc, serverTimestamp, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";


const $id = (id) => document.getElementById(id) || null;
let currentStudent = null;

function parseToDate(field) {
  if (!field) return null;
  if (typeof field.toDate === "function") return field.toDate();
  if (field instanceof Date) return field;
  if (typeof field === "string") {
    const parts = field.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parts[0], parts[1]-1, parts[2]);
      if (parts[2].length === 4 && Number(parts[0]) > 12) return new Date(parts[2], parts[1]-1, parts[0]);
      return new Date(parts[2], parts[0]-1, parts[1]);
    }
  }
  return null;
}
function formatDate(field) {
  const d = parseToDate(field);
  return d ? d.toLocaleDateString("en-US") : "TBA";
}

//Tab Switching
const tabs = document.querySelectorAll(".nav-links a, .sidebar a");
const sections = document.querySelectorAll("section.tab");
tabs.forEach(tab=>{
  tab.addEventListener("click", e=>{
    e.preventDefault();
    tabs.forEach(t=>t.classList.remove("active"));
    sections.forEach(s=>s.classList.remove("active"));
    tab.classList.add("active");
    $id(tab.dataset.tab)?.classList.add("active");
    document.querySelector(".sidebar")?.classList.remove("active");
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index.html";
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "student") {
    alert("Access denied.");
    await signOut(auth);
    return window.location.href = "index.html";
  }

  currentStudent = { uid: user.uid, ...snap.data() };

  // Profile fields
  $id("studentName").textContent = currentStudent.name || "Student";
  $id("profileName").textContent = currentStudent.name || "";
  $id("profileEmail").textContent = currentStudent.email || "";
  $id("profileDept").textContent = currentStudent.department || "";
  $id("profileDegree").textContent = currentStudent.degree || "";
  $id("profileRoll").value = currentStudent.rollno || "";
  if (currentStudent.year) $id("profileYear").value = currentStudent.year;

  // Credits
  await updateDoc(doc(db, "users", user.uid), {}); 
  listenToStudentOverview(user.uid);

  // Semester information and permissions
  try {
    const adminRef = doc(db, "admin", "settings");
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data();

      // show current semester
      const csEl = $id("currentSemester");
      if (csEl) csEl.textContent = data.currentSemester || "Not set";

      // Roll update permission
      if (data.allowRollUpdate) {
        $id("profileRoll").removeAttribute("readonly");
        if ($id("saveRollBtn")) $id("saveRollBtn").style.display = "inline-block";

        $id("saveRollBtn")?.addEventListener("click", async () => {
          const newRoll = $id("profileRoll").value.trim();
          if (!newRoll) return alert("Please enter a roll number.");
          try {
            await updateDoc(doc(db, "users", currentStudent.uid), { rollno: newRoll });
            alert("✅ Roll number updated!");
          } catch (err) {
            alert("Update failed: " + err.message);
          }
        });
      }

      if (data.allowYearUpdate) {
        $id("profileYear").removeAttribute("disabled"); // enable dropdown
        if ($id("saveYearBtn")) $id("saveYearBtn").style.display = "inline-block";
        if (currentStudent.year) {
          $id("profileYear").value = currentStudent.year;
        }

        $id("saveYearBtn")?.addEventListener("click", async () => {
          const newYear = $id("profileYear").value.trim();
          if (!newYear) return alert("Please select year.");
          try {
            await updateDoc(doc(db, "users", currentStudent.uid), { year: newYear });
            alert("✅ Year updated!");
          } catch (err) {
            alert("Update failed: " + err.message);
          }
        });
      }
    }
  } catch (err) {
    console.error("Semester error:", err);
    const csEl = $id("currentSemester");
    if (csEl) csEl.textContent = "Not set";
  }

  loadEvents();
  loadMyEvents();
  loadMyActivities();
});

//Overview 
function listenToStudentOverview(uid) {
  const ref = doc(db, "users", uid);

  // Real-time listener for student updates
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const s = snap.data();

    const academic = s.academicCredits || 0;
    const activity = s.activityCredits || 0;
    const external = s.externalCredits || 0;
    const total = academic + activity + external;

    const required = 22;
    const percent = Math.min((total / required) * 100, 100);

    const earnedEl = document.getElementById("earnedCredits");
    const requiredEl = document.getElementById("requiredCredits");
    const progressBar = document.getElementById("progressFill");

    if (earnedEl) earnedEl.textContent = total;
    if (requiredEl) requiredEl.textContent = required;

    if (progressBar) {
      progressBar.style.width = `${percent}%`;
      progressBar.style.height = "8px";
      progressBar.style.borderRadius = "10px";
      progressBar.style.background = "#4CAF50";
      progressBar.style.transition = "width 0.6s ease";
    }

    console.log(`🔥 Progress updated: ${total}/${required} credits (${Math.floor(percent)}%)`);
  });
}


//Load Events
async function loadEvents() {
  const container = $id("eventsList");
  container.innerHTML = "<p>Loading events...</p>";

  try {
    const qs = await getDocs(collection(db, "events"));
    if (qs.empty) return container.innerHTML = "<p>No events right now.</p>";

    let upcomingHTML = "<h2>Upcoming Events</h2>";
    let pastHTML = "<h2>Past Events</h2>";
    const now = new Date();

    for (const docSnap of qs.docs) {
      const ev = docSnap.data();

      // fetch club info
      let clubName = "Unknown Club";
      let clubDesc = "No description available.";
      if (ev.clubId) {
        try {
          const clubSnap = await getDoc(doc(db, "clubs", ev.clubId));
          if (clubSnap.exists()) {
            const club = clubSnap.data();
            clubName = club.clubName || "Unknown Club";
            clubDesc = club.description || "No description available.";
          }
        } catch (err) {
          console.warn("⚠️ Club fetch failed:", err);
        }
      }

      const evDate = parseToDate(ev.eventDate);
      const isPast = evDate && evDate < now;

      const card = `
        <div class="event-card ${isPast ? "past" : ""}">
          <h3>${ev.title || "Untitled Event"}</h3>
          <p class="event-desc">${(ev.description || "").replace(/\n/g, "<br>")}</p>
          <p><strong>Date:</strong> ${formatDate(ev.eventDate)}</p>
          <p><strong>Deadline:</strong> ${formatDate(ev.registrationDeadline)}</p>
          <p><strong>Credits:</strong> ${ev.credits || 0}</p>

          ${(() => {
            const regDeadline = parseToDate(ev.registrationDeadline);
            if (isPast) {
              return `<span class="badge past">Past Event</span>`;
            } else if (regDeadline && now > regDeadline) {
              return `<span class="badge closed">Registration Closed</span>`;
            } else {
              return `<button class="register-btn" data-id="${docSnap.id}" data-title="${ev.title}">Register</button>`;
            }
          })()}

          <p class="club-link" data-name="${clubName}" data-desc="${clubDesc}">
            <strong>Posted by:</strong> 
            <a href="#" class="club-popup">${clubName}</a>
          </p>

        </div>
      `;

      if (isPast) pastHTML += card;
      else upcomingHTML += card;
    }

    container.innerHTML = upcomingHTML + '<div class="events-sections">' + pastHTML + '</div>';

    // Register buttons
    document.querySelectorAll(".register-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        $id("regEventId").value = btn.dataset.id;
        $id("regEventTitle").value = btn.dataset.title;
        $id("registrationModal").classList.add("show");
      });
    });

    // Club popups
    document.querySelectorAll(".club-popup").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const parent = link.closest(".club-link");
        $id("clubModalName").textContent = parent.dataset.name;
        const rawDesc = parent.dataset.desc || "No description available.";
        $id("clubModalDesc").innerHTML = `<p>${rawDesc.replace(/\n/g, "<br>")}</p>`;
        $id("clubModal").classList.add("show");
      });
    });

  } catch (e) {
    console.error("Error loading events:", e);
    container.innerHTML = "<p>Error loading events.</p>";
  }
}

document.querySelector("#clubModal .close-btn")?.addEventListener("click", () => {
  $id("clubModal").classList.remove("show");
});


//Load My Events
async function loadMyEvents() {
  const list = $id("myEventsList");
  list.innerHTML = "<li>Loading...</li>";

  try {
    const q = query(
      collection(db, "registrations"),
      where("studentId", "==", currentStudent.uid)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = "<li>No events registered yet.</li>";
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const r = d.data();
      let reasonText = "";

      if (r.status?.toLowerCase() === "rejected" && r.rejectionReason) {
        reasonText = `<p><strong>Reason:</strong> ${r.rejectionReason}</p>`;
      } else if (r.status?.toLowerCase() === "approved" && Number(r.creditsAssigned) === 0 && r.reason) {
        reasonText = `<p><strong>Reason (0 credits):</strong> ${r.reason}</p>`;
      }

      return `
        <div class="card">
          <h3>${r.eventTitle}</h3>
          <p><strong>Status:</strong> 
            <span class="badge ${
              r.status === "Approved" ? "Success" :
              r.status === "Approved by Faculty" ? "Success" :
              r.status === "Rejected" ? "Error" :
              r.status === "Rejected by Faculty" ? "Error" :
              r.status === "Waiting for Faculty Approval" ? "Warning" :
              "Pending"
            }">
              ${r.status}
            </span>
          </p>
          <p><strong>Roll No:</strong> ${r.rollno || "-"}</p>
          <p><strong>Department:</strong> ${r.department || "-"}</p>
          <p><strong>Year:</strong> ${r.year || "-"}</p>
          ${reasonText}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("My Events error:", err);
    list.innerHTML = "<li>Error loading your events.</li>";
  }
}

//Load My Activities
async function loadMyActivities() {
  const list = $id("activitiesList");
  list.innerHTML = "<li>Loading...</li>";

  try {
    const q = query(
      collection(db, "credit_history"),
      where("studentId", "==", currentStudent.uid)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      list.innerHTML = "<li>No activities completed yet.</li>";
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const a = d.data();
      return `
        <div class="card">
          <h3>${a.eventTitle || a.activityName || "Activity"}</h3>
          <p><strong>Type:</strong> ${a.type || "-"}</p>
          <p><strong>Status:</strong> 
            <span class="badge ${
              a.status === "Approved" ? "Success" :
              a.status === "Rejected" ? "Error" : "Pending"
            }">${a.status}</span>
          </p>
          <p><strong>Credits:</strong> ${a.creditsAssigned || 0}</p>
          ${a.remarks ? `<p><strong>Remarks:</strong> ${a.remarks}</p>` : ""}
          ${a.reason ? `<p><strong>Reason:</strong> ${a.reason}</p>` : ""}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("❌ My Activities error:", err);
    list.innerHTML = "<li>Error loading your activities.</li>";
  }
}


//Registration Form 
$id("registrationForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const eventId=$id("regEventId").value;
  const eventTitle=$id("regEventTitle").value;
  const phone=$id("regPhone").value.trim();
  if(!eventId||!phone) return alert("Enter phone");
  await setDoc(doc(db,"registrations",`${eventId}_${auth.currentUser.uid}`),{
    eventId,
    eventTitle,
    studentId:auth.currentUser.uid,
    studentName:currentStudent.name,
    rollno:currentStudent.rollno,
    year:currentStudent.year,
    department:currentStudent.department,
    email:currentStudent.email,
    phone,
    status:"Pending",
    timestamp:serverTimestamp()
  });

  alert("✅ Registration submitted!");
  $id("registrationModal").classList.remove("show");

  loadMyEvents();
  });
$id("closeModal")?.addEventListener("click",()=> $id("registrationModal").classList.remove("show"));

// External Activities Submission 

const externalForm = $id("externalForm");
const formMsg = $id("formMsg");
const mySubmissionsDiv = $id("mySubmissions");

const proofFileInput = $id("proofFile");
const fileLabel = $id("fileLabel");
const fileLabelText = $id("fileLabelText");
const removeFileBtn = $id("removeFileBtn");
const proofTypeSelect = $id("proofType");
const urlGroup = $id("urlGroup");
const fileGroup = $id("fileGroup");

//  Proof Type Toggle 
if (proofTypeSelect) {
  fileGroup.style.display = "none";
  urlGroup.style.display = "none";

  proofTypeSelect.addEventListener("change", () => {
    const val = proofTypeSelect.value;
    if (val === "upload") {
      fileGroup.style.display = "block";
      urlGroup.style.display = "none";
    } else if (val === "online") {
      fileGroup.style.display = "none";
      urlGroup.style.display = "block";
    } else {
      fileGroup.style.display = "none";
      urlGroup.style.display = "none";
    }
  });
}

// File Upload UI 
if (proofFileInput) {
  proofFileInput.addEventListener("change", () => {
    const file = proofFileInput.files[0];
    if (file) {
      fileLabelText.innerHTML = `<i class="file-icon">📄</i> ${file.name}`;
      removeFileBtn.style.display = "inline-flex";
      fileLabel.classList.add("file-selected");
    }
  });

  removeFileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    proofFileInput.value = "";
    fileLabelText.innerHTML = `<i class="file-icon">📄</i> Choose File`;
    removeFileBtn.style.display = "none";
    fileLabel.classList.remove("file-selected");
  });
}

// Submit Form
if (externalForm) {
  externalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "Submitting...";

    const eventName = $id("eventName").value.trim();
    const organizer = $id("organizer").value.trim();
    const category = $id("category").value.trim();
    const dateValue = $id("eventDate").value;
    const description = $id("description").value.trim();
    const proofType = $id("proofType").value;
    const proofFile = $id("proofFile").files[0];
    const proofURLInput = $id("proofURLInput") ? $id("proofURLInput").value.trim() : "";

    let proofBase64 = "";
    let proofLink = "";

    try {
      if (proofType === "upload" && proofFile) {
        // Limit file size to 1 MB for Firestore
        if (proofFile.size > 1000000) {
          alert("Please upload a smaller file (under 1MB)");
          formMsg.textContent = "";
          return;
        }

        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        reader.readAsDataURL(proofFile);
        proofBase64 = await base64Promise;
      } else if (proofType === "online" && proofURLInput) {
        proofLink = proofURLInput;
      }
    } catch (error) {
      console.error("File conversion failed:", error);
      formMsg.textContent = "⚠️ Could not read file. Try again.";
      return;
    }

    try {
      await setDoc(doc(collection(db, "externalSubmissions")), {
        studentId: currentStudent.uid,
        studentName: currentStudent.name,
        roleno: currentStudent.rollno || "N/A",
        department: currentStudent.department || "N/A",
        year: currentStudent.year || "N/A",
        degree: currentStudent.degree || "N/A",
        email: currentStudent.email || "N/A",
        eventName,
        organizer,
        category,
        date: Timestamp.fromDate(new Date(dateValue)),
        description,
        proofType,
        proofFile: proofBase64, // stored as Base64
        proofURL: proofLink,   // stored as link (optional)
        credits: 0,
        status: "Pending",
        remarks: "",
        reviewedBy: "",
        submittedAt: serverTimestamp(),
      });

      formMsg.textContent = "✅ Submission successful!";
      externalForm.reset();
      loadMyExternalSubmissions();
    } catch (error) {
      console.error("Submission failed:", error);
      formMsg.textContent = "❌ Error submitting. Try again.";
    }
  });
}

// Load My Submissions 
async function loadMyExternalSubmissions() {
  if (!currentStudent || !mySubmissionsDiv) return;

  const q = query(collection(db, "externalSubmissions"), where("studentId", "==", currentStudent.uid));
  const snap = await getDocs(q);
  mySubmissionsDiv.innerHTML = "";

  if (snap.empty) {
    mySubmissionsDiv.innerHTML = "<p>No submissions yet.</p>";
    return;
  }

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const formattedDate = d.date?.toDate ? d.date.toDate().toLocaleDateString() : "-";
    const submittedAt = d.submittedAt?.toDate ? d.submittedAt.toDate().toLocaleString() : "-";

    let proofSection = "";
    if (d.proofType === "online" && d.proofURL) {
      proofSection = `<a href="${d.proofURL}" target="_blank">View Online Proof</a>`;
    } else if (d.proofType === "upload" && d.proofFile) {
      proofSection = `<a href="${d.proofFile}" target="_blank">View Uploaded File</a>`;
    } else {
      proofSection = `<em style="color:#aaa;">No proof available</em>`;
    }

    mySubmissionsDiv.innerHTML += `
      <div class="card submission-card">
        <h3>${d.eventName}</h3>
        <p><b>Organizer:</b> ${d.organizer}</p>
        <p><b>Category:</b> ${d.category}</p>
        <p><b>Date:</b> ${formattedDate}</p>
        <p><b>Submitted:</b> ${submittedAt}</p>
        <p><b>Status:</b> 
          <span class="badge ${d.status === "Approved" ? "Success" : d.status === "Rejected" ? "Error" : "Pending"}">
            ${d.status}
          </span>
        </p>
        ${d.remarks ? `<p><b>Remarks:</b> ${d.remarks}</p>` : ""}
        <p><b>Proof:</b> ${proofSection}</p>
      </div>
    `;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if ($id("mySubmissions")) loadMyExternalSubmissions();
});

//Logout
$id("logoutBtn")?.addEventListener("click",async()=>{
  await signOut(auth);
  window.location.href="index.html";
});
