// admin.js
import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

let currentAdmin = null;

const $id = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));


function initUI() {
  const menuToggle = qs(".menu-toggle");
  const sidebar = qs(".sidebar");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      console.log("☰ clicked");
      sidebar.classList.add("active");
    });
  }

  qsa(".sidebar .close-btn").forEach(btn => {
    btn.addEventListener("click", () => sidebar?.classList.remove("active"));
  });

  qsa(".sidebar a").forEach(a => {
    a.addEventListener("click", () => sidebar?.classList.remove("active"));
  });

  const themeToggle = $id("theme-toggle");
  if (themeToggle) {
    const root = document.documentElement;
    const updateIcon = () => {
      const t = root.getAttribute("data-theme") || "light";
      themeToggle.textContent = t === "light" ? "🌙" : "☀️";
    };
    updateIcon();

    const mo = new MutationObserver(() => updateIcon());
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  qsa(".topbar .nav-links a").forEach(a => {
    a.addEventListener("click", () => sidebar?.classList.remove("active"));
  });
}

//Tab Switching
function initTabs() {
  const tabs = document.querySelectorAll(".nav-links a, .sidebar a");
  const sections = document.querySelectorAll("main .tab");

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));

      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById(target)?.classList.add("active");

      qs(".sidebar")?.classList.remove("active");

      const editModal = $id("editUserModal");
      if (editModal) editModal.style.display = "none";

      if (target === "students") loadStudents();
      if (target === "faculty") loadFaculty();
      if (target === "clubs") loadClubs();
      if (target === "events") loadEvents();
      if (target === "semester") loadSemesterSettings(currentAdmin?.uid || "settings");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initUI();
  initTabs();
});

//Authorization
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists() || snap.data().role !== "admin") {
      alert("Access denied. Not an admin.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentAdmin = { uid: user.uid, ...snap.data() };

    const topName = $id("adminNameTop");
    const bigName = $id("adminNameBig");
    if (topName) topName.textContent = currentAdmin.name || user.email;
    if (bigName) bigName.textContent = currentAdmin.name || "Admin";

  await loadStudents();
  await loadFaculty();
  await loadClubs();
  await loadEvents();
  await loadSemesterSettings();
  } catch (err) {
    console.error("Auth init error:", err);
    alert("Initialization error. See console.");
  }
});

function makeCard(html) {
  const c = document.createElement("div");
  c.className = "card";
  c.innerHTML = html;
  return c;
}

//Students
const studentsList = $id("studentsList");

async function loadStudents(search = "") {
  if (!studentsList) return;
  studentsList.innerHTML = "<p>Loading...</p>";
  try {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const snap = await getDocs(q);
    const lower = (search || "").toLowerCase();
    studentsList.innerHTML = "";

    snap.forEach((docSnap) => {
      const s = docSnap.data();
      if (lower && !(
        (s.name || "").toLowerCase().includes(lower) ||
        (s.email || "").toLowerCase().includes(lower) ||
        (s.rollno || "").toLowerCase().includes(lower) ||
        (s.degree || "").toLowerCase().includes(lower) ||
        (s.department || "").toLowerCase().includes(lower)
      )) return;

      const card = makeCard(`
        <strong>${s.name || "-"}</strong> (${s.rollno || "-"})<br>
        ${s.degree || ""} • ${s.department || ""} • ${s.year || ""}<br>
        ${s.email || ""}<br>
        Credits: ${s.totalCredits ?? 0}
        <div class="controls">
          <button class="edit">Edit</button>
          <button class="delete danger">Delete</button>
        </div>
      `);

      card.querySelector(".edit").addEventListener("click", () => openEditModal(docSnap.id, s));
      card.querySelector(".delete").addEventListener("click", async () => {
        if (!confirm("Delete this student?")) return;
        try {
          await deleteDoc(doc(db, "users", docSnap.id));
          loadStudents();
        } catch (err) {
          alert("Delete failed: " + err.message);
        }
      });

      studentsList.appendChild(card);
    });

    if (studentsList.children.length === 0) {
      studentsList.innerHTML = "<p>No students found.</p>";
    }
  } catch (err) {
    console.error("loadStudents error:", err);
    studentsList.innerHTML = "<p>Could not load students.</p>";
  }
}

$id("addStudentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = $id("studentUID").value.trim();
  const name = $id("studentName").value.trim();
  const email = $id("studentEmail").value.trim();
  const rollno = $id("studentRoll").value.trim();
  const degree = $id("studentDegree").value.trim();
  const department = $id("studentDept").value.trim();
  const year = $id("studentYear").value.trim();

  try {
    await setDoc(doc(db, "users", uid), {
      name,
      email,
      rollno,
      degree,
      department,
      year,
      role: "student",
      academicCredits: 0,
      externalCredits: 0,
      totalCredits: 0
    });
    alert("✅ Student added successfully.");
    e.target.reset();
    loadStudents();
  } catch (err) {
    alert("Error adding student: " + err.message);
  }
});

$id("studentSearch")?.addEventListener("input", (e) => {
  loadStudents(e.target.value || "");
});

//Faculty
const facultyList = $id("facultyList");

async function loadFaculty(search = "") {
  if (!facultyList) return;
  facultyList.innerHTML = "<p>Loading...</p>";
  try {
    const q = query(collection(db, "users"), where("role", "==", "faculty"));
    const snap = await getDocs(q);
    const lower = (search || "").toLowerCase();
    facultyList.innerHTML = "";

    snap.forEach((docSnap) => {
      const f = docSnap.data();
      if (lower && !(
        (f.name || "").toLowerCase().includes(lower) ||
        (f.email || "").toLowerCase().includes(lower) ||
        (f.department || "").toLowerCase().includes(lower)
      )) return;

      const card = makeCard(`
        <strong>${f.name || "-"}</strong> - ${f.department || ""}<br>
        ${f.email || ""}
        <div class="controls">
          <button class="edit">Edit</button>
          <button class="delete danger">Delete</button>
        </div>
      `);

      card.querySelector(".edit").addEventListener("click", async () => {
        const newDept = prompt("Department:", f.department) || f.department;
        try {
          await updateDoc(doc(db, "users", docSnap.id), { department: newDept });
          loadFaculty();
        } catch (err) {
          alert("Update failed: " + err.message);
        }
      });

      card.querySelector(".delete").addEventListener("click", async () => {
        if (!confirm("Delete this faculty?")) return;
        try {
          await deleteDoc(doc(db, "users", docSnap.id));
          loadFaculty();
        } catch (err) {
          alert("Delete failed: " + err.message);
        }
      });

      facultyList.appendChild(card);
    });

    if (facultyList.children.length === 0) facultyList.innerHTML = "<p>No faculty found.</p>";
  } catch (err) {
    console.error("loadFaculty error:", err);
    facultyList.innerHTML = "<p>Could not load faculty.</p>";
  }
}

$id("addFacultyForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = $id("facultyUID").value.trim();
  const name = $id("facultyName").value.trim();
  const email = $id("facultyEmail").value.trim();
  const dept = $id("facultyDept").value.trim();

  try {
    await setDoc(doc(db, "users", uid), {
      name,
      email,
      department: dept,
      role: "faculty"
    });
    alert("Faculty added successfully!");
    e.target.reset();
    loadFaculty();
  } catch (err) {
    alert("Error adding faculty: " + err.message);
  }
});

$id("facultySearch")?.addEventListener("input", (e) => {
  loadFaculty(e.target.value);
});

//Clubs
const clubsList = $id("clubsList");

$id("addClubForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = $id("clubUID").value.trim();
  const clubName = $id("clubName").value.trim();
  const desc = $id("clubDescription").value.trim();
  let headEmail = $id("clubHeadEmail").value.trim();
  let headName = "";

  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (!headEmail) headEmail = userData.email || "";
      headName = userData.name || "";
    }

    if (!headName) {
      headName = prompt("Enter Club Head Name:", "") || "Unknown";
    }

    await addDoc(collection(db, "clubs"), {
      clubName,
      description: desc,
      headId: uid,
      email: headEmail,
      name: headName,
      createdAt: serverTimestamp()
    });

    if (uid) {
      try { await updateDoc(doc(db, "users", uid), { role: "club_head" }); } catch (e) { console.warn("Could not update user role", e); }
    }

    alert("Club added successfully!");
    e.target.reset();
    loadClubs();
  } catch (err) {
    alert("Error creating club: " + err.message);
  }
});

async function loadClubs(search = "") {
  if (!clubsList) return;
  clubsList.innerHTML = "<p>Loading...</p>";
  try {
    const snap = await getDocs(collection(db, "clubs"));
    const lower = (search || "").toLowerCase();
    clubsList.innerHTML = "";

    snap.forEach((docSnap) => {
      const c = docSnap.data();
      if (lower && !(
        (c.clubName || "").toLowerCase().includes(lower) ||
        (c.email || "").toLowerCase().includes(lower) ||
        (c.name || "").toLowerCase().includes(lower)
      )) return;

      const card = makeCard(`
        <h3 class="club-title">${c.clubName || "-"}</h3>
        <p class="club-desc">${c.description || ""}</p>
        <p><strong>Head Name:</strong> ${c.name || "N/A"}</p>
        <p><strong>Head Email:</strong> ${c.email || "N/A"}</p>
        <p><strong>Head UID:</strong> ${c.headId || "N/A"}</p>
        <div class="controls">
          <button class="edit">Edit Head</button>
          <button class="delete">Delete Club</button>
        </div>
      `);

      // Edit button
      card.querySelector(".edit").addEventListener("click", async () => {
        const newName = prompt("Enter new Head Name:", c.name || "");
        const newEmail = prompt("Enter new Head Email:", c.email || "");
        if (!newName && !newEmail) return;
        try {
          await updateDoc(doc(db, "clubs", docSnap.id), {
            name: newName || c.name,
            email: newEmail || c.email
          });
          if (c.headId) {
            await updateDoc(doc(db, "users", c.headId), {
              name: newName || c.name,
              email: newEmail || c.email,
              role: "club_head"
            });
          }
          alert("Club Head updated!");
          loadClubs();
        } catch (err) {
          alert("Update failed: " + err.message);
        }
      });

      // Delete button
      card.querySelector(".delete").addEventListener("click", async () => {
        if (!confirm("Delete this club?")) return;
        try {
          await deleteDoc(doc(db, "clubs", docSnap.id));
          loadClubs();
        } catch (err) {
          alert("Delete failed: " + err.message);
        }
      });

      clubsList.appendChild(card);
    });

    if (clubsList.children.length === 0) clubsList.innerHTML = "<p>No clubs found.</p>";
  } catch (err) {
    console.error("loadClubs error:", err);
    clubsList.innerHTML = "<p>Could not load clubs.</p>";
  }
}

//Club Search 
$id("clubSearch")?.addEventListener("input", (e) => {
  loadClubs(e.target.value || "");
});

//Events 
const eventsSection = $id("eventsList");

async function loadEvents() {
  if (!eventsSection) return;
  eventsSection.innerHTML = "<p>Loading events...</p>";
  try {
    const snap = await getDocs(collection(db, "events"));
    if (snap.empty) {
      eventsSection.innerHTML = "<p>No events available right now.</p>";
      return;
    }

    let upcomingHTML = "<h2>Upcoming Events</h2>";
    let pastHTML = "<h2>Past Events</h2>";

    const now = new Date();

    for (const docSnap of snap.docs) {
      const ev = docSnap.data();

      let clubName = "Unknown Club";
      let clubDesc = "No description available.";
      if (ev.clubId) {
        try {
          const clubRef = doc(db, "clubs", ev.clubId);
          const clubSnap = await getDoc(clubRef);
          if (clubSnap.exists()) {
            const clubData = clubSnap.data();
            clubName = clubData.clubName || "Unknown Club";
            clubDesc = clubData.description || "No description available.";
          }
        } catch (err) {
          console.warn("Club fetch failed for event:", err);
        }
      }

      const evDate = ev.eventDate ? new Date(ev.eventDate) : null;
      const isPast = evDate && evDate < now;

      const cardHTML = `
        <div class="event-card ${isPast ? "past" : ""}">
          <h3>${ev.title || "Untitled Event"}</h3>
          <p class="event-desc">${(ev.description || "").replace(/\n/g, "<br>")}</p>
          <p><strong>Date:</strong> ${ev.eventDate || "TBA"}</p>
          <p><strong>Deadline:</strong> ${ev.registrationDeadline || "TBA"}</p>
          <p><strong>Credits:</strong> ${ev.credits || 0}</p>

          ${isPast ? `<span class="badge past">Past Event</span>` : ""}

          <p class="club-link" data-name="${escapeHtml(clubName)}" data-desc="${escapeHtml(clubDesc)}">
            <strong>Posted by:</strong> <a href="#" class="club-popup">${escapeHtml(clubName)}</a>
          </p>
        </div>
      `;

      if (isPast) pastHTML += cardHTML;
      else upcomingHTML += cardHTML;
    }

  eventsSection.innerHTML = upcomingHTML + '<div class="events-sections">' + pastHTML + '</div>';

    qsa(".club-popup").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const parent = link.closest(".club-link");
        const name = parent.getAttribute("data-name");
        const desc = parent.getAttribute("data-desc");
        showClubPopup(name, desc);
      });
    });

  } catch (err) {
    console.error("loadEvents error:", err);
    eventsSection.innerHTML = "<p>Failed to load events.</p>";
  }
}

function showClubPopup(name, desc) {
  const modal = document.getElementById("clubModal");
  if (!modal) return;

  document.getElementById("clubModalName").textContent = name;
  document.getElementById("clubModalDesc").innerHTML = desc.replace(/\n/g, "<br>");

  modal.classList.add("show");
  modal.querySelector(".close-btn").onclick = () => {
    modal.classList.remove("show");
  };
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


//Semester Controls
async function loadSemesterSettings() {
  try {
    const ref = doc(db, "admin", "settings");  
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      $id("currentSemester") && ($id("currentSemester").textContent = "Not set");
      $id("lastReset") && ($id("lastReset").textContent = "Not set");
      $id("rollUpdateStatus") && ($id("rollUpdateStatus").textContent = "Not set");
      $id("yearUpdateStatus") && ($id("yearUpdateStatus").textContent = "Not set");
      return;
    }

    const data = snap.data();
    console.log("Semester settings data:", data);

    $id("currentSemester").textContent = data.currentSemester || "Not set";
    $id("lastReset").textContent =
      data.lastReset?.toDate ? data.lastReset.toDate().toLocaleString() : "Not set";
    $id("rollUpdateStatus").textContent = data.allowRollUpdate ? "Open" : "Closed";
    $id("yearUpdateStatus").textContent = data.allowYearUpdate ? "Open" : "Closed";

    $id("adminSemesterOverview") && ($id("adminSemesterOverview").textContent = data.currentSemester || "Not set");

  } catch (err) {
    console.error("loadSemesterSettings error:", err);
  }
}

$id("updateSemesterBtn")?.addEventListener("click", async () => {
  const val = $id("editSemesterInput").value.trim();
  if (!val) return alert("Please enter semester text.");
  try {
    await updateDoc(doc(db, "admin", "settings"), { currentSemester: val });
    await loadSemesterSettings();
    alert("Semester text updated.");
  } catch (err) {
    alert("Update failed: " + err.message);
  }
});

$id("resetCreditsBtn")?.addEventListener("click", async () => {
  const confirmed = confirm("Are you sure you want to reset ALL student credits?");
  if (!confirmed) return;

  try {
    console.log("Fetching all users...");
    const usersSnap = await getDocs(collection(db, "users"));
    console.log("Total users in database:", usersSnap.size);

    let studentCount = 0;
    const batch = writeBatch(db);

    usersSnap.forEach((docSnap) => {
      const user = docSnap.data();
      const userRef = doc(db, "users", docSnap.id);

      if (user.role?.toLowerCase() === "student") {
        studentCount++;
        console.log(`Resetting: ${user.name || docSnap.id}`);
        batch.set(
          userRef,
          {
            academicCredits: 0,
            externalCredits: 0,
            totalCredits: 0
          },
          { merge: true }
        );
      }
    });

    if (studentCount === 0) {
      alert("No student documents found!");
      return;
    }

    console.log("Resetting credits for", studentCount, "students...");
    await batch.commit();
    console.log("Credits successfully reset for all students.");

    await updateDoc(doc(db, "admin", "settings"), {
      lastReset: serverTimestamp()
    });

    alert(`Credits reset for ${studentCount} students!`);
  } catch (error) {
    console.error("Error during credit reset:", error);
    alert("Reset failed: " + error.message);
  }
});

$id("toggleRollUpdateBtn")?.addEventListener("click", async () => {
  try {
    const ref = doc(db, "admin", "settings"); 
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Semester doc not found.");
      return;
    }
    await updateDoc(ref, { allowRollUpdate: !snap.data().allowRollUpdate });
    loadSemesterSettings();
  } catch (err) {
    alert("Toggle failed: " + err.message);
  }
});

$id("toggleYearUpdateBtn")?.addEventListener("click", async () => {
  try {
    const ref = doc(db, "admin", "settings");  
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Semester doc not found.");
      return;
    }
    await updateDoc(ref, { allowYearUpdate: !snap.data().allowYearUpdate });
    loadSemesterSettings();
  } catch (err) {
    alert("Toggle failed: " + err.message);
  }
});

const modal = $id("editUserModal");
const saveBtn = $id("saveEditBtn");
const cancelBtn = $id("cancelEditBtn");
const closeEditBtn = $id("closeEditBtn");

function openEditModal(uid, userData) {
  if (!modal) return;
  modal.style.display = "flex";

  $id("editName").value = userData.name || "";
  $id("editEmail").value = userData.email || "";
  $id("editRoll").value = userData.rollno || "";
  $id("editDegree").value = userData.degree || "";
  $id("editDept").value = userData.department || "";
  $id("editYear").value = userData.year || "";

  saveBtn.onclick = async () => {
    try {
      const newName = $id("editName").value.trim();
      const newEmail = $id("editEmail").value.trim();
      const newRoll = $id("editRoll").value.trim();
      const newDegree = $id("editDegree").value.trim();
      const newDept = $id("editDept").value.trim();
      const newYear = $id("editYear").value.trim();

      await updateDoc(doc(db, "users", uid), {
        name: newName,
        email: newEmail,
        rollno: newRoll,
        degree: newDegree,
        department: newDept,
        year: newYear
      });

      try {
        const batch = writeBatch(db);
        const regQ = query(collection(db, "registrations"), where("studentId", "==", uid));
        const regSnap = await getDocs(regQ);
        regSnap.forEach(rs => batch.update(rs.ref, { studentName: newName }));
        const chQ = query(collection(db, "credit_history"), where("studentId", "==", uid));
        const chSnap = await getDocs(chQ);
        chSnap.forEach(cs => batch.update(cs.ref, { studentName: newName }));

        if (!regSnap.empty || !chSnap.empty) await batch.commit();
      } catch (err) {
        console.warn("Could not propagate name change from admin UI:", err);
      }

      alert("Student updated in Database!");
      modal.style.display = "none";
      loadStudents();
    } catch (err) {
      alert("Error updating student: " + err.message);
    }
  };

  cancelBtn.onclick = () => {
    modal.style.display = "none";
  };
  if (closeEditBtn) {
    closeEditBtn.onclick = () => { modal.style.display = "none"; };
  }
}

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

//Logout
$id("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});