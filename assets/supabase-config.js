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
});

// Class Matrix: members go down the rows. Every certificate/training name
// becomes a column. Put an X in a box when that member has that certificate,
// whether the certificate was saved after the account was created or inside
// a training file created before the member account existed.
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

      // Keep every current firefighter row. A training file that has not yet
      // been linked to an account is also retained as its own row.
      const people = new Map();
      members.forEach(member => {
        people.set(`member:${member.id}`, {
          key: `member:${member.id}`,
          name: member.full_name || member.id
        });
      });

      files.forEach(file => {
        const key = file.member_id ? `member:${file.member_id}` : `file:${file.id}`;
        if (!people.has(key)) {
          people.set(key, {
            key,
            name: file.full_name || "Unnamed Training File"
          });
        }
      });

      const fileMap = new Map(files.map(file => [String(file.id), file]));
      const certificatesByPerson = new Map();
      const certificates = new Set();

      const certificateName = row => String(
        row?.training_name ?? row?.training ?? row?.class_name ?? ""
      ).trim();

      const addCertificate = (personKey, record) => {
        if (!people.has(personKey)) return;
        const certificate = certificateName(record);
        if (!certificate) return;
        certificates.add(certificate);
        if (!certificatesByPerson.has(personKey)) certificatesByPerson.set(personKey, new Set());
        certificatesByPerson.get(personKey).add(certificate);
      };

      // Certificates saved directly to a member account.
      records.forEach(record => {
        if (record.member_id) addCertificate(`member:${record.member_id}`, record);
      });

      // Certificates saved in training files, including files made before
      // the member account was created.
      fileRecords.forEach(record => {
        const file = fileMap.get(String(record.training_file_id));
        if (!file) return;
        const personKey = file.member_id ? `member:${file.member_id}` : `file:${file.id}`;
        addCertificate(personKey, record);
      });

      const certificateNames = [...certificates].sort((a, b) => a.localeCompare(b));
      const personRows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));

      if (!personRows.length) throw new Error("There are no firefighter members or training files to include.");
      if (!certificateNames.length) throw new Error("There are no certificates/training records to include yet.");

      // EXACT MATRIX FORMAT:
      // Member | FF1 | FF2 | Hazmat | CPR | ...
      // Clyde  |  X  |    |   X    | X  | ...
      // John   |    |  X |   X    |    | ...
      const rows = [
        ["Member", ...certificateNames],
        ...personRows.map(person => {
          const owned = certificatesByPerson.get(person.key) || new Set();
          return [
            person.name,
            ...certificateNames.map(certificate => owned.has(certificate) ? "X" : "")
          ];
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
