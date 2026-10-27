(()=>{
  const $=id=>document.getElementById(id);
  let db=null, recordsCache=null, loading=null;
  const cfg=window.FIRE_PORTAL_CONFIG||{};
  const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>db||(db=window.supabase?.createClient?.(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  function styles(){
    if($('fastMemberProfileStyles'))return;
    const s=document.createElement('style');s.id='fastMemberProfileStyles';s.textContent=`
      #fastMemberProfile{position:fixed;inset:0;z-index:100000;background:rgba(2,8,18,.82);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .16s ease}
      #fastMemberProfile.open{opacity:1}
      #fastMemberProfile .fast-profile-box{width:min(900px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(145deg,#0d2138,#071321);border:1px solid rgba(103,180,255,.28);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.55);color:#eef6ff}
      #fastMemberProfile .fast-profile-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;background:rgba(7,17,31,.94);border-bottom:1px solid rgba(103,180,255,.18);backdrop-filter:blur(12px)}
      #fastMemberProfile h2{margin:0;font-size:clamp(1.25rem,4vw,1.8rem)}
      #fastMemberProfile .fast-close{border:0;border-radius:12px;padding:9px 13px;background:#321722;color:#ffc0c9;font-weight:800;font-size:1rem;cursor:pointer}
      #fastMemberProfile .fast-body{padding:22px}.fast-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.fast-profile-stat,.fast-profile-record{border:1px solid rgba(103,180,255,.18);background:rgba(9,28,48,.68);border-radius:17px;padding:16px}.fast-profile-stat span{display:block;color:#91aac4;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}.fast-profile-stat b{display:block;margin-top:5px;font-size:1.2rem}.fast-profile-record h3{margin:0 0 7px;font-size:1rem}.fast-profile-record p{margin:4px 0;color:#a9bdd0}.fast-profile-empty,.fast-profile-loading{padding:18px;text-align:center;color:#a9bdd0}.fast-profile-status{font-weight:800}.fast-profile-status.active{color:#83e6a6}.fast-profile-status.inactive{color:#ff9baa}@media(max-width:650px){.fast-profile-grid{grid-template-columns:1fr}.fast-profile-head{padding:16px}.fast-profile-body{padding:16px}}
    `;document.head.appendChild(s);
  }
  function close(){const m=$('fastMemberProfile');if(!m)return;m.classList.remove('open');setTimeout(()=>m.remove(),170)}
  function ensureModal(member){
    styles();close();
    const m=document.createElement('div');m.id='fastMemberProfile';m.innerHTML=`<div class="fast-profile-box" role="dialog" aria-modal="true" aria-labelledby="fastMemberTitle"><div class="fast-profile-head"><div><h2 id="fastMemberTitle">${esc(member.name)}</h2><div class="fast-profile-status ${member.active?'active':'inactive'}">${member.active?'● Active':'● Inactive'}</div></div><button class="fast-close" type="button" aria-label="Close profile">Close</button></div><div class="fast-body"><div class="fast-profile-grid"><div class="fast-profile-stat"><span>Account Type</span><b>${esc(member.role==='admin'?'Administrator':'Firefighter')}</b></div><div class="fast-profile-stat"><span>Training Records</span><b id="fastProfileCount">Loading…</b></div></div><h3 style="margin:24px 0 10px">Training History</h3><div id="fastProfileRecords" class="fast-profile-loading">Opening profile…</div></div></div>`;
    document.body.appendChild(m);m.querySelector('.fast-close').onclick=close;m.addEventListener('click',e=>{if(e.target===m)close()});requestAnimationFrame(()=>m.classList.add('open'));return m;
  }
  async function getRecords(){
    if(recordsCache)return recordsCache;
    if(loading)return loading;
    loading=client().from('training_records').select('id,member_id,training_name,training_date,location,instructor,hours,expiration_date').then(({data,error})=>{if(error)throw error;recordsCache=data||[];return recordsCache}).finally(()=>{loading=null});
    return loading;
  }
  async function openProfile(card){
    const id=card.getAttribute('data-member');if(!id)return;
    const name=card.querySelector('h3')?.textContent?.trim()||'Member Profile';
    const statusText=card.querySelector('p')?.textContent||'';
    const member={id,name,active:/Active/.test(statusText),role:/admin/i.test(statusText)?'admin':'firefighter'};
    const modal=ensureModal(member);const list=$('fastProfileRecords');
    try{
      const rows=(await getRecords()).filter(r=>String(r.member_id)===String(id)).sort((a,b)=>String(b.training_date||'').localeCompare(String(a.training_date||'')));
      $('fastProfileCount').textContent=String(rows.length);
      if(!rows.length){list.className='fast-profile-empty';list.textContent='No training records are attached to this member yet.';return;}
      list.className='';list.innerHTML=rows.map(r=>`<article class="fast-profile-record"><h3>${esc(r.training_name||'Training')}</h3><p>${esc(r.training_date||'No date')} · ${Number(r.hours||0)} hours</p><p>${esc(r.location||'No location')}${r.instructor?' · '+esc(r.instructor):''}</p></article>`).join('');
    }catch(e){$('fastProfileCount').textContent='—';list.className='fast-profile-empty';list.textContent='The profile opened, but training history could not be loaded. '+(e?.message||'');}
  }
  function start(){
    if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient)return;
    document.addEventListener('click',e=>{const card=e.target.closest?.('#memberCards [data-member]');if(!card)return;if(e.target.closest('button'))return;e.preventDefault();openProfile(card)},true);
    const watch=new MutationObserver(()=>{document.querySelectorAll('#memberCards [data-member]').forEach(card=>{if(card.dataset.profileReady==='1')return;card.dataset.profileReady='1';card.style.cursor='pointer';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.title='Open member profile';card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();openProfile(card)}})})});
    watch.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
