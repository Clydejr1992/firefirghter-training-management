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
  script.src = "assets/training-files.js?v=training-files-2";
  script.defer = true;
  document.head.appendChild(script);
});

// Class Matrix: one firefighter per row, including training files created
// before a member account existed. This is additive and does not change the
// normal training report or certificate records.
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
      const db = window.supabase.createClient(window.FIRE_PORTAL_CONFIG.url, window.FIRE_PORTAL_CONFIG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });

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

      // Existing accounts are always included. A pre-account training file
      // becomes its own row until it is linked to a member account.
      const people = new Map();
      members.forEach(member => {
        people.set(`member:${member.id}`, { key: `member:${member.id}`, name: member.full_name || member.id });
      });
      files.forEach(file => {
        const key = file.member_id ? `member:${file.member_id}` : `file:${file.id}`;
        if (!people.has(key)) {
          people.set(key, { key, name: file.full_name || "Unnamed Training File" });
        }
      });

      const fileMap = new Map(files.map(file => [String(file.id), file]));
      const completed = new Map();
      const classes = new Set();

      const trainingName = row => String(
        row?.training_name ?? row?.training ?? row?.class_name ?? ""
      ).trim();

      const mark = (personKey, row) => {
        if (!people.has(personKey)) return;
        const name = trainingName(row);
        if (!name) return;
        classes.add(name);
        if (!completed.has(personKey)) completed.set(personKey, new Set());
        completed.get(personKey).add(name);
      };

      records.forEach(record => {
        if (record.member_id) mark(`member:${record.member_id}`, record);
      });

      fileRecords.forEach(record => {
        const file = fileMap.get(String(record.training_file_id));
        if (!file) return;
        mark(file.member_id ? `member:${file.member_id}` : `file:${file.id}`, record);
      });

      const classNames = [...classes].sort((a, b) => a.localeCompare(b));
      const personRows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));

      if (!personRows.length) throw new Error("There are no firefighter members or training files to include.");
      if (!classNames.length) throw new Error("There are no training records to include yet.");

      const rows = [
        ["Member", ...classNames],
        ...personRows.map(person => {
          const done = completed.get(person.key) || new Set();
          return [person.name, ...classNames.map(className => done.has(className) ? "X" : "")];
        })
      ];

      const csv = rows.map(row => row.map(value =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      ).join(",")).join("\r\n");

      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "firefighter-class-matrix.csv";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
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
