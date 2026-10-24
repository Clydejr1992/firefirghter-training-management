(() => {
  const cfg = window.FIRE_PORTAL_CONFIG || {};
  let client;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  async function adminClient() {
    if (!client) client = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true,autoRefreshToken:true}});
    const {data:{session}} = await client.auth.getSession();
    if (!session?.user) return null;
    const {data:p,error} = await client.from("firefighter_profiles").select("id,role,active").eq("id",session.user.id).maybeSingle();
    return !error && p?.active && p.role === "admin" ? client : null;
  }

  async function deleteFile(id, name, linked) {
    const warning = linked
      ? `Delete the training file for ${name}?\n\nThe file and its file records will be removed. Training records already copied to the member's normal Training History will NOT be deleted, and their certificate images will be preserved.`
      : `Delete the training file for ${name}?\n\nThis removes the file, all training records inside it, and the certificate images stored with it.`;
    if (!confirm(warning)) return;
    const db = await adminClient();
    if (!db) { alert("Administrator access is required."); return; }
    try {
      const {data:rows,error:readError} = await db.from("training_file_records").select("certificate_path").eq("training_file_id",id);
      if (readError) throw readError;
      if (!linked) {
        const paths = (rows || []).map(r => r.certificate_path).filter(Boolean);
        if (paths.length) {
          const {error:storageError} = await db.storage.from("firefighter-certificates").remove(paths);
          if (storageError) throw storageError;
        }
      }
      const {error:deleteError} = await db.from("training_files").delete().eq("id",id);
      if (deleteError) throw deleteError;
      $("trainingFileEditor")?.classList.add("hidden");
      await render();
      alert("Training file deleted.");
    } catch (err) {
      alert(err.message || "Unable to delete the training file.");
    }
  }

  async function render() {
    const list = $("trainingFileList");
    if (!list) return;
    const db = await adminClient();
    if (!db) return;
    const {data,error} = await db.from("training_files").select("id,full_name,status,member_id,notes,created_at").order("created_at",{ascending:false});
    if (error || !data) return;
    list.innerHTML = data.length ? data.map(f => `
      <article class="card" style="margin-bottom:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap">
          <div><strong>${esc(f.full_name)}</strong><p class="muted" style="margin:4px 0">${esc(f.status)}${f.member_id ? " · linked to member account" : " · no account yet"}</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-delete-training-file="${esc(f.id)}" data-delete-training-name="${esc(f.full_name)}" data-delete-training-linked="${f.member_id ? "1" : "0"}" class="danger">Delete File</button></div>
        </div>
        ${f.notes ? `<p style="margin:8px 0 0">${esc(f.notes)}</p>` : ""}
      </article>`).join("") : '<p class="muted">No training files have been created yet.</p>';
    list.querySelectorAll("[data-delete-training-file]").forEach(btn => btn.addEventListener("click", () => deleteFile(btn.dataset.deleteTrainingFile, btn.dataset.deleteTrainingName, btn.dataset.deleteTrainingLinked === "1")));
  }

  function watch() {
    const list = $("trainingFileList");
    if (!list) return setTimeout(watch, 500);
    const observer = new MutationObserver(() => {
      list.querySelectorAll("[data-open-training-file]").forEach(open => {
        const id = open.dataset.openTrainingFile;
        if (!id || list.querySelector(`[data-delete-training-file=\"${CSS.escape(id)}\"]`)) return;
        const wrapper = open.parentElement;
        if (!wrapper) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "danger";
        button.textContent = "Delete File";
        button.dataset.deleteTrainingFile = id;
        button.dataset.deleteTrainingName = open.closest("article")?.querySelector("strong")?.textContent || "this firefighter";
        button.dataset.deleteTrainingLinked = open.closest("article")?.textContent.includes("linked to member account") ? "1" : "0";
        button.addEventListener("click", () => deleteFile(id, button.dataset.deleteTrainingName, button.dataset.deleteTrainingLinked === "1"));
        wrapper.appendChild(button);
      });
    });
    observer.observe(list,{childList:true,subtree:true});
  }

  window.addEventListener("DOMContentLoaded", watch);
})();
