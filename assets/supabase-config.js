// Public publishable key for the dedicated Firefighter Training Management project.
// Never place a Supabase service_role or secret key in browser code.
window.FIRE_PORTAL_CONFIG = {
  url: "https://scvflimmbpxycrerikzg.supabase.co",
  anonKey: "sb_publishable_oU2LmKOHwH1vDGvEDws4lA_bO8EmyQJ"
};

// Additive feature loader: keeps the existing command-center app untouched.
window.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("trainingFilesScript")) return;
  const script = document.createElement("script");
  script.id = "trainingFilesScript";
  script.src = "assets/training-files.js?v=training-files-3";
  script.defer = true;
  document.head.appendChild(script);
  if (!document.getElementById("certificateAccessScript")) {
    const certificateScript = document.createElement("script");
    certificateScript.id = "certificateAccessScript";
    certificateScript.src = "assets/certificate-access.js?v=certificate-access-2";
    certificateScript.defer = true;
    document.head.appendChild(certificateScript);
  }
});

// Remember the administrator's current tab and scroll position so a browser
// refresh returns to the same part of the command center.
(() => {
  const TAB_KEY = "firefighterPortal.activeTab";
  const SCROLL_KEY = "firefighterPortal.scrollY";
  let restoring = false;

  const saveState = () => {
    const active = document.querySelector(".tabs .tab.active[data-tab]");
    if (active) localStorage.setItem(TAB_KEY, active.dataset.tab);
    localStorage.setItem(SCROLL_KEY, String(window.scrollY || 0));
  };

  const restoreState = () => {
    if (restoring) return;
    const admin = document.getElementById("adminView");
    if (!admin || admin.classList.contains("hidden")) return;

    const savedTab = localStorage.getItem(TAB_KEY);
    const tab = savedTab && document.querySelector(`.tabs .tab[data-tab="${CSS.escape(savedTab)}"]`);
    restoring = true;
    if (tab && !tab.classList.contains("active")) tab.click();

    const savedScroll = Number(localStorage.getItem(SCROLL_KEY));
    window.setTimeout(() => {
      if (Number.isFinite(savedScroll) && savedScroll > 0) {
        window.scrollTo({ top: savedScroll, behavior: "auto" });
      }
      restoring = false;
    }, 150);
  };

  document.addEventListener("click", event => {
    const tab = event.target.closest?.(".tabs .tab[data-tab]");
    if (tab) window.setTimeout(saveState, 0);
  }, true);

  window.addEventListener("scroll", () => {
    window.clearTimeout(window.__firePortalScrollTimer);
    window.__firePortalScrollTimer = window.setTimeout(saveState, 120);
  }, { passive: true });
  window.addEventListener("beforeunload", saveState);
  window.addEventListener("pagehide", saveState);

  const observer = new MutationObserver(() => restoreState());
  const startObserver = () => {
    const admin = document.getElementById("adminView");
    if (admin) observer.observe(admin, { attributes: true, attributeFilter: ["class"] });
    restoreState();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }
})();

// Class Matrix format:
// Members go ACROSS the top row.
// Training/certificates go DOWN the left side.
// Put an X where the member has that training/certificate.
// This also includes training files created before a member account existed.
window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("#downloadClassMatrix");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.matrixBusy === "1") return;
    button.dataset.matrixBusy = "1";
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Building Matrix...";

    try {
      const db = window.supabase.createClient(
        window.FIRE_PORTAL_CONFIG.url,
        window.FIRE_PORTAL_CONFIG.anonKey,
        { auth: { persistSession: true, autoRefreshToken: true } }
      );

      const [membersResult, recordsResult, filesResult, fileRecordsResult] = await Promise.all([
        db.from("firefighter_profiles").select("id,full_name,role").eq("role", "firefighter"),
        db.from("training_records").select("*"),
        db.from("training_files").select("id,full_name,member_id"),
        db.from("training_file_records").select("*")
      ]);

      for (const result of [membersResult, recordsResult, filesResult, fileRecordsResult]) {
        if (result.error) throw result.error;
      }

      const members = membersResult.data || [];
      const records = recordsResult.data || [];
      const files = filesResult.data || [];
      const fileRecords = fileRecordsResult.data || [];
      const people = new Map();
      members.forEach(member => people.set(`member:${member.id}`, { key: `member:${member.id}`, name: member.full_name || member.id }));
      files.forEach(file => {
        const key = file.member_id ? `member:${file.member_id}` : `file:${file.id}`;
        if (!people.has(key)) people.set(key, { key, name: file.full_name || "Unnamed Training File" });
      });

      const fileMap = new Map(files.map(file => [String(file.id), file]));
      const certificatesByPerson = new Map();
      const certificates = new Set();
      const certificateName = row => String(row?.training_name ?? row?.training ?? row?.class_name ?? "").trim();
      const addCertificate = (personKey, record) => {
        if (!people.has(personKey)) return;
        const certificate = certificateName(record);
        if (!certificate) return;
        certificates.add(certificate);
        if (!certificatesByPerson.has(personKey)) certificatesByPerson.set(personKey, new Set());
        certificatesByPerson.get(personKey).add(certificate);
      };
      records.forEach(record => { if (record.member_id) addCertificate(`member:${record.member_id}`, record); });
      fileRecords.forEach(record => {
        const file = fileMap.get(String(record.training_file_id));
        if (!file) return;
        addCertificate(file.member_id ? `member:${file.member_id}` : `file:${file.id}`, record);
      });

      const certificateNames = [...certificates].sort((a, b) => a.localeCompare(b));
      const personRows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (!personRows.length) throw new Error("There are no firefighter members or training files to include.");
      if (!certificateNames.length) throw new Error("There are no certificates/training records to include yet.");

      const rows = [
        ["Training / Certificate", ...personRows.map(person => person.name)],
        ...certificateNames.map(certificate => [certificate, ...personRows.map(person => {
          const owned = certificatesByPerson.get(person.key) || new Set();
          return owned.has(certificate) ? "X" : "";
        })])
      ];
      const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "firefighter-class-matrix.csv"; link.style.display = "none";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      alert(error?.message || "Unable to create class matrix.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      delete button.dataset.matrixBusy;
    }
  }, true);
});