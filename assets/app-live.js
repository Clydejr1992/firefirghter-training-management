(() => {
 const cfg=window.FIRE_PORTAL_CONFIG||{}, $=id=>document.getElementById(id);
 let db,user,profile,role,selectedRole="firefighter",certImage=null,editingCertId=null;
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const show=(id,on)=>$(id)?.classList.toggle("hidden",!on);
 const message=(id,text,kind="info")=>{const n=$(id);if(n){n.textContent=text;n.className="message "+kind;}};
 const explainFunctionError=async(err)=>{let detail=err?.message||"Request failed.";const ctx=err?.context;if(ctx){try{const body=typeof ctx.clone==="function"?ctx.clone():ctx;if(typeof body.json==="function"){const payload=await body.json();detail=payload?.error||payload?.message||detail;}else if(typeof body.text==="function"){const raw=await body.text();try{const payload=JSON.parse(raw);detail=payload?.error||payload?.message||raw||detail}catch{detail=raw||detail}}}catch{}}if(/non-2xx status code/i.test(detail))detail="The server rejected the request but did not return readable details. Sign out and sign back in as an active administrator, then try again. If it continues, check the Edge Function logs.";return detail;};
 const read=async(t,cols="*")=>{const {data,error}=await db.from(t).select(cols);if(error)throw error;return data||[]};
 const add=async(t,row)=>{const {error}=await db.from(t).insert(row);if(error)throw error;};
 async function openDashboard(u,selected){
  const {data:p,error}=await db.from("firefighter_profiles").select("id,full_name,role,active").eq("id",u.id).maybeSingle();
  if(error)throw error;if(!p||!p.active)throw Error("Account not active. Contact your administrator.");
  if(selected&&p.role!==selected)throw Error("Choose the correct sign-in type.");
  user=u;profile=p;role=p.role;$("roleLabel").textContent=role==="admin"?"Administrator":"Firefighter";
  show("loginView",false);show("logoutBtn",true);show("adminView",role==="admin");show("memberView",role==="firefighter");
  if(role==="admin")await adminLoad();else await memberLoad();
 }
 function options(id,rows,label){const el=$(id);if(el)el.innerHTML=rows.map(r=>'<option value="'+esc(r.id)+'">'+esc(label(r))+'</option>').join("")}
 async function adminLoad(){
  const [members,records,events,reqs,bulletins,messages,audits]=await Promise.all([read("firefighter_profiles"),read("training_records"),read("training_events"),read("training_requirements"),read("department_bulletins"),read("member_messages"),read("admin_audit_log")]);
  const active=members.filter(m=>m.active),yr=records.filter(r=>r.training_date?.startsWith(String(new Date().getFullYear())));
  $("sMembers").textContent=active.filter(m=>m.role==="firefighter").length;$("sHours").textContent=yr.reduce((n,r)=>n+Number(r.hours||0),0).toFixed(1);$("sRecords").textContent=records.length;
  $("sDue").textContent=records.filter(r=>r.expiration_date&&new Date(r.expiration_date)<new Date(Date.now()+30*86400000)).length;$("sRequired").textContent=Math.max(0,reqs.length*active.filter(m=>m.role==="firefighter").length-records.filter(r=>r.satisfies_requirement).length);
  const firefighters=active.filter(m=>m.role==="firefighter");options("cmember",firefighters,m=>m.full_name||m.id);options("msgMember",firefighters,m=>m.full_name||m.id);
  if(!$("portalAccountControls")){const box=document.createElement("div");box.id="portalAccountControls";box.className="card";box.innerHTML='<h2>Create Firefighter Account</h2><form id="portalInviteForm"><div class="grid2"><label class="field">Full name<input id="portalInviteName" required></label><label class="field">Email<input id="portalInviteEmail" type="email" required></label><label class="field">Temporary password<input id="portalInvitePassword" type="password" minlength="12" autocomplete="new-password" required><small>Use at least 12 characters. Give this password to the firefighter securely.</small></label></div><button class="primary">Create Account</button><p id="portalInviteMsg" aria-live="polite"></p></form><hr><h2>Send Password Reset</h2><form id="portalResetForm"><label class="field">Registered email<input id="portalResetEmail" type="email" required></label><button>Send Reset Link</button><p id="portalResetMsg" aria-live="polite"></p></form>'; $("members").prepend(box); $("portalInviteForm").onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const {data,error}=await db.functions.invoke("admin-user-management",{body:{action:"create_user",email:$("portalInviteEmail").value.trim(),full_name:$("portalInviteName").value.trim(),password:$("portalInvitePassword").value,redirect_to:"https://clydejr1992.github.io/firefirghter-training-management/"}});if(error)throw error;if(data?.error)throw Error(data.error);message("portalInviteMsg","Account created. Give the firefighter their temporary password securely and ask them to change it after signing in.","success");e.target.reset();await adminLoad()}catch(x){message("portalInviteMsg",await explainFunctionError(x),"error")}finally{b.disabled=false}}; $("portalResetForm").onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const {data,error}=await db.functions.invoke("admin-user-management",{body:{action:"reset_password",email:$("portalResetEmail").value.trim(),redirect_to:"https://clydejr1992.github.io/firefirghter-training-management/"}});if(error)throw error;if(data?.error)throw Error(data.error);message("portalResetMsg","Reset email requested. Check Supabase email configuration if it does not arrive.","success");e.target.reset()}catch(x){message("portalResetMsg",await explainFunctionError(x),"error")}finally{b.disabled=false}};}
  $("memberCards").innerHTML=members.map(m=>'<article class="card"><h3>'+esc(m.full_name||"Unnamed")+'</h3><p>'+esc(m.role)+' · '+(m.active?"Active":"Inactive")+'</p><button data-member="'+esc(m.id)+'" data-active="'+(!m.active)+'">'+(m.active?"Deactivate":"Reactivate")+'</button>'+(m.id!==user.id?'<button class="danger" data-delete-member="'+esc(m.id)+'" data-member-name="'+esc(m.full_name||m.id)+'">Delete Account</button>':'<p class="muted">Your administrator account is protected.</p>')+'</article>').join("")||"<p>No members yet.</p>";
  $("records").innerHTML=records.sort((a,b)=>b.training_date.localeCompare(a.training_date)).map(r=>'<article class="card record" data-record-id="'+esc(r.id)+'"><h3>'+esc(r.training_name)+'</h3><p>'+esc(members.find(m=>m.id===r.member_id)?.full_name||"Member")+' · '+esc(r.training_date)+' · '+Number(r.hours)+' hours</p><p>'+esc(r.location)+' · '+esc(r.instructor)+'</p><button type="button" data-edit-cert="'+esc(r.id)+'">Edit Certificate</button><button type="button" class="danger" data-delete-cert="'+esc(r.id)+'" data-cert-name="'+esc(r.training_name)+'">Delete Certificate</button></article>').join("")||"<p>No training records yet.</p>";
  $("events").innerHTML=events.map(e=>'<article class="card"><h3>'+esc(e.title)+'</h3><p>'+esc(e.event_date)+' · '+esc(e.event_time)+' · '+esc(e.location)+' · '+e.hours+' hours</p><p>'+esc(e.description)+'</p></article>').join("")||"<p>No training events.</p>";
  $("reqs").innerHTML=reqs.map(r=>'<article class="card"><p><b>'+esc(r.name)+'</b> — '+esc(r.rule)+'</p><button type="button" style="display:inline-block;background:#b91c1c;color:#fff;padding:8px 12px;border:0;border-radius:6px;cursor:pointer;margin:6px 0" data-delete-requirement="'+esc(r.id)+'" data-requirement-name="'+esc(r.name)+'">Delete Requirement</button></article>').join("")||"<p>No requirements.</p>";
  $("bulletinList").innerHTML=bulletins.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||"")).map(b=>{const details=[b.event_date?"Training date: "+esc(b.event_date):"",b.event_time?"Time: "+esc(b.event_time):"",b.location?"Location: "+esc(b.location):"",b.hours!==null&&b.hours!==undefined&&b.hours!==""?"Hours: "+esc(b.hours):"",b.instructor?"Instructor: "+esc(b.instructor):""].filter(Boolean);return '<article class="card"><p class="muted"><strong>PUBLISHED</strong> · '+esc(b.kind||"announcement")+(b.created_at?" · Posted "+esc(new Date(b.created_at).toLocaleString()):"")+'</p><h3>'+esc(b.title||"Untitled announcement")+'</h3><p>'+esc(b.body||"")+'</p>'+(details.length?'<div class="published-details"><h4>Training details</h4><ul>'+details.map(d=>"<li>"+d+"</li>").join("")+'</ul></div>':"")+'<button type="button" data-remove-item="'+esc(b.id)+'">Delete Published Item</button></article>'}).join("")||"<p>No published items.</p>";
  $("adminUpcoming").innerHTML=events.filter(e=>e.event_date>=new Date().toISOString().slice(0,10)).map(e=>'<p>'+esc(e.title)+' — '+esc(e.event_date)+' at '+esc(e.location)+'</p>').join("")||"No upcoming training.";
  $("adminAlerts").textContent=active.length+" active accounts · "+records.length+" training records";
  $("activity").innerHTML=audits.slice(-10).reverse().map(a=>'<p>'+esc(a.action)+' · '+esc(a.entity_type)+' · '+esc(a.created_at)+'</p>').join("")||"No activity yet.";
  $("report").textContent=records.length+" records · "+records.reduce((n,r)=>n+Number(r.hours||0),0).toFixed(1)+" total hours";$("audit").innerHTML=$("activity").innerHTML;
  $("downloadClassMatrix").onclick=()=>{
    try{
      const names=[...new Set(members.map(m=>m.full_name||"Unnamed Member"))].sort((a,b)=>a.localeCompare(b));
      const classes=[...new Set(records.map(r=>String(r.training_name||"Unspecified Class").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      if(!names.length){alert("There are no members to include in the class matrix.");return}
      if(!classes.length){alert("There are no saved certificates or training records to include yet.");return}
      const rows=[["Class Name",...names],...classes.map(cls=>[cls,...names.map(name=>records.some(r=>(members.find(m=>m.id===r.member_id)?.full_name||"Unnamed Member")===name&&String(r.training_name||"Unspecified Class").trim()===cls)?"X":"")])];
      const csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
      const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="firefighter-class-matrix.csv";a.style.display="none";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(err){alert("Unable to create class matrix: "+err.message)}
  };
  $("downloadCsv").onclick=()=>{const rows=[["Member","Training","Date","Location","Instructor","Hours","Expiration"],...records.map(r=>[members.find(m=>m.id===r.member_id)?.full_name||"",r.training_name,r.training_date,r.location,r.instructor,r.hours,r.expiration_date||""])];const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="training-report.csv";a.click();};
 }
 async function memberCertificateForMember(path,print=false){
  if(!path){alert("No certificate image is attached to this training record.");return}
  const win=print?window.open("about:blank","_blank"):null;
  try{
   const bucket="firefighter-certificates";
   const raw=String(path).trim();
   const candidates=[];
   const add=value=>{if(value){const v=String(value).trim().replace(/^\/+/, "");if(v&&!candidates.includes(v))candidates.push(v)}};
   add(raw);
   add(raw.split("?")[0]);
   add(raw.replace(/^firefighter-certificates\//,""));
   const marker="/storage/v1/object/";
   if(raw.includes(marker)){
    let tail=raw.slice(raw.indexOf(marker)+marker.length).replace(/^(sign|public|authenticated)\//,"");
    if(tail.startsWith(bucket+"/"))tail=tail.slice(bucket.length+1);
    add(tail);
   }
   let signedUrl=null,lastError=null;
   for(const candidate of candidates){
    const result=await Promise.race([
     db.storage.from(bucket).createSignedUrl(candidate,600),
     new Promise((_,reject)=>setTimeout(()=>reject(new Error("Certificate storage request timed out. Check your connection and Supabase storage permissions.")),12000))
    ]);
    if(!result.error&&result.data?.signedUrl){signedUrl=result.data.signedUrl;break}
    lastError=result.error;
   }
   if(!signedUrl)throw Error("The saved certificate path does not match an image in the certificate storage. The image may have been moved or deleted."+(lastError?.message?" Details: "+lastError.message:""));
   if(print){
    if(!win)throw Error("Allow pop-ups to print the certificate.");
    win.document.open();
    win.document.write('<!doctype html><html><head><title>Print Certificate</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#fff}body{display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:100vh;object-fit:contain}@media print{@page{margin:8mm}img{max-width:100%;max-height:96vh}}</style></head><body><img id="certificate" alt="Certificate"></body></html>');
    win.document.close();
    const img=win.document.getElementById("certificate");img.onload=()=>{win.focus();win.print()};img.onerror=()=>{win.close();alert("Certificate image could not load for printing.")};img.src=signedUrl;
   }else{
    const overlay=document.createElement("div");overlay.className="certOverlay";
    overlay.innerHTML='<div class="certPanel"><div class="certBar"><button type="button" data-close>Close</button><button type="button" data-print>Print Certificate</button></div><div class="certImgWrap"><img class="certImg" alt="Certificate"></div></div>';
    document.body.appendChild(overlay);overlay.querySelector("img").src=signedUrl;
    overlay.querySelector("[data-close]").onclick=()=>overlay.remove();overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove()});
    overlay.querySelector("[data-print]").onclick=()=>memberCertificateForMember(path,true);
   }
  }catch(e){if(win&&!win.closed)win.close();alert("Unable to "+(print?"print":"open")+" certificate: "+(e?.message||"Unknown error"))}
 }

 async function loadDirectMessages(){
  const box=$("memberDirectMessages"); if(!box)return;
  box.innerHTML='<p class="muted">Loading private messages…</p>';
  try{
   const [peopleRes,msgRes]=await Promise.all([
    db.from("firefighter_profiles").select("id,full_name,role").eq("active",true).eq("role","firefighter").order("full_name"),
    db.from("member_direct_messages").select("id,sender_id,recipient_id,body,created_at").order("created_at",{ascending:true})
   ]);
   if(peopleRes.error)throw peopleRes.error;if(msgRes.error)throw msgRes.error;
   const people=peopleRes.data||[], msgs=msgRes.data||[], names=new Map(people.map(p=>[p.id,p.full_name||"Firefighter"]));
   const relevant=msgs.filter(m=>m.sender_id===user.id||m.recipient_id===user.id);
   box.innerHTML='<form id="directMessageForm" class="card"><h3>Message a Firefighter</h3><label class="field">Send to<select id="directRecipient" required><option value="">Choose a member…</option>'+people.filter(p=>p.id!==user.id).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.full_name||"Firefighter")+'</option>').join("")+'</select></label><label class="field">Message<textarea id="directBody" rows="3" maxlength="4000" required placeholder="Write your message…"></textarea></label><button class="primary" type="submit">Send Message</button><p id="directMessageStatus" aria-live="polite"></p></form><h3 style="margin-top:18px">Private Conversations</h3>'+(relevant.length?relevant.map(m=>'<article class="card" style="margin-top:10px"><p><strong>'+(m.sender_id===user.id?'You → '+esc(names.get(m.recipient_id)||'Member') : esc(names.get(m.sender_id)||'Member')+' → You')+'</strong></p><p>'+esc(m.body)+'</p><small class="muted">'+esc(new Date(m.created_at).toLocaleString())+'</small></article>').join(""):'<p class="muted">No direct messages yet.</p>');
   $("directMessageForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter,recipient=$("directRecipient").value,body=$("directBody").value.trim();if(!recipient||!body)return;btn.disabled=true;try{const {error}=await db.from("member_direct_messages").insert({sender_id:user.id,recipient_id:recipient,body});if(error)throw error;await loadDirectMessages()}catch(err){const n=$("directMessageStatus");if(n){n.textContent="Message could not be sent: "+err.message;n.className="message error"}}finally{if(btn.isConnected)btn.disabled=false}};
  }catch(err){box.innerHTML='<p class="message error">Private messaging could not load: '+esc(err.message)+'.</p>'}
 }
 async function memberLoad(){
  const [records,events,bulletins,messages,reqs]=await Promise.all([read("training_records"),read("training_events"),read("department_bulletins"),read("member_messages"),read("training_requirements")]);
  const mine=records.filter(r=>r.member_id===user.id),year=mine.filter(r=>r.training_date?.startsWith(String(new Date().getFullYear())));
  $("mw").textContent=profile.full_name||user.email;$("mhours").textContent=year.reduce((n,r)=>n+Number(r.hours||0),0).toFixed(1);$("mrecords").textContent=mine.length;
   const dueCutoff=new Date(Date.now()+30*86400000);
   const dueRecords=mine.filter(r=>r.expiration_date&&new Date(r.expiration_date)<=dueCutoff).sort((a,b)=>String(a.expiration_date).localeCompare(String(b.expiration_date)));
   $("mdue").textContent=dueRecords.length;
   $("memberNotices").innerHTML=dueRecords.length?'<div class="card" style="margin:16px 0;border-color:rgba(255,90,110,.55)"><div class="card-kicker">CERTIFICATION ATTENTION</div><h2>Certifications Due or Expired</h2><p>These certifications are expired or will expire within 30 days. Open the attached certificate to review it.</p>'+dueRecords.map(r=>{const expired=new Date(r.expiration_date)<new Date(new Date().toDateString());const hasCert=!!r.certificate_path;return '<article class="card" style="margin-top:12px"><h3>'+esc(r.training_name)+'</h3><p><strong>'+(expired?'Expired':'Expiration date')+':</strong> '+esc(r.expiration_date)+'</p><p>'+esc(r.location||'')+'</p>'+(hasCert?'<button type="button" class="secondary" data-member-view-cert="'+esc(r.id)+'">View Certificate</button><button type="button" class="primary" data-member-print-cert="'+esc(r.id)+'">Print Certificate</button>':'<p class="muted">No certificate is attached to this training record.</p>')+'</article>'}).join('')+'</div>':'<div class="card" style="margin:16px 0"><div class="card-kicker">CERTIFICATION STATUS</div><h3>No certifications due in the next 30 days</h3></div>';
   $("mmissing").textContent=Math.max(0,reqs.length-mine.filter(r=>r.satisfies_requirement).length);
  $("myRecords").innerHTML=mine.map(r=>{
    const hasCert=!!r.certificate_path;
    return '<article class="card" data-record-id="'+esc(r.id)+'"><h3>'+esc(r.training_name)+'</h3><p>'+esc(r.training_date)+' · '+r.hours+' hours</p><p>'+esc(r.location)+'</p><div class="row" style="margin-top:10px"><button type="button" class="secondary" data-member-view-cert="'+esc(r.id)+'" '+(hasCert?'':'disabled')+'>View Certificate</button><button type="button" class="primary" data-member-print-cert="'+esc(r.id)+'" '+(hasCert?'':'disabled')+'>Print Certificate</button></div>'+(hasCert?'':'<p class="muted">Certificate not attached to this record yet.</p>')+'</article>';
  }).join("")||"No training records yet.";
  // Enforce one certificate action of each type per training record across the entire history.
  const dedupeCertificateButtons=()=>{
    const seen=new Set();
    document.querySelectorAll("#myRecords button[data-member-view-cert],#myRecords button[data-member-print-cert]").forEach(button=>{
      const kind=button.hasAttribute("data-member-view-cert")?"view":"print";
      const recordId=button.getAttribute(kind==="view"?"data-member-view-cert":"data-member-print-cert");
      const key=kind+":"+recordId;
      if(seen.has(key)){button.remove();return;}
      seen.add(key);
    });
  };
  dedupeCertificateButtons();
  if(window.__memberCertDedupeObserver)window.__memberCertDedupeObserver.disconnect();
  window.__memberCertDedupeObserver=new MutationObserver(()=>dedupeCertificateButtons());
  window.__memberCertDedupeObserver.observe(document.body,{childList:true,subtree:true});
  $("myHours").innerHTML=bulletins.filter(b=>b.kind!=="offer").map(b=>'<article class="card"><h3>'+esc(b.title)+'</h3><p>'+esc(b.body)+'</p></article>').join("")||"No bulletins.";
  $("myEvents").innerHTML=events.filter(e=>e.event_date>=new Date().toISOString().slice(0,10)).map(e=>'<article class="card"><h3>'+esc(e.title)+'</h3><p>'+esc(e.event_date)+' · '+esc(e.location)+' · '+e.hours+' hours</p></article>').join("")||"No upcoming training.";
  $("myMessages").innerHTML=messages.filter(m=>m.member_id===user.id).map(m=>'<article class="card"><h3>'+esc(m.subject)+'</h3><p>'+esc(m.body)+'</p></article>').join("")||"No messages.";
  await loadDirectMessages();
 }
 async function init(){
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab)?.classList.add("active")}));
  if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient){$("loginBtn").disabled=true;message("loginMsg","Supabase is not configured.","error");return}
  db=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  $("loginBtn").addEventListener("click",async()=>{$("loginBtn").disabled=true;try{const email=$("email").value.trim(),password=$("password").value;if(!email||!password)throw Error("Enter your department email and password.");const {data,error}=await db.auth.signInWithPassword({email,password});if(error){if(error.message==="Invalid login credentials")throw Error("Email or password is incorrect. Use Forgot password to send a secure reset link, then sign in with your new password.");throw error}await openDashboard(data.user,selectedRole)}catch(e){message("loginMsg",e.message||"Unable to sign in. Please try again.","error")}finally{$("loginBtn").disabled=false}});
  const {data:{session}}=await db.auth.getSession();if(session?.user)try{await openDashboard(session.user)}catch(e){message("loginMsg",e.message,"error")}
  $("memberMode").onclick=()=>{selectedRole="firefighter";$("memberMode").classList.add("active");$("adminMode").classList.remove("active")};$("adminMode").onclick=()=>{selectedRole="admin";$("adminMode").classList.add("active");$("memberMode").classList.remove("active")};
  const clearSignInFields=()=>{["email","password"].forEach(id=>{const field=$(id);if(field)field.value="";});const form=$("loginForm");if(form?.reset)form.reset();message("loginMsg","");};
  $("logoutBtn").onclick=async()=>{try{await db.auth.signOut();}finally{clearSignInFields();show("loginView",true);show("adminView",false);show("memberView",false);show("logoutBtn",false);selectedRole="firefighter";$("memberMode")?.classList.add("active");$("adminMode")?.classList.remove("active");window.scrollTo({top:0,behavior:"instant"});}};
  $("certForm").onsubmit=async e=>{
  e.preventDefault();const saveBtn=e.submitter;if(saveBtn)saveBtn.disabled=true;let uploadedPath=null;
  try{
    let certificatePath=null;
    if(certImage){const ext=certImage.type==="image/png"?"png":certImage.type==="image/webp"?"webp":"jpg";uploadedPath=$("cmember").value+"/"+(globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():"cert-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2))+"."+ext;const {error:uploadError}=await db.storage.from("firefighter-certificates").upload(uploadedPath,certImage,{contentType:certImage.type||"image/jpeg",upsert:false});if(uploadError)throw uploadError;certificatePath=uploadedPath;}
    const payload={member_id:$("cmember").value,training_name:$("ctitle").value.trim(),training_date:$("cdate").value,location:$("clocation").value.trim(),instructor:$("cinstructor").value.trim(),hours:Number($("chours").value),class_number:$("cclass").value.trim(),expiration_date:$("cexp").value||null,satisfies_requirement:$("crequired").checked,created_by:user.id};
    let result;
    if(editingCertId){
      const {data:existing,error:readError}=await db.from("training_records").select("id,certificate_path").eq("id",editingCertId).maybeSingle();if(readError)throw readError;if(!existing)throw Error("This certificate could not be found. Refresh the records and try again.");
      if(certificatePath)payload.certificate_path=certificatePath;
      const {error}=await db.from("training_records").update(payload).eq("id",editingCertId);if(error)throw error;
      if(certificatePath&&existing.certificate_path){const {error:removeError}=await db.storage.from("firefighter-certificates").remove([existing.certificate_path]);if(removeError)console.error("Updated record saved but old certificate image cleanup failed:",removeError);}
      result="Certificate changes saved.";
    }else{
      payload.certificate_path=certificatePath;const {error}=await db.from("training_records").insert(payload);if(error)throw error;result="Certificate and training record saved.";
    }
    editingCertId=null;e.target.reset();certImage=null;const preview=$("preview");if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);preview.removeAttribute("src");preview.classList.add("hidden");delete preview.dataset.objectUrl;}
    const submitBtn=$("certForm").querySelector('[type="submit"]');if(submitBtn)submitBtn.textContent="Save Certificate";message("certMsg",result,"success");await adminLoad();
  }catch(x){if(uploadedPath){const {error:cleanupError}=await db.storage.from("firefighter-certificates").remove([uploadedPath]);if(cleanupError)console.error("Uploaded certificate cleanup failed:",cleanupError);}message("certMsg",x.message,"error")}finally{if(saveBtn)saveBtn.disabled=false}
};
  $("eventForm").onsubmit=async e=>{e.preventDefault();try{await add("training_events",{title:$("etitle").value,event_date:$("edate").value,event_time:$("etime").value,location:$("elocation").value,hours:Number($("ehours").value),instructor:$("einstructor").value,required:$("erequired").checked,description:$("edesc").value,created_by:user.id});e.target.reset();await adminLoad()}catch(x){alert(x.message)}};
  $("reqForm").onsubmit=async e=>{e.preventDefault();try{await add("training_requirements",{name:$("rname").value,rule:$("rrule").value,created_by:user.id});e.target.reset();await adminLoad()}catch(x){alert(x.message)}};
  $("hoursForm").onsubmit=async e=>{e.preventDefault();try{await add("department_bulletins",{kind:"hours",title:$("btitle").value,body:$("bbody").value,created_by:user.id});e.target.reset();await adminLoad()}catch(x){alert(x.message)}};
  $("offerForm").onsubmit=async e=>{e.preventDefault();try{await add("department_bulletins",{kind:"offer",title:$("otitle").value,body:$("obody").value,event_date:$("odate").value,event_time:$("otime").value,location:$("olocation").value,hours:Number($("ohours").value),created_by:user.id});e.target.reset();await adminLoad()}catch(x){alert(x.message)}};
  $("messageForm").onsubmit=async e=>{e.preventDefault();try{await add("member_messages",{member_id:$("msgMember").value,subject:$("msgSubject").value,body:$("msgBody").value,created_by:user.id});e.target.reset();await adminLoad()}catch(x){alert(x.message)}};
  $("bulletinList").addEventListener("click",async e=>{const b=e.target.closest("[data-remove-item]");if(!b)return;if(!confirm("Are you sure you want to delete this published item?"))return;b.disabled=true;try{const {error}=await db.from("department_bulletins").delete().eq("id",b.dataset.removeItem);if(error)throw error;await adminLoad()}catch(err){alert("Unable to delete item: "+err.message);b.disabled=false}});
  $("memberCards").onclick=async e=>{const del=e.target.closest("[data-delete-member]");if(del){if(!confirm('Delete the account for '+del.dataset.memberName+'? This permanently removes their login.'))return;del.disabled=true;try{const {data,error}=await db.functions.invoke("admin-user-management",{body:{action:"delete_user",user_id:del.dataset.deleteMember,redirect_to:"https://clydejr1992.github.io/firefirghter-training-management/"}});if(error)throw error;if(data?.error)throw Error(data.error);await adminLoad();alert("Account deleted.")}catch(x){alert("Unable to delete account: "+await explainFunctionError(x));del.disabled=false}return}const b=e.target.closest("[data-member]");if(!b)return;b.disabled=true;try{const {data,error}=await db.functions.invoke("admin-user-management",{body:{action:"set_active",user_id:b.dataset.member,active:b.dataset.active==="true",redirect_to:"https://clydejr1992.github.io/firefirghter-training-management/"}});if(error)throw error;if(data?.error)throw Error(data.error);await adminLoad()}catch(x){alert("Unable to change account status: "+await explainFunctionError(x));b.disabled=false}};
  $("reqs").onclick=async e=>{const b=e.target.closest("[data-delete-requirement]");if(!b)return;if(!confirm('Delete the requirement "'+b.dataset.requirementName+'"? This cannot be undone.'))return;b.disabled=true;try{const {error}=await db.from("training_requirements").delete().eq("id",b.dataset.deleteRequirement);if(error)throw error;await adminLoad()}catch(x){alert("Unable to delete requirement: "+x.message);b.disabled=false}};
  $("records").onclick=async e=>{
  const edit=e.target.closest("[data-edit-cert]");
  if(edit){
    try{
      const {data:r,error}=await db.from("training_records").select("*").eq("id",edit.dataset.editCert).maybeSingle();
      if(error)throw error;if(!r)throw Error("Training record was not found.");
      editingCertId=r.id;
      $("cmember").value=r.member_id||"";$("ctitle").value=r.training_name||"";$("cdate").value=r.training_date||"";$("cexp").value=r.expiration_date||"";$("clocation").value=r.location||"";$("cinstructor").value=r.instructor||"";$("chours").value=r.hours??0;$("cclass").value=r.class_number||"";$("crequired").checked=!!r.satisfies_requirement;
      certImage=null;const preview=$("preview");if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);preview.removeAttribute("src");preview.classList.add("hidden");delete preview.dataset.objectUrl;}
      const submit=$("certForm").querySelector('[type="submit"]');if(submit)submit.textContent="Save Certificate Changes";
      message("certMsg","Editing certificate: "+(r.training_name||"Training record"),"info");$("scan").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(x){alert("Unable to open certificate for editing: "+x.message)}return;
  }
  const b=e.target.closest("[data-delete-cert]");if(!b)return;
  if(!confirm('Delete certificate "'+b.dataset.certName+'"? This permanently deletes the saved training record.'))return;
  b.disabled=true;
  try{const {data:record,error:readError}=await db.from("training_records").select("id,certificate_path").eq("id",b.dataset.deleteCert).maybeSingle();if(readError)throw readError;if(!record)throw Error("Training record was not found.");const {error}=await db.from("training_records").delete().eq("id",b.dataset.deleteCert);if(error)throw error;if(record.certificate_path){const {error:storageError}=await db.storage.from("firefighter-certificates").remove([record.certificate_path]);if(storageError)console.error("Record deleted but certificate file cleanup failed:",storageError);}await adminLoad();message("certMsg","Certificate and training record deleted.","success")}catch(x){alert("Unable to delete certificate: "+x.message);b.disabled=false}
};
  let cameraStream=null;
  const stopCamera=()=>{if(cameraStream){cameraStream.getTracks().forEach(track=>track.stop());cameraStream=null;}const v=$("video");if(v){v.pause();v.srcObject=null;}if($("capture"))$("capture").disabled=true;if($("startCam"))$("startCam").textContent="Start Camera";};
  const showPreview=(blobOrUrl)=>{const img=$("preview");if(!img)return;if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl);certImage=blobOrUrl instanceof Blob?blobOrUrl:null;if(blobOrUrl instanceof Blob){const url=URL.createObjectURL(blobOrUrl);img.dataset.objectUrl=url;img.src=url;}else img.src=blobOrUrl;img.classList.remove("hidden");};
  $("startCam").onclick=async()=>{
   if(cameraStream){stopCamera();return;}
   const b=$("startCam");
   if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    message("certMsg","Camera access requires HTTPS. Open the secure site https://clydejr1992.github.io/firefirghter-training-management/ or upload a certificate image. The whtraining.tech security certificate must be fixed for camera scanning to work there.","error");
    return;
   }
   b.disabled=true;message("certMsg","Requesting camera permission…");
   try{
    try{
     cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
    }catch(firstError){
     // Some iPhones reject ideal camera constraints; retry with the simplest video request.
     cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
    }
    const v=$("video");
    if(!v)throw Error("The camera preview element is missing. Refresh the page and try again.");
    v.srcObject=cameraStream;v.muted=true;v.autoplay=true;v.playsInline=true;v.setAttribute("playsinline","");
    await new Promise((resolve,reject)=>{
     if(v.readyState>=2&&v.videoWidth){resolve();return;}
     const timer=setTimeout(()=>reject(Error("The camera opened but did not provide a picture. Try Stop Camera and Start Camera again.")),8000);
     v.addEventListener("loadedmetadata",()=>{clearTimeout(timer);resolve();},{once:true});
     v.addEventListener("error",()=>{clearTimeout(timer);reject(Error("The camera preview could not be loaded."));},{once:true});
    });
    await v.play();
    $("capture").disabled=false;b.textContent="Stop Camera";
    message("certMsg","Camera ready. Position the certificate and select Capture.","success");
   }catch(err){
    stopCamera();
    let reason=err?.name==="NotAllowedError"?"Camera permission was denied. Allow camera access for this website in Safari settings, then try again.":err?.name==="NotFoundError"?"No camera was found on this device. Upload a certificate image instead.":err?.name==="NotReadableError"?"The camera may be in use by another app. Close other camera apps and try again.":(err?.message||"Unable to start the camera.")+" You can upload a certificate image instead.";
    message("certMsg",reason,"error");
   }finally{b.disabled=false;}
  };
  $("capture").onclick=()=>{const v=$("video"),canvas=$("canvas");if(!cameraStream||!v||!canvas||!v.videoWidth){message("certMsg","Start the camera and wait for the live picture before capturing.","error");return;}canvas.width=v.videoWidth;canvas.height=v.videoHeight;const ctx=canvas.getContext("2d");if(!ctx){message("certMsg","This browser cannot process the camera image. Upload an image instead.","error");return;}ctx.drawImage(v,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){message("certMsg","The camera image could not be captured. Try again or upload an image.","error");return;}showPreview(blob);stopCamera();message("certMsg","Certificate captured for preview. Complete the details and select Save Certificate to save the training record.","success");},"image/jpeg",0.92);};
  $("file").onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){message("certMsg","Choose an image file such as JPG or PNG.","error");e.target.value="";return;}if(file.size>15*1024*1024){message("certMsg","The image is larger than 15 MB. Choose a smaller image.","error");e.target.value="";return;}stopCamera();showPreview(file);message("certMsg","Image loaded for preview. Review it and complete the certificate details before saving the training record.","success");};
  $("readCertificate").onclick=async()=>{
   const btn=$("readCertificate");if(!certImage){message("ocrMsg","Scan or upload a certificate image first.","error");return;}
   if(!window.Tesseract){message("ocrMsg","Text recognition library did not load. Refresh the page and try again.","error");return;}
   btn.disabled=true;btn.textContent="Reading certificate…";message("ocrMsg","Reading certificate text. This can take a little while on a phone…");
   try{
    const result=await window.Tesseract.recognize(certImage,"eng",{logger:progress=>{
      if(progress&&Number.isFinite(progress.progress)){
       const pct=Math.max(0,Math.min(100,Math.round(progress.progress*100)));
       message("ocrMsg",(progress.status||"Reading certificate").replace(/-/g," ")+"… "+pct+"%");
      }
    }});
    const raw=String(result?.data?.text||"").replace(/\r/g,"\n"), lines=raw.split("\n").map(x=>x.trim()).filter(Boolean), text=lines.join("\n");
    if(text.replace(/\s/g,"").length<8)throw Error("Not enough readable text was found. Try a clearer, brighter image with the full certificate in frame.");
    const set=(id,value)=>{if(value&&$(id)&&!$(id).value)$(id).value=value;};
    const findValue=(labels)=>{for(const line of lines){for(const label of labels){const m=line.match(new RegExp("(?:^|\\b)"+label+"\\s*[:#-]?\\s*(.+)$","i"));if(m&&m[1].trim().length>1)return m[1].trim();}}return "";};
    const dateVal=(input)=>{if(!input)return "";const m=input.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);let y,mo,d;if(m){mo=+m[1];d=+m[2];y=+m[3];if(y<100)y+=y<50?2000:1900;}else{const n=input.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i);if(!n)return "";mo=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(n[1].slice(0,3).toLowerCase())+1;d=+n[2];y=+n[3];}if(!mo||mo>12||!d||d>31)return "";return String(y).padStart(4,"0")+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0");};
    const labeledDate=(labels)=>{for(const line of lines){if(labels.some(x=>new RegExp(x,"i").test(line))){const v=dateVal(line);if(v)return v;const idx=lines.indexOf(line);if(idx>=0&&lines[idx+1]){const next=dateVal(lines[idx+1]);if(next)return next;}}}return "";};
    set("ctitle",findValue(["course(?: name| title)?","training(?: name| title)?","class(?: name| title)?","completed the course","successfully completed"]));
    set("cdate",labeledDate(["completion date","date completed","training date","date of completion","date:","issued on"]));
    set("cexp",labeledDate(["expiration date","expires","valid until","renewal date"]));
    set("clocation",findValue(["location","training site","held at","venue"]));
    set("cinstructor",findValue(["instructor","trainer","instructor name","course director"]));
    set("cclass",findValue(["certificate(?: number| no\.?| #)?","cert(?:ificate)? id","class number","course number","credential id"]));
    const hm=text.match(/\b(\d+(?:\.\d+)?)\s*(?:contact\s*)?hours?\b/i)||text.match(/contact hours?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i);if(hm&&$("chours")&&!$("chours").value)$("chours").value=hm[1];
    const memberOptions=[...$("cmember").options].filter(o=>o.value);const matched=memberOptions.find(o=>o.textContent.trim().length>2&&text.toLowerCase().includes(o.textContent.trim().toLowerCase()));if(matched)$("cmember").value=matched.value;
    message("ocrMsg","Certificate text read. Review every filled field and correct anything inaccurate before saving. The original image will be stored with the record.","success");
    message("certMsg","Automatic reading finished. Verify the training details before saving.","success");
   }catch(err){message("ocrMsg",err?.message||"Could not read this certificate. Try a clearer image or enter the details manually.","error");}
   finally{btn.disabled=false;btn.textContent="Read Certificate & Fill Details";}
  };

  window.addEventListener("pagehide",stopCamera);
    $("printReport").onclick=()=>window.print();$("search").oninput=e=>document.querySelectorAll("#records .record").forEach(n=>n.classList.toggle("hidden",!n.textContent.toLowerCase().includes(e.target.value.toLowerCase())));
  if(/type=recovery|type=invite|type=signup/i.test(location.hash)){const h=document.createElement("div");h.className="modal";h.innerHTML='<div class="modalbox"><h2>Set your password</h2><form id="pwForm"><label class="field">New password<input id="pw" type="password" minlength="12" required></label><button class="primary">Save Password</button><p id="pwMsg"></p></form></div>';document.body.append(h);$("pwForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.updateUser({password:$("pw").value});message("pwMsg",error?error.message:"Password updated.",error?"error":"success");if(!error)history.replaceState(null,"",location.pathname)}}
 }
 async function safeInit(){try{await init()}catch(e){console.error("Firefighter portal startup error:",e);const n=document.getElementById("loginMsg");if(n){n.textContent="The portal could not finish loading: "+(e?.message||"Unknown error")+". Please refresh and try again.";n.className="message error"}const b=document.getElementById("loginBtn");if(b)b.disabled=false}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",safeInit,{once:true});else safeInit();

  // Global capture handler keeps member certificate actions working even if the member history is re-rendered.
  document.addEventListener("click",async event=>{
    const view=event.target.closest?.("button[data-member-view-cert]");
    const print=event.target.closest?.("button[data-member-print-cert]");
    const button=view||print;
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const recordId=button.getAttribute(view?"data-member-view-cert":"data-member-print-cert");
    button.disabled=true;
    try{
      const {data:record,error}=await db.from("training_records").select("id,member_id,certificate_path,training_name").eq("id",recordId).maybeSingle();
      if(error)throw error;
      if(!record)throw Error("Training record not found. Refresh the page and sign in again.");
      if(!user||record.member_id!==user.id)throw Error("This certificate is not assigned to the signed-in member.");
      if(!record.certificate_path)throw Error("No certificate image is attached to this training record.");
      await memberCertificateForMember(record.certificate_path,!!print);
    }catch(error){
      alert("Certificate action failed: "+(error?.message||String(error)));
    }finally{
      button.disabled=false;
    }
  },true);

  document.addEventListener("click",async event=>{
    const edit=event.target.closest?.("[data-edit-cert]");
    if(!edit)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      const {data:r,error}=await db.from("training_records").select("*").eq("id",edit.getAttribute("data-edit-cert")).maybeSingle();
      if(error)throw error;
      if(!r)throw Error("Training record was not found. Refresh the page and try again.");
      editingCertId=r.id;
      const fields={cmember:r.member_id,ctitle:r.training_name,cdate:r.training_date,cexp:r.expiration_date,clocation:r.location,cinstructor:r.instructor,chours:r.hours,cclass:r.class_number};
      for(const [id,value] of Object.entries(fields)){const field=$(id);if(field)field.value=value??"";}
      if($("crequired"))$("crequired").checked=!!r.satisfies_requirement;
      certImage=null;
      const preview=$("preview");
      if(preview){if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);preview.removeAttribute("src");preview.classList.add("hidden");delete preview.dataset.objectUrl;}
      const submit=$("certForm")?.querySelector('[type="submit"]');
      if(submit)submit.textContent="Save Certificate Changes";
      message("certMsg","Editing certificate: "+(r.training_name||"Training record"),"info");
      const tab=document.querySelector('.tab[data-tab="scan"]');if(tab)tab.click();
      $("scan")?.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){alert("Unable to open certificate for editing: "+(error?.message||error));}
  },true);
})();