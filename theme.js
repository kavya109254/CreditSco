// Sidebar toggle 
const menuBtn = document.querySelector(".menu-toggle");
const sidebar = document.querySelector(".sidebar");
const closeBtn = document.querySelector(".close-btn");

if (menuBtn && sidebar) {
  menuBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    sidebar.setAttribute("aria-hidden", "false");
  });
  closeBtn?.addEventListener("click", () => {
    sidebar.classList.remove("active");
    sidebar.setAttribute("aria-hidden", "true");
  });
  document.querySelectorAll(".sidebar a").forEach(link => {
    link.addEventListener("click", () => {
      sidebar.classList.remove("active");
      sidebar.setAttribute("aria-hidden", "true");
    });
  });
}

// Theme toggle 
const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('creditsco_theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch (e) {}

  themeToggle.textContent = root.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';

  themeToggle.addEventListener("click", () => {
    const current = root.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('creditsco_theme', next); } catch (e) {}
  });
}
