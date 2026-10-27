(() => {
  const cfg = window.FIRE_PORTAL_CONFIG || {};
  let client = null;
  let busy = false;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));

  function getClient() {
    if (!client && cfg.url && cfg.anonKey && window.supabase?.createClient) {
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  async function getSession() {
    const db = getClient();
    if (!db) return null;
    const { data: { session } } = await db.auth.getSession();
    return session || null;
  }

  async function certificateUrl(path) {
    if (!path) throw new Error("No certificate image is attached to this training record.");
    const db = getClient();
    if (!db) throw new Error("Secure certificate access is not available.");
    const { data, error } = await db.storage
      .from("firefighter-certificates")
      .createSignedUrl(path, 600);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("The certificate image could not be opened.");
    return data.signedUrl;
  }

  function addButton(container, label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener("click", handler);
    container.appendChild(button);
  }

  async function viewCertificate(path) {
    try {
      const url = await certificateUrl(path);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      alert("Unable to open the certificate: " + (error.message || "Unknown error."));
    }
  }

  async function printCertificate(path, title) {
    const printWindow = window.open("", "_blank", "noopener");
    if (!printWindow) {
      alert("Your browser blocked the print window. Please allow pop-ups for this site and try again.");
      return;
    }
    printWindow.document.write("<!doctype html><html><head><title>" + esc(title || "Certificate") + "</title><style>html,body{margin:0;padding:0;background:#fff}body{display:flex;align-items:center;justify-content:center;min-height:100vh}img{display:block;max-width:100vw;max-height:100vh;width:auto;height:auto;object-fit:contain}@media print{body{min-height:0}img{max-width:100%;max-height:100%;page-break-inside:avoid}}</style></head><body><p>Loading certificate...</p></body></html>");
    printWindow.document.close();
    try {
      const url = await certificateUrl(path);
      printWindow.document.body.innerHTML = "<img id=\"certificateToPrint\" src=\"" + esc(url) + "\" alt=\"Certificate\">";
      const image = printWindow.document.getElementById("certificateToPrint");
      image.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      image.onerror = () => {
        printWindow.document.body.innerHTML = "<p>Unable to load the certificate image.</p>";
      };
    } catch (error) {
      printWindow.document.body.innerHTML = "<p>Unable to open the certificate: " + esc(error.message || "Unknown error.") + "</p>";
    }
  }

  function decorateCards(container, records) {
    if (!container || !records?.length) return;
    const cards = [...container.querySelectorAll(":scope > .card")];
    if (!cards.length) return;
    cards.forEach((card, index) => {
      const record = records[index];
      if (!record || !record.certificate_path || card.dataset.certificateAccessReady === "1") return;
      card.dataset.certificateAccessReady = "1";
      const row = document.createElement("div");
      row.className = "row";
      row.style.marginTop = "10px";
      addButton(row, "View Certificate", "secondary", () => viewCertificate(record.certificate_path));
      addButton(row, "Print Certificate", "primary", () => printCertificate(record.certificate_path, record.training_name));
      card.appendChild(row);
    });
  }

  async function enhanceMember() {
    const container = $("myRecords");
    if (!container || container.dataset.certificateLoading === "1") return;
    const session = await getSession();
    if (!session?.user) return;
    container.dataset.certificateLoading = "1";
    try {
      const db = getClient();
      const { data, error } = await db.from("training_records")
        .select("id,training_name,training_date,location,hours,certificate_path")
        .eq("member_id", session.user.id)
        .order("training_date", { ascending: false });
      if (error) throw error;
      decorateCards(container, data || []);
    } catch (error) {
      console.error("Certificate access setup failed:", error);
    } finally {
      delete container.dataset.certificateLoading;
    }
  }

  async function enhanceAdmin() {
    const container = $("records");
    if (!container || container.dataset.certificateLoading === "1") return;
    const session = await getSession();
    if (!session?.user) return;
    container.dataset.certificateLoading = "1";
    try {
      const db = getClient();
      const { data: profile, error: profileError } = await db.from("firefighter_profiles")
        .select("id,role,active")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profileError || profile?.role !== "admin" || !profile.active) return;
      const { data, error } = await db.from("training_records")
        .select("id,training_name,training_date,location,hours,certificate_path")
        .order("training_date", { ascending: false });
      if (error) throw error;
      decorateCards(container, data || []);
    } catch (error) {
      console.error("Administrator certificate access setup failed:", error);
    } finally {
      delete container.dataset.certificateLoading;
    }
  }

  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      await enhanceMember();
      await enhanceAdmin();
    } finally {
      busy = false;
    }
  }

  function start() {
    if (!getClient()) return;
    const memberObserver = new MutationObserver(() => { void refresh(); });
    const adminObserver = new MutationObserver(() => { void refresh(); });
    if ($("myRecords")) memberObserver.observe($("myRecords"), { childList: true });
    if ($("records")) adminObserver.observe($("records"), { childList: true });
    getClient().auth.onAuthStateChange(() => setTimeout(() => { void refresh(); }, 0));
    setInterval(() => { void refresh(); }, 1500);
    void refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
