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
   const normalizeName=name=>String(name??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
   const merged=new Map();
   for(const m of members){const key=normalizeName(m.name);const item=merged.get(key);if(item){if(!item.folderIds.includes(m.id))item.folderIds.push(m.id);}else merged.set(key,{name:m.name,folderIds:[m.id],profileIds:[]});}
   for(const p of profileMembers){const key=normalizeName(p.name);const item=merged.get(key);if(item){if(!item.profileIds.includes(p.id))item.profileIds.push(p.id);}else merged.set(key,{name:p.name,folderIds:[],profileIds:[p.id]});}
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
   for(const cls of classes)rows.push([cls,...roster.map(m=>m.folderIds.some(id=>done.has("file:"+id+"|"+cls))||m.profileIds.some(id=>done.has("profile:"+id+"|"+cls))?"X":"")]);
   if(!window.XLSX)throw new Error("Excel export library did not load. Refresh the page and try again.");
   const workbook=window.XLSX.utils.book_new();
   const worksheet=window.XLSX.utils.aoa_to_sheet(rows);
   worksheet["!cols"]=[{wch:30},...roster.map(m=>({wch:Math.max(14,Math.min(28,m.name.length+2))}))];
   worksheet["!freeze"]={xSplit:1,ySplit:1,topLeftCell:"B2",activePane:"bottomRight",state:"frozen"};
   worksheet["!autofilter"]={ref:window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};
   window.XLSX.utils.book_append_sheet(workbook,worksheet,"Class Matrix");
   window.XLSX.writeFile(workbook,"firefighter-class-matrix.xlsx",{compression:true});
  }catch(e){console.error("Class Matrix:",e);alert("Class Matrix error: "+(e?.message||String(e)));}finally{if(button)button.disabled=false;}
 }
 function attach(){const b=$("downloadClassMatrix");if(!b)return false;if(b.dataset.matrixFix==="1")return true;b.dataset.matrixFix="1";b.onclick=run;return true;}
 if(!attach())document.addEventListener("DOMContentLoaded",attach,{once:true});
})();