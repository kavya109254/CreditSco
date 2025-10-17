import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const logoutBtn = document.getElementById("logoutBtn");
const facultyNameEl = document.getElementById("facultyName");
const profileNameEl = document.getElementById("profileName");
const profileEmailEl = document.getElementById("profileEmail");
const profileDeptEl = document.getElementById("profileDept");

const requestsBody = document.getElementById("requestsBody");
const loadingRequests = document.getElementById("loadingRequests");

const studentsBody = document.getElementById("studentsBody");
const studentSearchInput = document.getElementById("studentSearch");

const historyBody = document.getElementById("historyBody");
const loadingHistory = document.getElementById("loadingHistory");
const historySearchInput = document.getElementById("historySearch");

const eventsList = document.getElementById("eventsList");

let currentFaculty = null;

function safeText(v) {
  return v == null ? "" : String(v);
}

// Tabs Switching
(function initTabs() {
  const tabs = document.querySelectorAll(".nav-links a, .sidebar a");
  const sections = document.querySelectorAll("main section");

  if (!tabs || !sections) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.getAttribute("data-tab");
      const el = document.getElementById(target);
      if (el) el.classList.add("active");
      // close sidebar on mobile
      document.querySelector(".sidebar")?.classList.remove("active");
    });
  });
})();

// Authorization 
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== "faculty") {
      alert("Access denied.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    currentFaculty = { uid: user.uid, ...userDoc.data() };

    if (facultyNameEl) facultyNameEl.textContent = currentFaculty.name || user.email;
    if (profileNameEl) profileNameEl.textContent = currentFaculty.name || "—";
    if (profileEmailEl) profileEmailEl.textContent = currentFaculty.email || user.email;
    if (profileDeptEl) profileDeptEl.textContent = currentFaculty.department || "—";

    const facultyNameOverviewEl = document.getElementById("facultyNameOverview");
    if (facultyNameOverviewEl) {
      facultyNameOverviewEl.textContent = currentFaculty.name || "Faculty";
    }

    // Semester display for faculty overview
    const semEl = document.getElementById("facultySemesterOverview");
    if (semEl) {
      try {
        const semRef = doc(db, "admin", "settings");
        const semSnap = await getDoc(semRef);
        if (semSnap.exists() && semSnap.data()?.currentSemester) {
          semEl.textContent = semSnap.data().currentSemester;
        } else {
          semEl.textContent = "Not set";
        }
      } catch (err) {
        console.error("Semester error (faculty):", err);
        semEl.textContent = "Not set";
      }
    }

    await loadEvents();
    await loadRequests();
    await loadExternalSubmissions();
    await loadAcademicStudents();
    await loadHistory();
  } catch (err) {
    console.error("Auth handler error:", err);
  }
});

// Load Events (with past events separation) 
async function loadEvents() {
  const eventsSection = document.getElementById("eventsList");
  if (!eventsSection) return;

  eventsSection.innerHTML = "<p>Loading events...</p>";

  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    if (querySnapshot.empty) {
      eventsSection.innerHTML = "<p>No events available right now.</p>";
      return;
    }

    let upcomingHTML = "<h2>Upcoming Events</h2>";
    let pastHTML = "<h2>Past Events</h2>";

    const now = new Date();

    for (const docSnap of querySnapshot.docs) {
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
        } catch (e) {
          console.warn("Club fetch failed:", e);
        }
      }

      // Check if event is past
      const evDate = ev.eventDate ? new Date(ev.eventDate) : null;
      const isPast = evDate && evDate < now;

      const card = `
        <div class="event-card ${isPast ? "past" : ""}">
          <h3>${ev.title || "Untitled Event"}</h3>
          <p class="event-desc">${(ev.description || "").replace(/\n/g, "<br>")}</p>
          <p><strong>Date:</strong> ${ev.eventDate || "TBA"}</p>
          <p><strong>Deadline:</strong> ${ev.registrationDeadline || "TBA"}</p>
          <p><strong>Credits:</strong> ${ev.credits || 0}</p>

          ${isPast 
            ? `<span class="badge past">Past Event</span>` 
            : ""}

          <p class="club-link" data-name="${clubName}" data-desc="${clubDesc}">
            <strong>Posted by:</strong> <span class="club-popup">${clubName}</span>
          </p>

        </div>
      `;

      if (isPast) {
        pastHTML += card;
      } else {
        upcomingHTML += card;
      }
    }

    eventsSection.innerHTML = upcomingHTML + '<div class="events-sections">' + pastHTML + '</div>';

    // Popup listeners
    document.querySelectorAll(".club-popup").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const parent = link.closest(".club-link");
        const name = parent.getAttribute("data-name");
        const desc = parent.getAttribute("data-desc");
        showClubPopup(name, desc);
      });
    });

  } catch (error) {
    console.error("Error loading events:", error);
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

async function loadRequests() {
  if (!requestsBody || !loadingRequests) return;
  requestsBody.innerHTML = "";
  loadingRequests.textContent = "Loading requests...";

  try {
    const q = query(
      collection(db, "event_requests"),
      where("status", "in", ["pending", "Pending Faculty Approval"]),
      where("department", "==", currentFaculty.department)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      loadingRequests.textContent = "No pending requests.";
      return;
    }

    requestsBody.innerHTML = "";

    for (const docSnap of snap.docs) {
      const req = { id: docSnap.id, ...(docSnap.data() || {}) };

      // Fetch student info
      let studentName = req.studentName || req.studentId;
      let studentRoll = "-";
      let studentEmail = "";
      try {
        if (req.studentId) {
          const stuSnap = await getDoc(doc(db, "users", req.studentId));
          if (stuSnap.exists()) {
            const stu = stuSnap.data();
            studentName = stu.name || req.studentId;
            studentRoll = stu.rollno || "-";
            studentEmail = stu.email || "";
          }
        }
      } catch (e) {
        console.error("Could not fetch student info", e);
      }

      const totalCreditsDisplay = safeText(req.totalCredits ?? req.creditsAssigned ?? "-");
      const assignedDisplay = safeText(req.creditsAssigned ?? "-");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${studentName} (${studentRoll})<br>${studentEmail}</td>
        <td>${safeText(req.eventTitle)}</td>
        <td>${totalCreditsDisplay}</td>
        <td>${assignedDisplay}</td>
        <td>${safeText(req.reason) || "-"}</td>
        <td>${safeText(req.requestType)}</td>
        <td>${safeText(req.clubName) || "-"}</td>
        <td>${safeText(req.status)}</td>
        <td class="action-cell">
          <div class="action-buttons">
            <button data-id="${req.id}" class="approve-btn">Approve</button>
            <button data-id="${req.id}" class="reject-btn">Reject</button>
          </div>
        </td>
      `;
      requestsBody.appendChild(tr);
    }

    requestsBody.querySelectorAll(".approve-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        console.log("Approve clicked for", id);
        await approveRequest(id);
      });
    });
    requestsBody.querySelectorAll(".reject-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        console.log("Reject clicked for", id);
        await rejectRequest(id);
      });
    });

    loadingRequests.textContent = "";
  } catch (err) {
    console.error("Error loading requests:", err);
    loadingRequests.textContent = "Could not load requests.";
  }
}

// Approve Event Request
window.approveRequest = async function (id) {
  try {
    console.log("approveRequest start", id);

    const ref = doc(db, "event_requests", id);
    const reqSnap = await getDoc(ref);

    if (!reqSnap.exists()) {
      alert("Request not found.");
      return;
    }
    const req = reqSnap.data() || {};

    // Ensure faculty info is loaded
    if (!currentFaculty) {
      console.warn("currentFaculty missing, fetching user doc");
      const u = auth.currentUser;
      if (!u) throw new Error("Not authenticated");
      const uDoc = await getDoc(doc(db, "users", u.uid));
      currentFaculty = { uid: u.uid, ...(uDoc.exists() ? uDoc.data() : {}) };
    }

    const processedByName = currentFaculty.name || "";
    const creditsToAdd = Number(req.creditsAssigned ?? req.totalCredits ?? 0);

    // ✅ Step 1: Mark the request as approved
    await updateDoc(ref, {
      status: "Approved",
      processedBy: currentFaculty.uid,
      processedByName,
      processedAt: serverTimestamp()
    });

    // ✅ Step 2: Update student credits
    if (req.studentId) {
      const studentRef = doc(db, "users", req.studentId);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        const s = studentSnap.data() || {};

        // Choose which credit field to update
        let field = "externalCredits"; // default
        if (req.requestType && req.requestType.toLowerCase() === "academic")
          field = "academicCredits";
        else if (req.requestType && req.requestType.toLowerCase().includes("club"))
          field = "activityCredits";

        // Calculate updated values
        const newFieldVal = Number(s[field] || 0) + creditsToAdd;
        const newAcademic =
          field === "academicCredits" ? newFieldVal : Number(s.academicCredits || 0);
        const newActivity =
          field === "activityCredits" ? newFieldVal : Number(s.activityCredits || 0);
        const newExternal =
          field === "externalCredits" ? newFieldVal : Number(s.externalCredits || 0);

        const newTotal = newAcademic + newActivity + newExternal;

        // ✅ Update student record in Firestore
        await updateDoc(studentRef, {
          [field]: newFieldVal,
          totalCredits: newTotal
        });

        // ✅ Step 3: Update registration (if it exists)
        try {
          const regRef = doc(db, "registrations", `${req.eventId}_${req.studentId}`);
          const rSnap = await getDoc(regRef);
          if (rSnap.exists()) {
            await updateDoc(regRef, {
              status: "Approved by Faculty",
              verifiedByFaculty: true,
              creditsAssigned: creditsToAdd,
              updatedAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.warn("Could not update registration (might be rules):", e);
        }

        try {
          await addDoc(collection(db, "credit_history"), {
            studentId: req.studentId,
            studentName: s.name || "",
            rollno: s.rollno || "",
            degree: s.degree || "",
            department: s.department || "",
            year: s.year || "",
            eventTitle:
              req.requestType?.toLowerCase() === "academic"
                ? null
                : req.eventTitle || null,
            clubName:
              req.requestType?.toLowerCase() === "academic"
                ? null
                : req.clubName || null,
            type:
              field === "academicCredits"
                ? "Academic"
                : field === "externalCredits"
                ? "External"
                : "Activity",
            creditsAssigned: creditsToAdd,
            totalCredits: newTotal,
            status: "Approved",
            processedBy: currentFaculty.uid,
            processedByName,
            facultyDept: currentFaculty.department,
            processedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Could not write credit_history:", e);
        }
      } else {
        console.warn("Student document missing for", req.studentId);
      }
    }

    alert("✅ Request approved successfully and student credits updated!");
    await loadRequests();
    await loadHistory();
  } catch (err) {
    console.error("approveRequest error:", err);
    alert("❌ Could not approve request. See console for details.");
  }
};


//Reject 
window.rejectRequest = async function (id) {
  try {
    const reason = prompt("Enter rejection reason:", "") || "No reason given";
    const ref = doc(db, "event_requests", id);

    if (!currentFaculty) {
      const u = auth.currentUser;
      const uDoc = await getDoc(doc(db, "users", u.uid));
      currentFaculty = { uid: u.uid, ...(uDoc.exists() ? uDoc.data() : {}) };
    }

    await updateDoc(ref, {
      status: "Rejected",
      processedBy: currentFaculty.uid,
      processedByName: currentFaculty.name || "",
      processedAt: serverTimestamp(),
      rejectionReason: reason
    });
    alert("Request rejected.");
    await loadRequests();
  } catch (err) {
    console.error("rejectRequest error:", err);
    alert("Could not reject request. See console for details.");
  }
};

// Load External Activity Submissions

async function loadExternalSubmissions() {
  const listDiv = document.getElementById("externalActivitiesList");
  if (!listDiv) return;

  listDiv.innerHTML = "<p>Loading external submissions...</p>";

  try {
    const q = query(
      collection(db, "externalSubmissions"),
      where("department", "==", currentFaculty.department),
      where("status", "==", "Pending")
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      listDiv.innerHTML = "<p>No pending submissions for your department.</p>";
      return;
    }

    listDiv.innerHTML = ""; // clear before filling

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const id = docSnap.id;

      // Proof Display Logic (handles Base64 or URL proofs)
      let proofSection = "";
      if (d.proofType === "online" && d.proofURL) {
        // Proof link entered by student
        proofSection = `<a href="${d.proofURL}" target="_blank">View Online Proof</a>`;
      } 
      if (d.proofType === "upload" && d.proofFile) {
        if (d.proofFile.startsWith("data:application/pdf")) {
          const blob = dataURLtoBlob(d.proofFile);
          const blobUrl = URL.createObjectURL(blob);
          proofSection = `<a href="${blobUrl}" target="_blank">📄 View Uploaded PDF</a>`;
        } else if (d.proofFile.startsWith("data:image")) {
          proofSection = `<img src="${d.proofFile}" alt="Proof Image" style="max-width:200px;display:block;margin-top:5px;border-radius:8px;">`;
        } else {
          proofSection = `<a href="${d.proofFile}" target="_blank">View Uploaded File</a>`;
        }
      }
      else {
        proofSection = `<span style="color:#aaa;">No proof provided</span>`;
      }

      const eventDate = d.date?.toDate ? d.date.toDate().toLocaleDateString() : "-";
      const submittedAt = d.submittedAt?.toDate ? d.submittedAt.toDate().toLocaleString() : "-";

      listDiv.innerHTML += `
        <div class="card submission-card">
          <h3>${d.eventName}</h3>
          <p><b>Student:</b> ${d.studentName} (${d.roleno || "-"})</p>
          <p><b>Email:</b> ${d.email || "-"}</p>
          <p><b>Department:</b> ${d.department}</p>
          <p><b>Year:</b> ${d.year || "-"}</p>
          <p><b>Degree:</b> ${d.degree || "-"}</p>
          <p><b>Category:</b> ${d.category}</p>
          <p><b>Organizer:</b> ${d.organizer}</p>
          <p><b>Event Date:</b> ${eventDate}</p>
          <p><b>Submitted At:</b> ${submittedAt}</p>
          <p><b>Description:</b> ${d.description}</p>
          <p><b>Proof:</b> ${proofSection}</p>
          <div class="controls">
            <button class="approve-btn" data-id="${id}">Approve</button>
            <button class="reject-btn danger" data-id="${id}">Reject</button>
          </div>
        </div>
      `;
    });

    // Attach buttons
    document.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => approveExternalSubmission(btn.dataset.id));
    });
    document.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => rejectExternalSubmission(btn.dataset.id));
    });

  } catch (err) {
    console.error("Error loading external submissions:", err);
    listDiv.innerHTML = "<p>Error loading submissions.</p>";
  }
}

async function approveExternalSubmission(id) {
  if (!confirm("Approve this submission and award credits?")) return;

  try {
    const docRef = doc(db, "externalSubmissions", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return alert("Submission not found.");
    const data = snap.data();

    const creditsToAdd = 2; // default

    // Update submission in externalSubmissions
    await updateDoc(docRef, {
      status: "Approved",
      credits: creditsToAdd,
      reviewedBy: currentFaculty.name || "",
      remarks: "Approved by faculty",
    });

    // Update student’s credits
    const studentRef = doc(db, "users", data.studentId);
    const stuSnap = await getDoc(studentRef);
    const stu = stuSnap.exists() ? stuSnap.data() : {};

    const newExternal = (stu.externalCredits || 0) + creditsToAdd;
    const total = (stu.academicCredits || 0) + newExternal;

    await updateDoc(studentRef, {
      externalCredits: newExternal,
      totalCredits: total,
    });

    // Add record to credit_history
    await addDoc(collection(db, "credit_history"), {
      studentId: data.studentId,
      studentName: data.studentName,
      rollno: data.roleno,
      degree: data.degree,
      department: data.department,
      year: data.year,
      eventTitle: data.eventName,
      organizer: data.organizer,
      type: "External",
      creditsAssigned: creditsToAdd,
      totalCredits: total,
      status: "Approved",
      remarks: "Approved by faculty",
      processedBy: currentFaculty.uid,
      processedByName: currentFaculty.name || "",
      facultyDept: currentFaculty.department,
      processedAt: serverTimestamp(),
    });

    alert("Approved and credits awarded!");
    loadExternalSubmissions();
  } catch (error) {
    console.error("Error approving submission:", error);
    alert("Error approving submission.");
  }
}


async function rejectExternalSubmission(id) {
  const reason = prompt("Enter rejection reason:", "Incomplete proof");
  if (!reason) return;

  try {
    const docRef = doc(db, "externalSubmissions", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return alert("Submission not found.");
    const data = snap.data();

    await updateDoc(docRef, {
      status: "Rejected",
      remarks: reason,
      reviewedBy: currentFaculty.name || "",
    });

    const studentRef = doc(db, "users", data.studentId);
    const stuSnap = await getDoc(studentRef);
    const stu = stuSnap.exists() ? stuSnap.data() : {};

    await addDoc(collection(db, "credit_history"), {
      studentId: data.studentId,
      studentName: data.studentName,
      rollno: data.roleno,
      degree: data.degree,
      department: data.department,
      year: data.year,
      eventTitle: data.eventName,
      organizer: data.organizer,
      type: "External",
      creditsAssigned: 0,
      totalCredits: stu.totalCredits || 0,
      status: "Rejected",
      remarks: reason,
      processedBy: currentFaculty.uid,
      processedByName: currentFaculty.name || "",
      facultyDept: currentFaculty.department,
      processedAt: serverTimestamp(),
    });

    alert("Submission rejected.");
    loadExternalSubmissions();
  } catch (error) {
    console.error("Error rejecting submission:", error);
    alert("❌ Could not reject submission.");
  }
}


//Load students for this faculty (department match)
let currentYearFilter = "1st Year"; // default

async function loadAcademicStudents(searchText = "", yearFilter = currentYearFilter) {
  if (!studentsBody) return;
  studentsBody.innerHTML = "";

  try {
    if (!currentFaculty || !currentFaculty.department) {
      studentsBody.innerHTML = '<tr><td colspan="10">Your department is not set.</td></tr>';
      return;
    }

    const q = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("department", "==", currentFaculty.department),
      where("year", "==", yearFilter)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      studentsBody.innerHTML = `<tr><td colspan="10">No students found for ${yearFilter}.</td></tr>`;
      return;
    }

    const lower = safeText(searchText).toLowerCase();

    studentsBody.innerHTML = "";
    snap.forEach(docSnap => {
      const s = docSnap.data() || {};
      const nameLower = safeText(s.name).toLowerCase();
      const emailLower = safeText(s.email).toLowerCase();
      const rollLower = safeText(s.rollno).toLowerCase();

      if (lower) {
        if (!nameLower.includes(lower) &&
            !emailLower.includes(lower) &&
            !rollLower.includes(lower)) {
          return;
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${safeText(s.name)}</td>
        <td>${safeText(s.rollno) || "-"}</td>
        <td>${safeText(s.year) || "-"}</td>
        <td>${safeText(s.degree) || "-"}</td>
        <td>${safeText(s.department) || "-"}</td>
        <td>${safeText(s.email) || "-"}</td>
        <td>${safeText(s.externalCredits) || 0}</td>
        <td>${safeText(s.academicCredits) || 0}</td>
        <td>${safeText(s.totalCredits) || 0}</td>
        <td>
          <input type="number" id="credits-${docSnap.id}" placeholder="Credits" style="width:80px" />
          <button data-id="${docSnap.id}" data-name="${safeText(s.name)}" class="assign-btn">Assign</button>
        </td>
      `;
      studentsBody.appendChild(tr);
    });

    studentsBody.querySelectorAll(".assign-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        await saveAcademicCredits(id, name);
      });
    });

  } catch (err) {
    console.error("Error loading students:", err);
    studentsBody.innerHTML = '<tr><td colspan="10">Could not load students.</td></tr>';
  }
}

// Search box 
if (studentSearchInput) {
  studentSearchInput.addEventListener("input", (e) => {
    loadAcademicStudents(e.target.value || "", currentYearFilter);
  });
}

// Year filter 
document.querySelectorAll(".year-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".year-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentYearFilter = btn.dataset.year;
    loadAcademicStudents(studentSearchInput.value || "", currentYearFilter);
  });
});

// Faculty Credit History 

function toLowerSafe(v) {
  return (v || "").toString().toLowerCase();
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function loadHistory(searchText = "") {
  if (!historyBody || !loadingHistory) return;
  historyBody.innerHTML = "";
  loadingHistory.textContent = "Loading history...";

  try {
    if (!currentFaculty || !currentFaculty.department) {
      loadingHistory.textContent = "No faculty department set.";
      return;
    }

    const q = query(
      collection(db, "credit_history"),
      where("facultyDept", "==", currentFaculty.department)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      loadingHistory.textContent = "No history found.";
      return;
    }

    const grouped = {};
    snap.forEach(docSnap => {
      const d = docSnap.data() || {};
      const sid = d.studentId || `unknown_${d.studentName || "x"}`;

      if (!grouped[sid]) {
        grouped[sid] = {
          studentId: sid,
          studentName: d.studentName || "-",
          rollno: d.rollno || "-",
          year: d.year || "-",
          degree: d.degree || "-",
          department: d.department || "-",
          academic: 0,
          club: 0,
          external: 0,
          total: 0,
          lastProcessedAt: d.processedAt || null,
          lastStatus: d.status || ""
        };
      }

      const credits = Number(d.creditsAssigned || 0);
      const type = (d.type || "").toLowerCase();

      if (type.includes("academic")) grouped[sid].academic += credits;
      else if (type.includes("external")) grouped[sid].external += credits;
      else grouped[sid].club += credits;

      grouped[sid].total += credits;

      if (d.processedAt && (!grouped[sid].lastProcessedAt || d.processedAt.toMillis() > grouped[sid].lastProcessedAt.toMillis())) {
        grouped[sid].lastProcessedAt = d.processedAt;
        grouped[sid].lastStatus = d.status || grouped[sid].lastStatus;
      }
    });

    // apply year filter and search
    const yearFilter = document.getElementById("yearFilter")?.value || "All";
    const lower = toLowerSafe(searchText).trim();

    const rows = Object.values(grouped).filter(s => {
      if (yearFilter !== "All" && s.year !== yearFilter) return false;
      if (!lower) return true;
      return toLowerSafe(s.studentName).includes(lower) ||
             toLowerSafe(s.rollno).includes(lower) ||
             toLowerSafe(s.department).includes(lower);
    });

    if (rows.length === 0) {
      historyBody.innerHTML = `<tr><td colspan="13">No matching records found.</td></tr>`;
      loadingHistory.textContent = "";
      return;
    }

    historyBody.innerHTML = "";
    rows.forEach(r => {
      const when = r.lastProcessedAt && r.lastProcessedAt.toDate ? r.lastProcessedAt.toDate().toLocaleString() : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.studentName}</td>
        <td>${r.rollno}</td>
        <td>${r.year}</td>
        <td>${r.degree}</td>
        <td>${r.department}</td>
        <td>${r.academic}</td>
        <td>${r.club}</td>
        <td>${r.external}</td>
        <td><strong>${r.total}</strong></td>
        <td>${r.lastStatus || "-"}</td>
        <td>${when}</td>
      `;
      historyBody.appendChild(tr);
    });

    loadingHistory.textContent = "";

    const exportBtn = document.getElementById("exportYearReport");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const yf = yearFilter.replace(/\s+/g, "_");
        let csv = "Student,Roll No,Year,Degree,Department,Academic,Club,External,Total,Status,LastProcessedAt\n";
        rows.forEach(r => {
          const when = r.lastProcessedAt && r.lastProcessedAt.toDate ? r.lastProcessedAt.toDate().toLocaleString() : "-";
          csv += `"${r.studentName}","${r.rollno}","${r.year}","${r.degree}","${r.department}",${r.academic},${r.club},${r.external},${r.total},"${r.lastStatus || "-"}","${when}"\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `credit_history_${yf || "All"}.csv`;
        a.click();
      };
    }

  } catch (err) {
    console.error("loadHistory error:", err);
    historyBody.innerHTML = `<tr><td colspan="13">Error loading history.</td></tr>`;
    loadingHistory.textContent = "Could not load history.";
  }
}

// Attach single debounced listener for history search
if (historySearchInput) {
  const debouncedSearch = debounce(() => {
    loadHistory(historySearchInput.value || "");
  }, 200);
  historySearchInput.removeEventListener?.("input", debouncedSearch); // harmless if not attached
  historySearchInput.addEventListener("input", debouncedSearch);
}

// Year filter change should reload using current search text
document.getElementById("yearFilter")?.addEventListener("change", () => {
  loadHistory(historySearchInput ? historySearchInput.value : "");
});

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

// Utility: Convert Base64 data URL to Blob for PDF/image preview
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
