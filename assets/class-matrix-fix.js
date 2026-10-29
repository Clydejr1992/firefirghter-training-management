/* Isolated repair for Class Matrix headings and iOS Safari display. */
(()=>{
 const $=id=>document.getElementById(id);
 const text=v=>{
  if(typeof v==="string"||typeof v==="number")return String(v).trim();
  if(v&&typeof v==="object"){for(const k of ["full_name","fullName","display_name","displayName","name","label","email","value","text"]){const x=v[k];if(typeof x==="string"||typeof x==="number"){const s=String(x).trim();if(s&&s!=="[object Object]")return s;}}}
  return "";
 };
 const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
 async function run(){
  const button=$("downloadClassMatrix");if(button)button.disabled=true;
  try{
   const c=window.FIRE_PORTAL_CONFIG;
   if(!window.supabase||!c?.url||!c?.anonKey)throw new Error("Supabase configuration is unavailable.");
   const db=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const [{data:files,error:fe},{data:entries,error:ee},{data:profiles,error:pe},{data:profileEntries,error:pre}]=await Promise.all([
    db.from("training_files").select("id,full_name").order("full_name"),
    db.from("training_file_records").select("training_file_id,training_name"),
    db.from("firefighter_profiles").select("id,full_name,role,active").eq("role","firefighter").eq("active",true),
    db.from("training_records").select("member_id,training_name")
   ]);
   if(fe)throw fe;if(ee)throw ee;if(pe)throw pe;if(pre)throw pre;
   const members=(files||[]).map(x=>({id:String(x.id??""),name:text(x.full_name)})).filter(x=>x.id&&x.name);
   const profileMembers=(profiles||[]).map(x=>({id:String(x.id??""),name:text(x.full_name)})).filter(x=>x.id&&x.name);
   // Merge folder-based members and profile-based firefighters, including C. Ramey.
   const merged=new Map();
   for(const m of members)merged.set(m.name.toLowerCase(),{name:m.name,folderId:m.id,profileId:""});
   for(const p of profileMembers){const key=p.name.toLowerCase();const item=merged.get(key);if(item)item.profileId=p.id;else merged.set(key,{name:p.name,folderId:"",profileId:p.id});}
   const roster=[...merged.values()].sort((a,b)=>a.name.localeCompare(b.name));
   const entriesByMember=(entries||[]).map(x=>({memberId:String(x.training_file_id??""),training:text(x.training_name)})).filter(x=>x.memberId&&x.training);
   const profileByMember=(profileEntries||[]).map(x=>({memberId:String(x.member_id??""),training:text(x.training_name)})).filter(x=>x.memberId&&x.training);
   const classes=[...new Set([...entriesByMember,...profileByMember].map(x=>x.training))].sort((a,b)=>a.localeCompare(b));
   if(!roster.length)throw new Error("No named firefighter records were returned from Supabase.");
   if(!classes.length)throw new Error("No training records were returned.");
   const done=new Set();
   for(const e of entriesByMember)done.add("file:"+e.memberId+"|"+e.training);
   for(const e of profileByMember)done.add("profile:"+e.memberId+"|"+e.training);
   const rows=[["Training / Certificate",...roster.map(x=>x.name)]];
   for(const cls of classes)rows.push([cls,...roster.map(m=>(m.folderId&&done.has("file:"+m.folderId+"|"+cls))||(m.profileId&&done.has("profile:"+m.profileId+"|"+cls))?"X":"")]);
   const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
   if(ios){
    const w=window.open("","_blank");if(!w)throw new Error("Safari blocked the matrix window. Allow pop-ups for whtraining.tech.");
    const table=rows.map((row,i)=>"<tr>"+row.map(v=>i===0?"<th>"+esc(v)+"</th>":"<td>"+esc(v)+"</td>").join("")+"</tr>").join("");
    w.document.open();w.document.write("<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Firefighter Class Matrix</title><style>body{font:14px -apple-system,sans-serif;margin:12px}.wrap{overflow:auto;max-height:85vh}table{border-collapse:collapse;white-space:nowrap}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#eee;position:sticky;top:0}button{padding:10px;margin-bottom:12px}</style></head><body><h2>Firefighter Class Matrix</h2><p>"+members.length+" firefighters; "+classes.length+" training types</p><button onclick=\"window.print()\">Print / Save PDF</button><div class=\"wrap\"><table>"+table+"</table></div></body></html>");w.document.close();
   }else{
    const csv=rows.map(row=>row.map(v=>"\""+String(v??"").replace(/"/g,"\"\"")+"\"").join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="firefighter-class-matrix.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }
  }catch(e){console.error("Class Matrix:",e);alert("Class Matrix error: "+(e?.message||String(e)));}finally{if(button)button.disabled=false;}
 }
 function attach(){const b=$("downloadClassMatrix");if(!b)return false;if(b.dataset.matrixFix==="1")return true;b.dataset.matrixFix="1";b.onclick=run;return true;}
 if(!attach())document.addEventListener("DOMContentLoaded",attach,{once:true});
})();