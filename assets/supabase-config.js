// Public publishable key for the dedicated Firefighter Training Management project.
// Never place a Supabase service_role or secret key in browser code.
window.FIRE_PORTAL_CONFIG = {
  url: "https://scvflimmbpxycrerikzg.supabase.co",
  anonKey: "sb_publishable_oU2LmKOHwH1vDGvEDws4lA_bO8EmyQJ"
};

(() => {
  if (document.getElementById("firePortalEliteStyles")) return;
  const link = document.createElement("link");
  link.id = "firePortalEliteStyles";
  link.rel = "stylesheet";
  link.href = "assets/elite.css?v=elite-1";
  document.head.appendChild(link);
})();

window.addEventListener("DOMContentLoaded", () => {
  const loaders = [
    ["trainingFilesScript", "assets/training-files.js?v=training-files-3"],
    ["certificateAccessScript", "assets/certificate-access.js?v=certificate-access-2"],
    ["memberProfileFastScript", "assets/member-profile-fast.js?v=member-profile-fast-1"]
  ];
  loaders.forEach(([id,src]) => {
    if (document.getElementById(id)) return;
    const script=document.createElement("script");script.id=id;script.src=src;script.defer=true;document.head.appendChild(script);
  });
});

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
    window.setTimeout(() => { if (Number.isFinite(savedScroll) && savedScroll > 0) window.scrollTo({top:savedScroll,behavior:"auto"}); restoring=false; },150);
  };
  document.addEventListener("click",event=>{if(event.target.closest?.(".tabs .tab[data-tab]"))window.setTimeout(saveState,0)},true);
  window.addEventListener("scroll",()=>{window.clearTimeout(window.__firePortalScrollTimer);window.__firePortalScrollTimer=window.setTimeout(saveState,120)},{passive:true});
  window.addEventListener("beforeunload",saveState);window.addEventListener("pagehide",saveState);
  const startObserver=()=>{const admin=document.getElementById("adminView");if(admin)new MutationObserver(()=>restoreState()).observe(admin,{attributes:true,attributeFilter:["class"]});restoreState()};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startObserver,{once:true});else startObserver();
})();

window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", async event => {
    const button = event.target.closest?.("#downloadClassMatrix");
    if (!button) return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.dataset.matrixBusy==="1")return;
    button.dataset.matrixBusy="1";const originalText=button.textContent;button.disabled=true;button.textContent="Building Matrix...";
    try{
      const db=window.supabase.createClient(window.FIRE_PORTAL_CONFIG.url,window.FIRE_PORTAL_CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const [membersResult,recordsResult,filesResult,fileRecordsResult]=await Promise.all([
        db.from("firefighter_profiles").select("id,full_name,role").eq("role","firefighter"),db.from("training_records").select("*"),db.from("training_files").select("id,full_name,member_id"),db.from("training_file_records").select("*")
      ]);
      for(const result of [membersResult,recordsResult,filesResult,fileRecordsResult])if(result.error)throw result.error;
      const members=membersResult.data||[],records=recordsResult.data||[],files=filesResult.data||[],fileRecords=fileRecordsResult.data||[];
      const people=new Map();members.forEach(m=>people.set(`member:${m.id}`,{key:`member:${m.id}`,name:m.full_name||m.id}));files.forEach(f=>{const key=f.member_id?`member:${f.member_id}`:`file:${f.id}`;if(!people.has(key))people.set(key,{key,name:f.full_name||"Unnamed Training File"})});
      const fileMap=new Map(files.map(f=>[String(f.id),f])),byPerson=new Map(),certs=new Set();
      const certName=r=>String(r?.training_name??r?.training??r?.class_name??"").trim();
      const addCert=(key,r)=>{if(!people.has(key))return;const c=certName(r);if(!c)return;certs.add(c);if(!byPerson.has(key))byPerson.set(key,new Set());byPerson.get(key).add(c)};
      records.forEach(r=>{if(r.member_id)addCert(`member:${r.member_id}`,r)});fileRecords.forEach(r=>{const f=fileMap.get(String(r.training_file_id));if(f)addCert(f.member_id?`member:${f.member_id}`:`file:${f.id}`,r)});
      const classes=[...certs].sort((a,b)=>a.localeCompare(b)),peopleRows=[...people.values()].sort((a,b)=>a.name.localeCompare(b.name));
      if(!peopleRows.length)throw Error("There are no firefighter members or training files to include.");if(!classes.length)throw Error("There are no certificates/training records to include yet.");
      const rows=[["Training / Certificate",...peopleRows.map(p=>p.name)],...classes.map(c=>[c,...peopleRows.map(p=>(byPerson.get(p.key)||new Set()).has(c)?"X":"")])];
      const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n"),blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="firefighter-class-matrix.csv";link.style.display="none";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){alert(error?.message||"Unable to create class matrix.")}finally{button.disabled=false;button.textContent=originalText;delete button.dataset.matrixBusy}
  },true);
});