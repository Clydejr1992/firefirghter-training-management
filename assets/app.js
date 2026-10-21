/* Fire Department Training Management
 * No demo passwords or client-side role overrides are used.
 * Configure assets/supabase-config.js and the server-side admin-user-management
 * Edge Function before enabling member administration in production.
 */
(() => {
  const config = window.FIRE_PORTAL_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const setMessage = (node, text, kind = "info") => {
    if (!node) return;
    node.textContent = text;
    node.className = "message " + kind;
  };
  let supabaseClient = null;
  let currentUser = null;
  let currentRole = null;
  let requestedRole = "firefighter";

  const loginView = $("loginView");
  const adminView = $("adminView");
  const memberView = $("memberView");
  const loginMsg = $("loginMsg");
  const roleLabel = $("roleLabel");

  function hideAllDashboards() {
    adminView?.classList.add("hidden");
    memberView?.classList.add("hidden");
    loginView?.classList.remove("hidden");
    $("logoutBtn")?.classList.add("hidden");
    if (roleLabel) roleLabel.textContent = "";
  }

  function setRole(role) {
    currentRole = role;
    if (roleLabel) roleLabel.textContent = role === "admin" ? "Administrator" : "Firefighter";
    loginView?.classList.add("hidden");
    $("logoutBtn")?.classList.remove("hidden");
    if (role === "admin") {
      adminView?.classList.remove("hidden");
      memberView?.classList.add("hidden");
    } else {
      memberView?.classList.remove("hidden");
      adminView?.classList.add("hidden");
    }
  }

  function showSetupMessage() {
    setMessage(loginMsg,
      "Secure sign-in is not configured yet. The website files are ready for Supabase Auth, but the department's authentication project and email invitations must be configured before anyone can sign in. No demo login is enabled.",
      "info");
    const loginButton = $("loginBtn");
    if (loginButton) loginButton.disabled = true;
  }

  async function loadProfile(user) {
    const { data, error } = await supabaseClient
      .from("firefighter_profiles")
      .select("full_name,role,active")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error("Could not verify account permissions. Please contact the administrator.");
    if (!data || data.active === false) {
      await supabaseClient.auth.signOut();
      throw new Error("This account is not active or has not been approved.");
    }
    if (!["admin", "firefighter"].includes(data.role)) {
      await supabaseClient.auth.signOut();
      throw new Error("This account does not have a valid department role.");
    }
    if (data.role !== requestedRole && requestedRole !== "any") throw new Error("This account does not match the selected sign-in type. Choose the correct sign-in tab.");
    currentUser = user;
    if ($("mw")) $("mw").textContent = data.full_name || user.email || "Firefighter";
    setRole(data.role);
  }

  async function invokeAdminAction(action, payload) {
    if (!supabaseClient || !currentUser || currentRole !== "admin") {
      throw new Error("Administrator sign-in is required.");
    }
    const { data, error } = await supabaseClient.functions.invoke("admin-user-management", {
      body: { action, ...payload }
    });
    if (error) throw new Error(error.message || "The administrator request could not be completed.");
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function installAdminAccountControls() {
    const host = $("members");
    if (!host || $("accountManagementCard")) return;
    const card = document.createElement("div");
    card.id = "accountManagementCard";
    card.className = "card";
    card.innerHTML = '<h2>Account Access</h2><p class="muted">Invite firefighters by email or send a fresh one-time password setup link. The firefighter chooses their own password. Administrators cannot view existing passwords.</p><form id="inviteForm"><div class="grid2"><label class="field">Firefighter name<input id="inviteName" autocomplete="name" required></label><label class="field">Email address<input id="inviteEmail" type="email" autocomplete="email" required></label></div><button class="primary" type="submit">Send One-Time Invitation</button><div id="inviteMsg" aria-live="polite"></div></form><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><form id="resetForm"><label class="field">Registered firefighter email<input id="resetEmail" type="email" autocomplete="email" required></label><button type="submit">Send Password Reset Link</button><div id="resetMsg" aria-live="polite"></div></form>';
    host.appendChild(card);
    $("inviteForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("inviteForm").querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await invokeAdminAction("invite", {
          email: $("inviteEmail").value.trim(),
          full_name: $("inviteName").value.trim(),
          redirect_to: window.location.origin + window.location.pathname
        });
        setMessage($("inviteMsg"), "Invitation requested. If email delivery is configured, the firefighter will receive a one-time setup link.", "success");
        $("inviteForm").reset();
      } catch (error) {
        setMessage($("inviteMsg"), error.message, "error");
      } finally { button.disabled = false; }
    });
    $("resetForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $("resetForm").querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await invokeAdminAction("reset_password", {
          email: $("resetEmail").value.trim(),
          redirect_to: window.location.origin + window.location.pathname
        });
        setMessage($("resetMsg"), "Password reset requested. If email delivery is configured, a one-time reset link will be sent.", "success");
        $("resetForm").reset();
      } catch (error) {
        setMessage($("resetMsg"), error.message, "error");
      } finally { button.disabled = false; }
    });
  }

  async function init() {
    hideAllDashboards();
    if (!config.url || !config.anonKey || !window.supabase?.createClient) {
      showSetupMessage();
      return;
    }
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      try { await loadProfile(session.user); } catch (error) { setMessage(loginMsg, error.message, "error"); }
    }
    supabaseClient.auth.onAuthStateChange((_event, sessionNow) => {
      if (!sessionNow?.user) {
        currentUser = null; currentRole = null; hideAllDashboards();
      } else {
        // Defer database work out of the auth callback to avoid lock contention.
        setTimeout(() => loadProfile(sessionNow.user).catch(error => {
          hideAllDashboards(); setMessage(loginMsg, error.message, "error");
        }), 0);
      }
    });
    const loginButton = $("loginBtn");
    if (loginButton) loginButton.disabled = false;
    $("memberMode")?.addEventListener("click", () => { requestedRole = "firefighter"; $("memberMode").classList.add("active"); $("adminMode")?.classList.remove("active"); });
    $("adminMode")?.addEventListener("click", () => { requestedRole = "admin"; $("adminMode").classList.add("active"); $("memberMode")?.classList.remove("active"); });
    loginButton?.addEventListener("click", async () => {
      const email = $("email")?.value.trim();
      const password = $("password")?.value;
      if (!email || !password) return setMessage(loginMsg, "Enter your email and password.", "error");
      loginButton.disabled = true;
      setMessage(loginMsg, "Signing in…");
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadProfile(data.user);
      } catch (error) {
        setMessage(loginMsg, error.message || "Sign-in failed.", "error");
      } finally { loginButton.disabled = false; }
    });
    $("logoutBtn")?.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      hideAllDashboards();
    });
    installAdminAccountControls();
  }

  // Expose only safe recovery handling for Supabase's emailed password-reset link.
  window.addEventListener("hashchange", handleRecoveryLink);
  function handleRecoveryLink() {
    if (!window.location.hash.includes("type=recovery") || !supabaseClient) return;
    const host = document.createElement("div");
    host.className = "modal";
    host.innerHTML = '<div class="modalbox"><h2>Choose a new password</h2><p class="muted">Create a password for your account. Use at least 12 characters.</p><form id="newPasswordForm"><label class="field">New password<input id="newPassword" type="password" minlength="12" autocomplete="new-password" required></label><label class="field">Confirm password<input id="confirmPassword" type="password" minlength="12" autocomplete="new-password" required></label><button class="primary" type="submit">Save New Password</button><div id="newPasswordMsg" aria-live="polite"></div></form></div>';
    document.body.appendChild(host);
    $("newPasswordForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      if ($("newPassword").value !== $("confirmPassword").value) return setMessage($("newPasswordMsg"), "The passwords do not match.", "error");
      const { error } = await supabaseClient.auth.updateUser({ password: $("newPassword").value });
      if (error) return setMessage($("newPasswordMsg"), error.message, "error");
      setMessage($("newPasswordMsg"), "Password updated. You can now sign in with your new password.", "success");
      history.replaceState(null, "", window.location.pathname);
      setTimeout(() => host.remove(), 1800);
    });
  }
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();