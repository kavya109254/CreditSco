import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const clubNameEl = document.getElementById("clubName");
const clubDescEl = document.getElementById("clubDescription");
const profileNameEl = document.getElementById("profileName");
const profileEmailEl = document.getElementById("profileEmail");
const profileClubEl = document.getElementById("profileClub");

const clubEventsList = document.getElementById("clubEventsList");
const studentList = document.getElementById("studentList");
const assignList = document.getElementById("assignCreditsList");

const addEventBtn = document.getElementById("addEventBtn");
const eventFormContainer = document.getElementById("eventFormContainer");
const eventForm = document.getElementById("eventForm");

const clubEditModal = document.getElementById("clubEditModal");
const clubDescInput = document.getElementById("clubDescInput");
const saveClubDesc = document.getElementById("saveClubDesc");
const cancelClubEdit = document.getElementById("cancelClubEdit");

const eventEditModal = document.getElementById("eventEditModal");
const eventEditForm = document.getElementById("eventEditForm");
const cancelEventEdit = document.getElementById("cancelEventEdit");

let currentClubId = null;
let currentClubName = null;
let currentEditEventId = null;


//Tab switching 
document.querySelectorAll(".nav-links a, .sidebar a").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-links a, .sidebar a").forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));

    link.classList.add("active");
    const targetId = link.dataset.tab;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add("active");

    document.querySelector(".sidebar")?.classList.remove("active");

    if (targetId === "students") loadManageRegistration();
    if (targetId === "assign-credits") loadAssignCredits();
    if (targetId === "club-history") loadClubCreditHistory();
    if (targetId === "credit-history") loadClubCreditHistory();
  });
});

//Authorization
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) return;

  const userData = userDoc.data();

  if (userData.role === "club_head" && userData.clubId) {
    currentClubId = userData.clubId;

    const clubDoc = await getDoc(doc(db, "clubs", currentClubId));
    if (clubDoc.exists()) {
      const club = clubDoc.data();
      currentClubName = club.clubName || "-";
      clubNameEl.textContent = currentClubName;
      clubDescEl.textContent = club.description || "—";
      profileNameEl.textContent = userData.name || "Club Head";
      profileEmailEl.textContent = userData.email || user.email;
      profileClubEl.textContent = currentClubName;
    }

    const clubHeadNameEl = document.getElementById("clubHeadName");
    if (clubHeadNameEl) {
      clubHeadNameEl.textContent = userData.name || "Club Head";
    }

    // Semester
    const semEl = document.getElementById("clubSemesterOverview");
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
        console.error("Semester error (club):", err);
        semEl.textContent = "Not set";
      }
    }

    // Load pages
    loadClubEvents(currentClubId);
    loadClubBrowseEvents();
  }
});


//Club Events
async function loadClubEvents(clubId) {
  clubEventsList.innerHTML = "<p>Loading events...</p>";
  const q = query(collection(db, "events"), where("clubId", "==", clubId));
  const snap = await getDocs(q);

  if (snap.empty) {
    clubEventsList.innerHTML = "<p>No events created yet.</p>";
    return;
  }

  let html = "";
  snap.forEach(docSnap => {
    const ev = docSnap.data();
    html += `
      <div class="card">
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        <p><strong>Credits:</strong> ${ev.credits}</p>
        <p><strong>Date:</strong> ${ev.eventDate}</p>
        <p><strong>Deadline:</strong> ${ev.registrationDeadline}</p>
        <p><strong>Status:</strong> ${ev.status || "Open"}</p>
        <button class="editEventBtn" data-id="${docSnap.id}">Edit Event</button>
        <button class="deleteEventBtn" data-id="${docSnap.id}">Delete Event</button>
      </div>
    `;
  });

  clubEventsList.innerHTML = html;

  document.querySelectorAll(".editEventBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      currentEditEventId = btn.dataset.id;

      const snap = await getDoc(doc(db, "events", currentEditEventId));
      if (!snap.exists()) {
        alert("Event not found");
        return;
      }
      const ev = snap.data();
      eventEditForm.querySelector("#editEventTitle").value = ev.title || "";
      eventEditForm.querySelector("#editEventDescription").value = ev.description || "";
      eventEditForm.querySelector("#editEventCredits").value = ev.credits || 0;
      eventEditForm.querySelector("#editEventDate").value = ev.eventDate || "";
      eventEditForm.querySelector("#editEventDeadline").value = ev.registrationDeadline || "";
      eventEditModal.style.display = "flex";
    });
  });

  // Delete event
  document.querySelectorAll(".deleteEventBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.id;
      if (confirm("Delete this event?")) {
        await deleteDoc(doc(db, "events", eventId));
        alert("Event deleted");
        loadClubEvents(clubId);
      }
    });
  });

  // Edit Club Description
  if (saveClubDesc && cancelClubEdit) {
    document.getElementById("editClubBtn")?.addEventListener("click", async () => {
      clubDescInput.value = clubDescEl.textContent || "";
      clubEditModal.style.display = "flex";
    });

    saveClubDesc.addEventListener("click", async () => {
      if (!currentClubId) return alert("Club not found");

      const newDesc = clubDescInput.value.trim();
      await updateDoc(doc(db, "clubs", currentClubId), { description: newDesc });

      clubDescEl.textContent = newDesc;
      clubEditModal.style.display = "none";
      alert("Club description updated!");
    });

    cancelClubEdit.addEventListener("click", () => {
      clubEditModal.style.display = "none";
    });
  }
}

if (eventEditForm) {
  eventEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditEventId) return;

    const updated = {
      title: eventEditForm.querySelector("#editEventTitle").value,
      description: eventEditForm.querySelector("#editEventDescription").value,
      credits: parseInt(eventEditForm.querySelector("#editEventCredits").value, 10) || 0,
      eventDate: eventEditForm.querySelector("#editEventDate").value,
      registrationDeadline: eventEditForm.querySelector("#editEventDeadline").value
    };

    await updateDoc(doc(db, "events", currentEditEventId), updated);

    alert("Event updated");
    eventEditModal.style.display = "none";
    loadClubEvents(currentClubId);
  });
}

if (cancelEventEdit) {
  cancelEventEdit.addEventListener("click", () => {
    eventEditModal.style.display = "none";
  });
}

//Create new event Event 
if (addEventBtn) {
  addEventBtn.addEventListener("click", () => {
    eventFormContainer.style.display = eventFormContainer.style.display === "none" ? "block" : "none";
  });
}

if (eventForm) {
  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentClubId) return alert("Club ID not found.");

    const title = document.getElementById("eventTitle").value;
    const description = document.getElementById("eventDescription").value;
    const credits = parseInt(document.getElementById("eventCredits").value, 10);
    const eventDate = document.getElementById("eventDate").value;
    const deadline = document.getElementById("eventDeadline").value;

    await addDoc(collection(db, "events"), {
      clubId: currentClubId,
      clubName: currentClubName || "",
      title,
      description,
      credits,
      eventDate,
      registrationDeadline: deadline,
      status: "Open",
      createdAt: serverTimestamp()
    });

    alert("Event created!");
    eventForm.reset();
    eventFormContainer.style.display = "none";
    loadClubEvents(currentClubId);
  });
}

//Browse Events (for all clubs)

async function loadClubBrowseEvents() {
  const section = document.getElementById("clubBrowseEventsList");
  if (!section) return;
  section.innerHTML = "<p>Loading events...</p>";

  try {
    const snap = await getDocs(collection(db, "events"));
    if (snap.empty) {
      section.innerHTML = "<p>No events found.</p>";
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
        const clubRef = doc(db, "clubs", ev.clubId);
        const clubSnap = await getDoc(clubRef);
        if (clubSnap.exists()) {
          const clubData = clubSnap.data();
          clubName = clubData.clubName || "Unknown Club";
          clubDesc = clubData.description || "No description available.";
        }
      }

      const evDate = ev.eventDate ? new Date(ev.eventDate) : null;
      const isPast = evDate && evDate < now;

      const card = `
        <div class="event-card ${isPast ? "past" : ""}">
          <h3>${ev.title || "Untitled Event"}</h3>
          <p class="event-desc">${(ev.description || "").replace(/\n/g, "<br>")}</p>
          <p><strong>Date:</strong> ${ev.eventDate || "TBA"}</p>
          <p><strong>Deadline:</strong> ${ev.registrationDeadline || "TBA"}</p>
          <p><strong>Credits:</strong> ${ev.credits || 0}</p>

          ${isPast ? `<span class="badge past">Past Event</span>` : ""}

          <p class="club-link" data-name="${clubName}" data-desc="${clubDesc}">
            <strong>Posted by:</strong> <span class="club-popup">${clubName}</span>
          </p>
        </div>
      `;

      if (isPast) pastHTML += card;
      else upcomingHTML += card;
    }

        section.innerHTML = upcomingHTML + '<div class="events-sections">' + pastHTML + '</div>';

        section.querySelectorAll(".club-popup").forEach(link => {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            const parent = link.closest(".club-link");
            const name = parent?.getAttribute("data-name") || "Unknown Club";
            const desc = parent?.getAttribute("data-desc") || "No description available.";
            showClubPopup(name, desc);
          });
        });


  } catch (err) {
    console.error("Error loading events:", err);
    section.innerHTML = `
      <h2>Upcoming Events</h2>
      ${upcomingHTML}
      <h2>Past Events</h2>
      ${pastHTML}
    `;
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

// Manage Registrations
async function loadManageRegistration() {
  studentList.innerHTML = "<p>Loading registered students...</p>";

  try {
    const evSnap = await getDocs(query(collection(db, "events"), where("clubId", "==", currentClubId)));
    const eventIds = evSnap.docs.map(d => d.id);

    if (eventIds.length === 0) {
      studentList.innerHTML = "<p>No events for this club yet.</p>";
      return;
    }

    const chunks = [];
    for (let i = 0; i < eventIds.length; i += 10) chunks.push(eventIds.slice(i, i + 10));

    studentList.innerHTML = "";

    for (const chunk of chunks) {
      const regsSnap = await getDocs(query(
        collection(db, "registrations"),
        where("eventId", "in", chunk)
      ));

      const byEvent = new Map();
      regsSnap.forEach(ds => {
        const reg = { id: ds.id, ...ds.data() };
        if (!byEvent.has(reg.eventId)) byEvent.set(reg.eventId, []);
        byEvent.get(reg.eventId).push(reg);
      });

      for (const [evId, regs] of byEvent.entries()) {
        let title = evId;
        try {
          const evSnap = await getDoc(doc(db, "events", evId));
          if (evSnap.exists()) title = evSnap.data().title || evId;
        } catch {}

        const wrapper = document.createElement("div");
        wrapper.className = "card compact-table";

        const rows = regs.map(r => {
          let displayStatus = r.status || "-";

          if (displayStatus === "Pending") displayStatus = "Awaiting Club Approval";
          else if (displayStatus === "Approved") displayStatus = "Approved by Club";
          else if (displayStatus === "Rejected") displayStatus = "Rejected by Club";
          else if (displayStatus === "Waiting for Faculty Approval") displayStatus = "Sent to Faculty (Pending Approval)";
          else if (displayStatus === "Approved by Faculty") displayStatus = "Approved by Faculty";
          else if (displayStatus === "Rejected by Faculty") displayStatus = "Rejected by Faculty";

          return `
            <tr>
              <td>${r.studentName}</td>
              <td>${r.rollno || "-"}</td>
              <td>${r.email || "-"}</td>
              <td>${r.phone || "-"}</td>
              <td>${r.department || "-"}</td>
              <td>${displayStatus}</td>
              <td class="action-cell">
                <button class="approve-btn" data-id="${r.id}">Approve</button>
                <button class="reject-btn" data-id="${r.id}">Reject</button>
              </td>
            </tr>
          `;
        }).join("");

        wrapper.innerHTML = `
          <h3>${title}</h3>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Dept</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">No registrations.</td></tr>`}</tbody>
          </table>
        `;
        studentList.appendChild(wrapper);
      }
    }

    // Approve registration
    document.querySelectorAll(".approve-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const regId = btn.dataset.id;
        try {
          await updateDoc(doc(db, "registrations", regId), {
          status: "Approved", 
          approvedBy: currentClubName || "Club Head",
          updatedAt: serverTimestamp()
        });
          alert("Student approved for participation!");
          await loadManageRegistration();
        } catch (err) {
          console.error("Approve error:", err);
          alert("Could not approve. See console.");
        }
      });
    });

    // Reject registration
    document.querySelectorAll(".reject-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const regId = btn.dataset.id;
        const reason = prompt("Reason for rejection?");
        try {
          await updateDoc(doc(db, "registrations", regId), {
            status: "Rejected",
            rejectionReason: reason || "Not specified"
          });
          alert("Student rejected.");
          await loadManageRegistration();
        } catch (err) {
          console.error("Reject error:", err);
          alert("Could not reject. See console.");
        }
      });
    });

  } catch (err) {
    console.error("Error loading registered students:", err);
    studentList.innerHTML = "<p>Failed to load students.</p>";
  }
}

// Assign Credits (Club Head)

async function loadAssignCredits() {
  assignList.innerHTML = "<p>Loading students...</p>";

  try {
    const evSnap = await getDocs(query(collection(db, "events"), where("clubId", "==", currentClubId)));
    if (evSnap.empty) {
      assignList.innerHTML = "<p>No events for this club yet.</p>";
      return;
    }

    assignList.innerHTML = "";

    for (const evDoc of evSnap.docs) {
      const ev = evDoc.data();
      const evId = evDoc.id;

      const wrapper = document.createElement("div");
      wrapper.className = "card";
      wrapper.innerHTML = `
        <h3>${ev.title || "Untitled Event"}</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll No</th>
              <th>Role</th>
              <th>Credits</th>
              <th>Reason (if 0)</th>
            </tr>
          </thead>
          <tbody id="assign-${evId}"></tbody>
        </table>
        <button class="sendAllBtn" data-event="${evId}" style="margin-top:10px;">Send All to Faculty</button>
      `;
      assignList.appendChild(wrapper);

      const regs = await getDocs(query(
        collection(db, "registrations"),
        where("eventId", "==", evId),
        where("status", "in", ["Approved", "approved", "Registered", "registered"])
      ));

      const tbody = wrapper.querySelector(`#assign-${evId}`);
      if (regs.empty) {
        tbody.innerHTML = `<tr><td colspan="5">No registered students.</td></tr>`;
        continue;
      }

      regs.forEach(docSnap => {
        const reg = { id: docSnap.id, ...docSnap.data() };
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${reg.studentName}</td>
          <td>${reg.rollno}</td>
          <td>
            <select id="role-${docSnap.id}">
              <option>Participant</option>
              <option>Volunteer</option>
              <option>Organizer</option>
              <option>Member</option>
            </select>
          </td>
          <td><input type="number" id="credits-${docSnap.id}" value="0" min="0" style="width:60px"></td>
          <td><input type="text" id="reason-${docSnap.id}" placeholder="Reason if no credit"></td>
        `;
        tbody.appendChild(tr);
      });

      wrapper.querySelector(".sendAllBtn").addEventListener("click", async () => {
        const regs = await getDocs(query(
          collection(db, "registrations"),
          where("eventId", "==", evId),
          where("status", "in", [
            "Approved", "approved",
            "Approved by Club",
            "Registered", "registered"
          ])
        ));

if (regs.empty) {
  console.log("No matching students found for event:", evId);
  alert("No students to send — ensure you approved them first!");
  return;
}


        for (const docSnap of regs.docs) {
          const reg = { id: docSnap.id, ...docSnap.data() };

          const role = document.getElementById(`role-${docSnap.id}`).value;
          const credits = Number(document.getElementById(`credits-${docSnap.id}`).value);
          const reason = document.getElementById(`reason-${docSnap.id}`).value;

          if (credits === 0 && !reason.trim()) {
            alert(`Reason required for ${reg.studentName} if credits = 0`);
            return;
          }

          // 🔹 Add to event_requests (for Faculty review)
          await addDoc(collection(db, "event_requests"), {
            eventId: reg.eventId,
            eventTitle: reg.eventTitle || "",
            clubId: currentClubId,
            clubName: currentClubName || "-",
            studentId: reg.studentId,
            studentName: reg.studentName,
            rollno: reg.rollno,
            year: reg.year,
            department: reg.department,
            email: reg.email,
            phone: reg.phone,
            role,
            creditsAssigned: credits,
            reason,
            status: "Pending Faculty Approval",
            requestType: "Club Event",
            submittedBy: currentClubId,
            submittedAt: serverTimestamp()
          });

          // 🔹 Optional: save internal club log
          await addDoc(collection(db, "credit_history_club"), {
            clubId: currentClubId,
            clubName: currentClubName,
            studentId: reg.studentId,
            studentName: reg.studentName,
            rollno: reg.rollno,
            eventId: reg.eventId,
            eventTitle: reg.eventTitle || "",
            role,
            creditsAssigned: credits,
            reason: reason || "",
            assignedAt: serverTimestamp(),
          });

          // 🔹 Update registration record
          await updateDoc(doc(db, "registrations", reg.id), {
            status: "Waiting for Faculty Approval",
            creditsAssigned: credits,
            verifiedByFaculty: false,
            reason: "Awaiting final approval from Faculty",
            updatedAt: serverTimestamp()
          });
        }

        alert("All approved students for this event sent to Faculty!");
        loadAssignCredits(); // refresh
      });
    }

  } catch (err) {
    console.error("Error loading assign credits:", err);
    assignList.innerHTML = "<p>Failed to load students.</p>";
  }
}

// Club Credit History 

async function loadClubCreditHistory() {
  const historySection = document.getElementById("clubCreditHistory");
  if (!historySection || !currentClubId) return;

  historySection.innerHTML = "<p>Loading credit history...</p>";

  try {

    const q = query(
      collection(db, "credit_history_club"),
      where("clubId", "==", currentClubId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      historySection.innerHTML = "<p>No credit history yet.</p>";
      return;
    }

    const grouped = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const eventTitle = d.eventTitle || "Untitled Event";
      if (!grouped[eventTitle]) grouped[eventTitle] = [];
      grouped[eventTitle].push(d);
    });

    let html = "";
    Object.entries(grouped).forEach(([eventTitle, records]) => {
      let totalCredits = 0;
      let rows = "";

      records.forEach((r) => {
        totalCredits += Number(r.creditsAssigned || 0);
        const assignedAt = r.assignedAt?.toDate
          ? r.assignedAt.toDate().toLocaleString()
          : "-";
        rows += `
          <tr>
            <td>${r.studentName || "-"}</td>
            <td>${r.rollno || "-"}</td>
            <td>${r.role || "-"}</td>
            <td>${r.creditsAssigned || 0}</td>
            <td>${r.reason || "-"}</td>
            <td>${assignedAt}</td>
          </tr>
        `;
      });

      html += `
        <div class="card event-history-card">
          <h3>${eventTitle}</h3>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Role</th>
                <th>Credits</th>
                <th>Reason</th>
                <th>Assigned At</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p><strong>Total Credits for ${eventTitle}:</strong> ${totalCredits}</p>
          <button class="download-btn" data-event="${eventTitle}">Download CSV Report</button>
        </div>
      `;
    });

    historySection.innerHTML = html;

    document.querySelectorAll(".download-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const eventTitle = btn.dataset.event;
        const eventRecords = grouped[eventTitle];

        let csv = "Student,Roll No,Role,Credits,Reason,Assigned At\n";
        eventRecords.forEach((r) => {
          const assignedAt = r.assignedAt?.toDate
            ? r.assignedAt.toDate().toLocaleString()
            : "-";
          csv += `"${r.studentName || "-"}","${r.rollno || "-"}","${r.role || "-"}","${r.creditsAssigned || 0}","${r.reason || "-"}","${assignedAt}"\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${eventTitle.replace(/\s+/g, "_")}_credit_report.csv`;
        link.click();
      });
    });

  } catch (error) {
    console.error("Error loading club credit history:", error);
    historySection.innerHTML = "<p>Error loading history.</p>";
  }
}

//Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});