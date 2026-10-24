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
