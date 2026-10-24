(() => {
  const cfg = window.FIRE_PORTAL_CONFIG || {};
  let client = null;
  let currentUser = null;
  let currentFileId = null;
  let initialized = false;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));

  function msg(id, text, kind = "info") {
    const el = $(id);
    if (el) {
      el.textContent = text;
      el.className = "message " + kind;
    }
  }

  async function getAdminSession() {
    if (!cfg.url || !cfg.anonKey || !window.supabase?.createClient) return null;
    if (!client) client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return null;
    const { data: profile, error } = await client
      .from("firefighter_profiles")
      .select("id,full_name,role,active")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error || !profile?.active || profile.role !== "admin") return null;
    currentUser = session.user;
    return profile;
  }

  function buildPanel() {
    const members = $("members");
    if (!members || $("standaloneTrainingFiles")) return;
    const panel = document.createElement("div");
    panel.id = "standaloneTrainingFiles";
    panel.className = "card";
    panel.style.marginBottom = "18px";
    panel.innerHTML = `
      <div class="card-kicker">TRAINING FILES</div>
      <div class="section-title">
        <div><h2 style="margin:0">Training Files Before Member Accounts</h2><p class="muted">Build a firefighter's training file first. You can link it to a member account later without re-entering the training.</p></div>
      </div>
      <div class="grid2" style="margin-top:14px">
        <form id="trainingFileCreateForm" class="card" style="margin:0">
          <h3>Create Training File</h3>
          <label>Firefighter name<input id="trainingFileName" required placeholder="John Smith"></label>
          <label>Notes <span class="muted">optional</span><textarea id="trainingFileNotes" placeholder="Prior department, certification history, etc."></textarea></label>
          <button class="primary full" type="submit">Create Training File</button>
          <p id="trainingFileCreateMsg" class="message"></p>
        </form>
        <div class="card" style="margin:0">
          <h3>Existing Training Files</h3>
          <div id="trainingFileList">Loading...</div>
        </div>
      </div>
      <div id="trainingFileEditor" class="card hidden" style="margin-top:14px">
        <div class="section-title"><div><span class="card-kicker">SELECTED FILE</span><h3 id="selectedTrainingFileName">Training File</h3><p id="selectedTrainingFileMeta" class="muted"></p></div><button id="closeTrainingFile" type="button">Close</button></div>
        <div class="grid2" style="margin-top:14px">
          <form id="trainingFileRecordForm" class="card" style="margin:0">
            <h3>Add Training / Certificate</h3>
            <label>Training Name<input id="tfTrainingName" required></label>
            <div class="grid2 compact"><label>Date<input id="tfTrainingDate" type="date" required></label><label>Expiration <span class="muted">optional</span><input id="tfExpiration" type="date"></label></div>
            <label>Location<input id="tfLocation" required></label>
            <label>Instructor<input id="tfInstructor"></label>
            <div class="grid2 compact"><label>Hours<input id="tfHours" type="number" min="0" step=".25" value="0" required></label><label>Class Number<input id="tfClassNumber"></label></div>
            <label class="check"><input id="tfRequired" type="checkbox"><span>This satisfies a required training</span></label>
            <label class="upload-zone"><span>Certificate image <span class="muted">optional</span></span><input id="tfCertificate" type="file" accept="image/*"><small>Original certificate remains administrator-only.</small></label>
            <button class="primary full" type="submit">Save Training to File</button>
            <p id="trainingFileRecordMsg" class="message"></p>
          </form>
          <div class="card" style="margin:0">
            <h3>Training Already in This File</h3>
            <div id="trainingFileRecords">No records yet.</div>
          </div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3>Link This File to a Member Account</h3>
          <p class="muted">Choose an existing firefighter profile. This copies the file's training records into that member's normal training history and keeps the original file as the source record.</p>
          <div class="grid2">
            <label>Firefighter account<select id="trainingFileMemberSelect"><option value="">Select a firefighter...</option></select></label>
            <div style="display:flex;align-items:end"><button id="linkTrainingFile" class="primary full" type="button">Link Training File</button></div>
          </div>
          <p id="trainingFileLinkMsg" class="message"></p>
        </div>
      </div>`;
    members.prepend(panel);

    $("trainingFileCreateForm").addEventListener("submit", createTrainingFile);
    $("trainingFileRecordForm").addEventListener("submit", addTrainingRecord);
    $("closeTrainingFile").addEventListener("click", closeEditor);
    $("linkTrainingFile").addEventListener("click", linkTrainingFile);
  }

  async function loadMembers() {
    const { data, error } = await client.from("firefighter_profiles")
      .select("id,full_name,role,active")
      .eq("role", "firefighter")
      .order("full_name");
    if (error) throw error;
    const select = $("trainingFileMemberSelect");
    if (!select) return;
    select.innerHTML = '<option value="">Select a firefighter...</option>' + (data || []).map(m =>
      `<option value="${esc(m.id)}">${esc(m.full_name || m.id)}${m.active ? "" : " (Inactive)"}</option>`
    ).join("");
  }

  async function loadFiles() {
    const list = $("trainingFileList");
    if (!list) return;
    const { data, error } = await client.from("training_files")
      .select("id,full_name,status,member_id,notes,created_at")
      .order("created_at", { ascending: false });
    if (error) { list.textContent = error.message; return; }
    if (!data?.length) { list.innerHTML = '<p class="muted">No training files have been created yet.</p>'; return; }
    list.innerHTML = data.map(f => `
      <article class="card" style="margin-bottom:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap">
          <div><strong>${esc(f.full_name)}</strong><p class="muted" style="margin:4px 0">${esc(f.status)}${f.member_id ? " · linked to member account" : " · no account yet"}</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" data-open-training-file="${esc(f.id)}">Open File</button>
            <button type="button" class="danger" data-delete-training-file="${esc(f.id)}" data-delete-training-name="${esc(f.full_name)}" data-delete-training-linked="${f.member_id ? "1" : "0"}">Delete File</button>
          </div>
        </div>
        ${f.notes ? `<p style="margin:8px 0 0">${esc(f.notes)}</p>` : ""}
      </article>`).join("");
    list.querySelectorAll("[data-open-training-file]").forEach(btn => btn.addEventListener("click", () => openFile(btn.dataset.openTrainingFile)));
    list.querySelectorAll("[data-delete-training-file]").forEach(btn => btn.addEventListener("click", () => deleteTrainingFile(btn.dataset.deleteTrainingFile, btn.dataset.deleteTrainingName, btn.dataset.deleteTrainingLinked === "1")));
  }

  async function deleteTrainingFile(id, name, linked) {
    const warning = linked
      ? `Delete the training file for ${name}? This removes the file and its private certificate images. Training records already copied to the member's normal Training History will remain.`
      : `Delete the training file for ${name}? This permanently removes the file, all training records inside it, and certificate images stored with those records.`;
    if (!confirm(warning)) return;
    const buttons = document.querySelectorAll(`[data-delete-training-file="${CSS.escape(id)}"]`);
    buttons.forEach(button => button.disabled = true);
    try {
      const { data: rows, error: readError } = await client.from("training_file_records")
        .select("certificate_path").eq("training_file_id", id);
      if (readError) throw readError;
      const paths = (rows || []).map(row => row.certificate_path).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await client.storage.from("firefighter-certificates").remove(paths);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await client.from("training_files").delete().eq("id", id);
      if (deleteError) throw deleteError;
      if (currentFileId === id) closeEditor();
      msg("trainingFileCreateMsg", `Training file for ${name} deleted.`, "success");
      await loadFiles();
    } catch (err) {
      alert(err.message || "Unable to delete the training file. No further changes were made.");
      buttons.forEach(button => button.disabled = false);
    }
  }

  async function createTrainingFile(e) {
    e.preventDefault();
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const name = $("trainingFileName").value.trim();
      if (!name) throw new Error("Enter the firefighter's name.");
      const { data, error } = await client.from("training_files").insert({
        full_name: name,
        notes: $("trainingFileNotes").value.trim(),
        created_by: currentUser.id
      }).select("id").single();
      if (error) throw error;
      e.target.reset();
      msg("trainingFileCreateMsg", "Training file created. You can now add certificates and training records before creating the member account.", "success");
      await loadFiles();
      if (data?.id) await openFile(data.id);
    } catch (err) {
      msg("trainingFileCreateMsg", err.message || "Unable to create training file.", "error");
    } finally { if (btn) btn.disabled = false; }
  }

  async function openFile(id) {
    currentFileId = id;
    const { data: file, error } = await client.from("training_files").select("id,full_name,status,member_id,notes").eq("id", id).single();
    if (error) { alert(error.message); return; }
    $("trainingFileEditor").classList.remove("hidden");
    $("selectedTrainingFileName").textContent = file.full_name;
    $("selectedTrainingFileMeta").textContent = `${file.status}${file.member_id ? " · linked to an existing member account" : " · no member account linked"}${file.notes ? " · " + file.notes : ""}`;
    await loadMembers();
    $("trainingFileMemberSelect").value = file.member_id || "";
    await loadFileRecords();
    $("trainingFileEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadFileRecords() {
    const target = $("trainingFileRecords");
    if (!target || !currentFileId) return;
    const { data, error } = await client.from("training_file_records").select("id,training_name,training_date,location,instructor,hours,expiration_date,class_number,satisfies_requirement,certificate_path").eq("training_file_id", currentFileId).order("training_date", { ascending: false });
    if (error) { target.textContent = error.message; return; }
    if (!data?.length) { target.innerHTML = '<p class="muted">No training records in this file yet.</p>'; return; }
    target.innerHTML = data.map(r => `<article class="card" style="margin-bottom:10px;padding:12px"><h4 style="margin:0 0 6px">${esc(r.training_name)}</h4><p style="margin:0">${esc(r.training_date)} · ${Number(r.hours || 0)} hours · ${esc(r.location)}</p><p class="muted" style="margin:4px 0">${esc(r.instructor || "")} ${r.class_number ? "· Class " + esc(r.class_number) : ""}${r.expiration_date ? " · Expires " + esc(r.expiration_date) : ""}</p><button type="button" class="danger" data-delete-training-file-record="${esc(r.id)}">Delete Record</button></article>`).join("");
    target.querySelectorAll("[data-delete-training-file-record]").forEach(btn => btn.addEventListener("click", () => deleteFileRecord(btn.dataset.deleteTrainingFileRecord)));
  }

  async function addTrainingRecord(e) {
    e.preventDefault();
    if (!currentFileId) return;
    const btn = e.submitter; if (btn) btn.disabled = true;
    let uploadedPath = null;
    try {
      const fileInput = $("tfCertificate");
      const image = fileInput?.files?.[0] || null;
      if (image) {
        const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `training-files/${currentFileId}/${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : "cert-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await client.storage.from("firefighter-certificates").upload(uploadedPath, image, { contentType: image.type || "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await client.from("training_file_records").insert({
        training_file_id: currentFileId,
        training_name: $("tfTrainingName").value.trim(),
        training_date: $("tfTrainingDate").value,
        location: $("tfLocation").value.trim(),
        instructor: $("tfInstructor").value.trim(),
        hours: Number($("tfHours").value || 0),
        class_number: $("tfClassNumber").value.trim(),
        expiration_date: $("tfExpiration").value || null,
        satisfies_requirement: $("tfRequired").checked,
        certificate_path: uploadedPath,
        created_by: currentUser.id
      });
      if (error) throw error;
      e.target.reset();
      $("tfHours").value = "0";
      msg("trainingFileRecordMsg", "Training record added to this file.", "success");
      await loadFileRecords();
    } catch (err) {
      if (uploadedPath) await client.storage.from("firefighter-certificates").remove([uploadedPath]);
      msg("trainingFileRecordMsg", err.message || "Unable to save the training record.", "error");
    } finally { if (btn) btn.disabled = false; }
  }

  async function deleteFileRecord(id) {
    if (!confirm("Delete this training record from the training file?")) return;
    const { data: row } = await client.from("training_file_records").select("certificate_path").eq("id", id).single();
    const { error } = await client.from("training_file_records").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    if (row?.certificate_path) await client.storage.from("firefighter-certificates").remove([row.certificate_path]);
    await loadFileRecords();
  }

  async function linkTrainingFile() {
    if (!currentFileId) return;
    const memberId = $("trainingFileMemberSelect").value;
    if (!memberId) { msg("trainingFileLinkMsg", "Choose a firefighter account first.", "error"); return; }
    if (!confirm("Link this training file to the selected firefighter and copy its training records into the normal Training History?")) return;
    const btn = $("linkTrainingFile"); btn.disabled = true;
    try {
      const { data: file, error: fileError } = await client.from("training_files").select("id,member_id,status").eq("id", currentFileId).single();
      if (fileError) throw fileError;
      if (file.member_id && file.member_id !== memberId) throw new Error("This training file is already linked to another member.");
      const { data: rows, error: rowsError } = await client.from("training_file_records").select("training_name,training_date,location,instructor,hours,class_number,expiration_date,satisfies_requirement,certificate_path").eq("training_file_id", currentFileId);
      if (rowsError) throw rowsError;
      const existing = rows || [];
      if (existing.length) {
        const payload = existing.map(r => ({ ...r, member_id: memberId, created_by: currentUser.id }));
        const { error: insertError } = await client.from("training_records").insert(payload);
        if (insertError) throw insertError;
      }
      const { error: updateError } = await client.from("training_files").update({ member_id: memberId, status: "linked", updated_at: new Date().toISOString() }).eq("id", currentFileId);
      if (updateError) throw updateError;
      msg("trainingFileLinkMsg", `Training file linked. ${existing.length} training record(s) were added to the member's normal training history.`, "success");
      await openFile(currentFileId);
      await loadFiles();
    } catch (err) {
      msg("trainingFileLinkMsg", err.message || "Unable to link the training file.", "error");
    } finally { btn.disabled = false; }
  }

  function closeEditor() {
    currentFileId = null;
    $("trainingFileEditor")?.classList.add("hidden");
  }

  async function setup() {
    if (initialized) return;
    const profile = await getAdminSession();
    if (!profile) return;
    buildPanel();
    initialized = true;
    await loadMembers();
    await loadFiles();
  }

  const adminView = $("adminView");
  if (adminView) {
    const observer = new MutationObserver(() => {
      if (!adminView.classList.contains("hidden")) setup().catch(() => {});
    });
    observer.observe(adminView, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("DOMContentLoaded", () => {
    if (!$("adminView")?.classList.contains("hidden")) setup().catch(() => {});
  });
})();
