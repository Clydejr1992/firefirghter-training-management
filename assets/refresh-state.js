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

    if (tab && !tab.classList.contains("active")) {
      tab.click();
    }

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
