(() => {
  const $ = id => document.getElementById(id);
  const gate = $('authGate'), app = $('adminApp'), status = $('authStatus');
  let supabase = null;
  if (window.archiveBackendReady?.() && window.supabase?.createClient) {
    const c = window.ARCHIVE_BACKEND;
    supabase = window.archiveSupabase = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    $('backendSetupHint').textContent = 'Backend configured. Sign in using the admin user created in Supabase Authentication.';
  } else {
    $('backendSetupHint').textContent = 'Setup required: create a Supabase project, run supabase-schema.sql, then fill in backend-config.js with the project URL and anon key.';
  }
  function showApp(user) {
    gate.hidden = true; app.hidden = false;
    const email = document.getElementById('adminEmail');
    if (email && user?.email) email.value = user.email;
    const cloud = $('cloudStatus'); if (cloud) cloud.textContent = 'Authenticated · shared database';
    window.dispatchEvent(new CustomEvent('archive-auth-ready', { detail: { user, supabase } }));
  }
  $('adminLoginForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!supabase) { status.textContent = 'Backend is not configured yet. Follow the setup steps in README.md.'; return; }
    status.textContent = 'Signing in…';
    const { data, error } = await supabase.auth.signInWithPassword({ email: $('adminEmail').value.trim(), password: $('adminPassword').value });
    if (error) { status.textContent = 'Sign-in failed. Check the email/password and Supabase Auth settings.'; return; }
    $('adminPassword').value = ''; showApp(data.user);
  });
  $('adminSignOut')?.addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); app.hidden = true; gate.hidden = false; status.textContent = 'Signed out.'; });
  if (supabase) supabase.auth.getSession().then(({ data }) => { if (data.session) showApp(data.session.user); });
})();

/* Admin content editor and local collection tools. */

(() => {
  const KEYS = { songs: 'biggestFanArchiveSongs', thoughts: 'biggestFanArchiveThoughts', guestbook: 'biggestFanArchiveNotes' };
  const $ = id => document.getElementById(id);
  const safeRead = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  let songs = safeRead(KEYS.songs).filter(x => x && typeof x.embed === 'string');
  let thoughts = safeRead(KEYS.thoughts).filter(x => x && typeof x.text === 'string');
  let guestbook = safeRead(KEYS.guestbook).filter(x => x && typeof x.message === 'string');
  if (!guestbook.length) guestbook = safeRead('biggestFanArchiveGuestbook').filter(x => x && typeof x.message === 'string');
  let editingThoughtId = null;

  function parseLink(raw) {
    let url; try { url = new URL(raw); } catch (_) { return null; }
    const host = url.hostname.replace(/^www\./,'').replace(/^m\./,'');
    if (host === 'open.spotify.com') {
      const parts = url.pathname.split('/').filter(Boolean); if (parts[0] === 'embed') parts.shift();
      const type = parts[0], id = parts[1];
      if (!['track','album','playlist','artist','episode','show'].includes(type) || !id) return null;
      return {kind:'spotify',embed:`https://open.spotify.com/embed/${type}/${encodeURIComponent(id)}`,title:`Spotify ${type}`,original:url.href};
    }
    if (['youtube.com','music.youtube.com','m.youtube.com'].includes(host) || host === 'youtu.be') {
      let id='', list=url.searchParams.get('list');
      if(host==='youtu.be') id=url.pathname.split('/').filter(Boolean)[0]||'';
      else if(url.pathname==='/watch') id=url.searchParams.get('v')||'';
      else if(/^\/(shorts|embed|live)\//.test(url.pathname)) id=url.pathname.split('/')[2]||'';
      if(id){const p=new URLSearchParams({rel:'0',playsinline:'1'});if(url.searchParams.get('t'))p.set('start',String(parseInt(url.searchParams.get('t'),10)||0));if(list)p.set('list',list);return {kind:'youtube',embed:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${p}`,title:'YouTube video',original:url.href};}
      if(url.pathname==='/playlist'&&list)return {kind:'youtube',embed:`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`,title:'YouTube playlist',original:url.href};
    }
    return null;
  }
  function makeButton(label, action, danger=false, accessibleLabel=label) {
    const b=document.createElement('button');b.type='button';b.className='small-action'+(danger?' danger':'');b.textContent=label;b.setAttribute('aria-label',accessibleLabel);b.addEventListener('click',action);return b;
  }
  function renderSongs() {
    const root=$('adminSongList');root.replaceChildren();
    $('songStat').textContent=songs.length;
    if(!songs.length){const e=document.createElement('div');e.className='admin-empty';e.textContent='No songs added yet. Start with the one that reminds you of him most.';root.append(e);return;}
    songs.forEach((song,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=song.label||song.title||'Untitled song';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=(song.kind||'link').toUpperCase()+' · EMBED READY';main.append(title,meta);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('↑',()=>moveSong(i,-1),false,'Move '+(song.label||song.title||'song')+' up'),makeButton('↓',()=>moveSong(i,1),false,'Move '+(song.label||song.title||'song')+' down'),makeButton('Remove',()=>{songs.splice(i,1);persistSongs();renderSongs();},true));row.append(main,actions);root.append(row);});
  }
  function moveSong(i,dir){const j=i+dir;if(j<0||j>=songs.length)return;[songs[i],songs[j]]=[songs[j],songs[i]];persistSongs();renderSongs();}
  async function persistSharedCollections(){
    safeWrite(KEYS.songs,songs); safeWrite(KEYS.thoughts,thoughts);
    const db=window.archiveSupabase;
    if(!db){return false;}
    try {
      const {data,error:readError}=await db.from('archive_content').select('content').eq('id',true).single();
      if(readError) throw readError;
      const content={...(data?.content||{}),songs,thoughts};
      const {data:userData}=await db.auth.getUser();
      const {error}=await db.from('archive_content').update({content,updated_at:new Date().toISOString(),updated_by:userData.user?.id}).eq('id',true);
      if(error) throw error;
      window.dispatchEvent(new CustomEvent('archive-collections-saved',{detail:{songs,thoughts}}));
      return true;
    } catch(err) { console.error('Shared songs/thoughts save failed:',err); return false; }
  }
  function persistSongs(){
    safeWrite(KEYS.songs,songs);
    persistSharedCollections().then(ok=>{const status=$('adminSongStatus');if(status)status.textContent=ok?'Saved and published for all visitors.':'Saved locally, but shared publishing failed. Check Supabase permissions.';});
  }
  async function loadSharedCollections(){
    const db=window.archiveSupabase;if(!db)return;
    try {
      const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();
      if(error)throw error;
      const content=data?.content||{};
      if(Array.isArray(content.songs)) songs=content.songs.filter(x=>x&&typeof x.embed==='string').slice(0,15);
      else if(songs.length){ await persistSharedCollections(); }
      if(Array.isArray(content.thoughts)) thoughts=content.thoughts.filter(x=>x&&typeof x.text==='string').slice(0,50);
      else if(thoughts.length){ await persistSharedCollections(); }
      safeWrite(KEYS.songs,songs);safeWrite(KEYS.thoughts,thoughts);refreshAll();
      const ss=$('adminSongStatus');if(ss)ss.textContent='Connected to shared archive.';
    } catch(err){console.error(err);const ss=$('adminSongStatus');if(ss)ss.textContent='Could not load shared songs/thoughts. Check Supabase policies.';}
  }
  window.addEventListener('archive-content-loaded',()=>loadSharedCollections(),{once:true});
  $('adminSongForm').addEventListener('submit',e=>{e.preventDefault();const parsed=parseLink($('adminSongLink').value.trim());const status=$('adminSongStatus');if(!parsed){status.textContent='Use a full Spotify URL or a YouTube video/playlist URL.';return;}if(songs.some(s=>s.embed===parsed.embed)){status.textContent='That song is already in the soundtrack.';return;}parsed.label=$('adminSongLabel').value.trim()||parsed.title;parsed.addedAt=Date.now();songs.unshift(parsed);songs=songs.slice(0,15);persistSongs();renderSongs();e.target.reset();status.textContent='Publishing…';});

  function renderThoughts(){
    const root=$('adminThoughtList');root.replaceChildren();$('thoughtStat').textContent=thoughts.length;
    if(!thoughts.length){const e=document.createElement('div');e.className='admin-empty';e.textContent='No notes yet. Add an observation to the collection.';root.append(e);return;}
    thoughts.forEach(t=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=new Date(t.at||Date.now()).toLocaleDateString();const body=document.createElement('div');body.className='admin-item-text';body.textContent=t.text;main.append(meta,body);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Edit',()=>startEdit(t)),makeButton('Delete',()=>{thoughts=thoughts.filter(x=>x.id!==t.id);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Published for all visitors. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();},true));row.append(main,actions);root.append(row);});
  }
  function startEdit(t){editingThoughtId=t.id;$('adminThoughtText').value=t.text;$('editMode').textContent='EDITING NOTE';$('saveThoughtButton').innerHTML='Update thought <span>↗</span>';$('cancelEdit').hidden=false;$('adminThoughtText').focus();}
  function resetEdit() {editingThoughtId=null;$('adminThoughtForm').reset();$('editMode').textContent='NEW NOTE';$('saveThoughtButton').innerHTML='Save thought <span>↗</span>';$('cancelEdit').hidden=true;}
  $('cancelEdit').addEventListener('click',resetEdit);
  $('adminThoughtForm').addEventListener('submit',e=>{e.preventDefault();const text=$('adminThoughtText').value.trim();const status=$('adminThoughtStatus');if(!text){status.textContent='Write something before saving.';return;}if(editingThoughtId){const t=thoughts.find(x=>x.id===editingThoughtId);if(t)t.text=text;}else{thoughts.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text,at:Date.now()});}thoughts=thoughts.slice(0,50);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Published for all visitors. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();resetEdit();status.textContent='Publishing note…';});

  function renderGuestbook(){const root=$('adminGuestList');root.replaceChildren();$('guestStat').textContent=guestbook.length;if(!guestbook.length){const e=document.createElement('div');e.className='admin-empty';e.textContent='No locally saved guestbook messages found.';root.append(e);return;}guestbook.forEach((g,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=g.name||'Anonymous';const msg=document.createElement('div');msg.className='admin-item-text';msg.textContent=g.message;main.append(title,msg);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Delete',()=>{guestbook.splice(i,1);safeWrite(KEYS.guestbook,guestbook);renderGuestbook();},true));row.append(main,actions);root.append(row);});}
  function refreshAll(){renderSongs();renderThoughts();renderGuestbook();}
  refreshAll();

  function attachListFilter(inputId, listId, countId, statusId) {
    const input=$(inputId), root=$(listId), count=$(countId), statusFilter=statusId?$(statusId):null;
    if(!input||!root||!count)return;
    const apply=()=>{
      const query=input.value.trim().toLocaleLowerCase();
      const status=statusFilter?.value||'all';
      const rows=[...root.querySelectorAll('.admin-item')];let visible=0;
      rows.forEach(row=>{
        const text=row.textContent.toLocaleLowerCase();
        const matchesText=!query||text.includes(query);
        const matchesStatus=status==='all'||(status==='pending'?text.includes('pending'):text.includes('published'));
        row.hidden=!(matchesText&&matchesStatus);if(!row.hidden)visible++;
      });
      const empty=root.querySelector('.admin-empty');if(empty)empty.hidden=Boolean(query||status!=='all');
      count.textContent=(query||status!=='all')?`${visible} of ${rows.length} ${rows.length===1?'item':'items'} shown`:`${rows.length} ${rows.length===1?'item':'items'}`;
    };
    input.addEventListener('input',apply);statusFilter?.addEventListener('change',apply);
    new MutationObserver(apply).observe(root,{childList:true,subtree:true});apply();
  }
  attachListFilter('songSearch','adminSongList','songSearchCount');
  attachListFilter('thoughtSearch','adminThoughtList','thoughtSearchCount');
  attachListFilter('guestSearch','adminGuestList','guestSearchCount','guestStatusFilter');

  ['heroTitle','heroSubtitle','heroDescription','adminThoughtText'].forEach(id=>{
    const field=$(id);if(!field)return;
    const counter=document.createElement('span');counter.className='character-count';counter.id=id+'Count';counter.setAttribute('aria-live','off');
    field.setAttribute('aria-describedby',counter.id);field.insertAdjacentElement('afterend',counter);
    const update=()=>{counter.textContent=`${field.value.length} / ${field.maxLength} characters`;};
    field.addEventListener('input',update);update();
  });

  const VISUAL_KEY = 'biggestFanArchiveVisuals';
  const visualDefaults = {theme:'editorial',layout:'left',accent:'#2456d7',background:'#f4f7fb',text:'#111827',title:'רואי',subtitle:'A study of ordinary days.',description:'Light shifts across familiar places. A song returns with the weather.',image:''};
  let visuals = {...visualDefaults};
  try { visuals = {...visualDefaults, ...JSON.parse(localStorage.getItem(VISUAL_KEY) || '{}')}; } catch (_) {}
  if(visuals.accent==='#778173')visuals.accent='#2456d7';if(visuals.background==='#f4f1ea')visuals.background='#f4f7fb';if(visuals.text==='#292a27')visuals.text='#111827';
  const visualEls = {theme:'themePreset',layout:'layoutPreset',accent:'accentColor',background:'backgroundColor',text:'textColor',title:'heroTitle',subtitle:'heroSubtitle',description:'heroDescription',image:'heroImageUrl'};
  function applyVisuals(v) {
    const body=document.body;
    body.dataset.theme=v.theme==='noir'?'noir':v.theme;
    body.dataset.layout=v.layout||'center';
    const root=document.documentElement;
    root.style.setProperty('--rose',v.accent||visualDefaults.accent);
    root.style.setProperty('--paper',v.background||visualDefaults.background);
    root.style.setProperty('--ink',v.text||visualDefaults.text);
    const title=document.querySelector('.hero h1');
    if(title){title.textContent=v.title||'רואי';title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title||'')?'he':'en');}
    const subtitle=document.querySelector('.hero-subtitle');
    if(subtitle)subtitle.textContent=v.subtitle||'';
    const description=document.querySelector('.hero-description');
    if(description)description.textContent=v.description||'';
    const image=document.querySelector('.hero-image');
    if(image){image.style.backgroundImage=v.image?`linear-gradient(90deg,#0007,transparent),url("${v.image.replace(/"/g,'%22')}")`:'';image.style.backgroundSize=v.image?'cover':'';image.style.backgroundPosition='center';}
    const logo=document.querySelector('.logo [lang="he"]'); if(logo)logo.textContent=v.title||'רואי';
    const titleTag=document.querySelector('title');if(titleTag)titleTag.textContent=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function readVisualInputs(){
    return {theme:$('themePreset').value,layout:$('layoutPreset').value,accent:$('accentColor').value,background:$('backgroundColor').value,text:$('textColor').value,title:$('heroTitle').value.trim()||'רואי',subtitle:$('heroSubtitle').value.trim(),description:$('heroDescription').value.trim(),image:$('heroImageUrl').value.trim()};
  }
  function fillVisualInputs(){
    Object.entries(visualEls).forEach(([key,id])=>{if($(id))$(id).value=visuals[key]||visualDefaults[key]||'';});
    updateImagePreview();
  }
  function updateImagePreview(){
    const preview=$('heroImagePreview');if(!preview)return;
    if(visuals.image){preview.style.backgroundImage=`url("${visuals.image.replace(/"/g,'%22')}")`;preview.textContent='';}
    else {preview.style.backgroundImage='';preview.textContent='Illustrated sky background';}
  }
  Object.values(visualEls).forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>{visuals=readVisualInputs();applyVisuals(visuals);if(id==='heroImageUrl')updateImagePreview();});el.addEventListener('change',()=>{visuals=readVisualInputs();applyVisuals(visuals);});}});

  function colorLuminance(hex){
    const parts=(hex.match(/[0-9a-f]{2}/ig)||[]).map(v=>parseInt(v,16)/255);
    if(parts.length!==3)return 0;
    const linear=parts.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  }
  function updateContrastStatus(){
    const output=$('contrastStatus');if(!output)return;
    const bg=colorLuminance($('backgroundColor').value),fg=colorLuminance($('textColor').value),accent=colorLuminance($('accentColor').value);
    const ratio=(a,b)=>{const hi=Math.max(a,b),lo=Math.min(a,b);return (hi+.05)/(lo+.05);};
    const textRatio=ratio(bg,fg),accentRatio=ratio(bg,accent);
    output.textContent=`Text/background contrast ${textRatio.toFixed(1)}:1 ${textRatio>=4.5?'meets':'below'} WCAG AA for normal text. Accent/background ${accentRatio.toFixed(1)}:1 ${accentRatio>=3?'meets':'below'} the 3:1 UI target.`;
    output.classList.toggle('contrast-warning',textRatio<4.5||accentRatio<3);
  }
  fillVisualInputs();applyVisuals(visuals);updateContrastStatus();
  function syncVisualEditor(content){
    visuals={...visualDefaults,...(content||{})};
    fillVisualInputs();applyVisuals(visuals);updateContrastStatus();updateImagePreview();
  }
  window.addEventListener('archive-content-loaded',event=>syncVisualEditor(event.detail?.content));
  window.addEventListener('archive-visual-settings-changed',event=>syncVisualEditor(event.detail));
  ['accentColor','backgroundColor','textColor'].forEach(id=>$(id)?.addEventListener('input',updateContrastStatus));


  $('exportBackup').addEventListener('click',()=>{
    const sharedContent=window.archiveGetPublishedContent?.();
    if(!sharedContent){$('backupStatus').textContent='Wait for shared content to load before exporting a complete backup.';return;}
    const backup={app:'biggest-fan-archive',formatVersion:2,exportedAt:new Date().toISOString(),content:sharedContent,localFallback:{guestbook}};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='biggest-fan-archive-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='Published content and collections exported. Visitor submissions are excluded.';
  });
  $('importBackup').addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!data||data.app!=='biggest-fan-archive')throw new Error('This is not a Biggest Fan Archive backup.');
      const content=data.content&&typeof data.content==='object'?data.content:{songs:data.songs,thoughts:data.thoughts};
      if(!Array.isArray(content.songs)||!Array.isArray(content.thoughts))throw new Error('The backup is missing its songs or reminders.');
      const importedSongs=content.songs.filter(x=>x&&typeof x.embed==='string').slice(0,15);
      const importedThoughts=content.thoughts.filter(x=>x&&typeof x.text==='string').slice(0,50);
      const local=data.localFallback?.guestbook??data.guestbook;
      const importedGuestbook=Array.isArray(local)?local.filter(x=>x&&typeof x.message==='string').slice(0,20):[];
      if(!confirm('Restore this backup? Published page content, songs, and reminders will be replaced in the shared archive. Local fallback guestbook notes on this device will also be replaced.'))return;
      const current=window.archiveGetPublishedContent?.();
      if(!current)throw new Error('Wait for shared content to load before importing a backup.');
      await window.archiveRestorePublishedContent({...current,...(data.content||{}),songs:importedSongs,thoughts:importedThoughts});
      songs=importedSongs;thoughts=importedThoughts;guestbook=importedGuestbook;
      safeWrite(KEYS.songs,songs);safeWrite(KEYS.thoughts,thoughts);safeWrite(KEYS.guestbook,guestbook);refreshAll();
      $('backupStatus').textContent='Shared page content and collections restored. Local fallback notes were restored on this device.';
    }catch(err){$('backupStatus').textContent=err.message||'Could not read that backup.';}
    finally{e.target.value='';}
  });
})();

/* Shared Supabase content and moderation integration. */

(() => {
  const $ = id => document.getElementById(id);
  let db, cloud = {}, contentLoaded = false;
  const defaults = {
    songs:[],thoughts:[],
    navAbout:'About', navMoments:'Journal', navNotes:'Notes', navGuestbook:'Contact',
    aboutHeading:'A record of ordinary days.', aboutLead:'Everyday life leaves its marks in unexpected places.',
    blogPosts:[],
    aboutBody:"This archive gathers photographs, music, and brief notes from shared places and familiar routines.\n\nSome days return as a particular light through a window; others arrive by way of a song heard again years later.\n\nA collection still in progress.",
    momentsHeading:'Photo journal.', momentsIntro:'Images, captions, and dates. One entry at a time.',
    qualities:['places','people','sound','observations','details'],
    footerText:'A personal archive of photographs, music, and notes.',
    theme:'editorial',layout:'left',accent:'#2456d7',background:'#f4f7fb',text:'#111827'
  };
  function validPostUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function normalizeContent(value={}){
    const next={...defaults,...(value||{})};
    if(!Array.isArray(value?.blogPosts))next.blogPosts=(value?.galleryImages||[]).map((image,index)=>({id:`legacy-${index}`,image,path:'',caption:value?.galleryCaptions?.[index]||'From the archive',date:''})).filter(post=>validPostUrl(post.image));
    if(!value?.accent||value.accent==='#778173')next.accent='#2456d7';
    if(!value?.background||value.background==='#f4f1ea')next.background='#f4f7fb';
    if(!value?.text||value.text==='#292a27')next.text='#111827';
    if(!value?.navMoments||['Work','Moments'].includes(value.navMoments))next.navMoments='Journal';
    if(!value?.momentsHeading||value.momentsHeading==='Selected frames.')next.momentsHeading='Photo journal.';
    if(!value?.momentsIntro||value.momentsIntro==='Photographs and fragments from the archive.')next.momentsIntro='Images, captions, and dates. One entry at a time.';
    delete next.galleryImages;delete next.galleryCaptions;delete next.notes;
    return next;
  }
  function setVal(id, value) { const el=$(id); if (el && value !== undefined) el.value = value; }
  function fillFields(data) {
    cloud = normalizeContent(data || {});
    Object.keys(cloud).forEach(k => {
      const el = document.querySelector(`[data-content="${k}"]`); if (!el) return;
      const v=cloud[k]; el.value = Array.isArray(v) ? (k==='notes' ? JSON.stringify(v,null,2) : v.join('\n')) : String(v ?? '');
    });
    if ($('themePreset')) setVal('themePreset', cloud.theme || 'editorial');
    if ($('layoutPreset')) setVal('layoutPreset', cloud.layout || 'center');
    if ($('accentColor')) setVal('accentColor', cloud.accent || '#2456d7');
    if ($('backgroundColor')) setVal('backgroundColor', cloud.background || '#f4f7fb');
    if ($('textColor')) setVal('textColor', cloud.text || '#111827');
    setVal('heroTitle', cloud.title || 'רואי'); setVal('heroSubtitle', cloud.subtitle || 'A study of ordinary days.'); setVal('heroDescription', cloud.description || 'Light shifts across familiar places. A song returns with the weather.'); setVal('heroImageUrl', cloud.image || '');
    renderAdminPhotoPosts(cloud.blogPosts);
  }
  function readFields() {
    const result={...cloud};
    document.querySelectorAll('[data-content]').forEach(el => {
      const k=el.dataset.content;
      if(k==='qualities') result[k]=el.value.split('\n').map(x=>x.trim()).filter(Boolean);
      else result[k]=el.value;
    });
    result.blogPosts=cloud.blogPosts||[];delete result.galleryImages;delete result.galleryCaptions;delete result.notes;
    result.theme=$('themePreset')?.value || 'editorial'; result.layout=$('layoutPreset')?.value || 'left';
    result.accent=$('accentColor')?.value || '#2456d7'; result.background=$('backgroundColor')?.value || '#f4f7fb'; result.text=$('textColor')?.value || '#111827';
    result.title=$('heroTitle')?.value || 'רואי'; result.subtitle=$('heroSubtitle')?.value || ''; result.description=$('heroDescription')?.value || ''; result.image=$('heroImageUrl')?.value || '';
    return result;
  }
  const previewFrame=$('pagePreview');
  function sendPreview(){
    if(!previewFrame?.contentWindow)return;
    try{previewFrame.contentWindow.postMessage({type:'biggest-fan-admin-preview',content:readFields()},location.origin);}
    catch(error){$('visualStatus').textContent=error.message||'Preview could not update.';}
  }
  function schedulePreview(){clearTimeout(schedulePreview.timer);schedulePreview.timer=setTimeout(sendPreview,120);}
  ['contentFields','visualManager'].forEach(id=>$(id)?.addEventListener('input',schedulePreview));
  ['contentFields','visualManager'].forEach(id=>$(id)?.addEventListener('change',schedulePreview));
  window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.source===previewFrame?.contentWindow&&event.data?.type==='biggest-fan-preview-ready')sendPreview();
  });
  previewFrame?.addEventListener('load',sendPreview);

  function renderAdminPhotoPosts(posts=cloud.blogPosts||[]){
    const root=$('adminPhotoPostList');if(!root)return;root.replaceChildren();const ordered=[...(posts||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    $('photoPostCount').textContent=`${ordered.length} POST${ordered.length===1?'':'S'}`;
    if(!ordered.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No photo posts yet. Add the first one above.';root.append(empty);return;}
    ordered.forEach(post=>{const row=document.createElement('article');row.className='admin-item photo-post-admin-item';const img=document.createElement('img');img.className='photo-post-thumb';img.src=validPostUrl(post.image)||'';img.alt='';img.loading='lazy';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=post.caption||'Untitled photo';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=post.date||'Undated archive';main.append(title,meta);const actions=document.createElement('div');actions.className='admin-item-actions';const remove=document.createElement('button');remove.type='button';remove.className='small-action danger';remove.textContent='Delete';remove.setAttribute('aria-label',`Delete photo post: ${post.caption||'Untitled photo'}`);remove.addEventListener('click',()=>deletePhotoPost(post));actions.append(remove);row.append(img,main,actions);root.append(row);});
  }
  async function readLatestContent(){const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();if(error)throw error;return normalizeContent(data?.content||cloud);}
  async function persistPhotoPost(post){
    const status=$('photoPostStatus');if(!db||!contentLoaded)throw new Error('Sign in and wait for the shared archive to finish loading.');
    const next=await readLatestContent();next.blogPosts=[...(next.blogPosts||[]),post].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const {data:userData}=await db.auth.getUser();const {error}=await db.from('archive_content').update({content:next,updated_at:new Date().toISOString(),updated_by:userData.user?.id}).eq('id',true);if(error)throw error;
    cloud=next;renderAdminPhotoPosts();sendPreview();return true;
  }
  $('photoPostForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,file=$('photoPostFile').files?.[0],caption=$('photoPostCaption').value.trim(),date=$('photoPostDate').value,status=$('photoPostStatus'),button=$('publishPhotoPost');
    if(!file||!caption||!date)return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if(!allowed.includes(file.type)){status.textContent='Choose a JPG, PNG, WebP, GIF, or AVIF image.';return;}
    if(file.size>10*1024*1024){status.textContent='Images must be 10 MB or smaller.';return;}
    button.disabled=true;status.textContent='Uploading image…';let objectPath='';
    try{
      const {data:userData}=await db.auth.getUser();if(!userData?.user)throw new Error('Sign in again to upload a photo.');
      objectPath=`${userData.user.id}/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg','jpg')}`;
      const {error:uploadError}=await db.storage.from('archive-photos').upload(objectPath,file,{cacheControl:'31536000',contentType:file.type,upsert:false});if(uploadError)throw uploadError;
      const {data:publicData}=db.storage.from('archive-photos').getPublicUrl(objectPath);const image=validPostUrl(publicData?.publicUrl);if(!image)throw new Error('The uploaded photo did not return a valid public URL.');
      const post={id:crypto.randomUUID(),image,path:objectPath,caption:caption.slice(0,220),date};
      try{await persistPhotoPost(post);}catch(error){await db.storage.from('archive-photos').remove([objectPath]);throw error;}
      form.reset();status.textContent='Photo post published to the journal.';
    }catch(error){status.textContent=error.message||'Upload failed. Check the storage setup and try again.';}
    finally{button.disabled=false;}
  });
  async function deletePhotoPost(post){
    if(!confirm(`Delete “${post.caption||'this photo post'}” from the journal?`))return;
    const status=$('photoPostStatus');status.textContent='Removing photo post…';
    try{
      const next=await readLatestContent();next.blogPosts=(next.blogPosts||[]).filter(item=>item.id!==post.id);
      const {data:userData}=await db.auth.getUser();const {error}=await db.from('archive_content').update({content:next,updated_at:new Date().toISOString(),updated_by:userData.user?.id}).eq('id',true);if(error)throw error;
      cloud=next;renderAdminPhotoPosts();sendPreview();
      if(post.path){const {error:removeError}=await db.storage.from('archive-photos').remove([post.path]);if(removeError)throw new Error('The post was removed, but its stored image could not be deleted.');}
      status.textContent='Photo post deleted.';
    }catch(error){status.textContent=error.message||'Could not delete this photo post.';}
  }

  async function load() {
    db=window.archiveSupabase; if(!db) return;
    const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();
    if(error) { $('contentStatus').textContent='Could not load shared content. Check schema/RLS setup.'; return; }
    fillFields(data?.content || {});
    contentLoaded = true;
    // Initialize visual editor from shared content too.
    window.dispatchEvent(new CustomEvent('archive-content-loaded',{detail:{content:cloud}}));
    sendPreview();
    await loadComments();
  }
  async function save(override) {
    const status=$('contentStatus');
    try {
      if(!contentLoaded)throw new Error('Wait for shared content to finish loading before publishing.');
      const next=override||readFields();
      const imageUrls=[next.image,...(next.blogPosts||[]).map(post=>post.image)].filter(Boolean);
      if(imageUrls.some(value=>!validPostUrl(value)))throw new Error('Images must use public HTTPS URLs.');
      status.textContent='Publishing…';
      if(!db)throw new Error('Connect the shared backend before publishing.');
      const {data:userData}=await db.auth.getUser();
      const {error}=await db.from('archive_content').update({content:next,updated_at:new Date().toISOString(),updated_by:userData.user?.id}).eq('id',true);
      if(error) throw error;
      cloud=next; status.textContent='Published to the shared site.';$('visualStatus').textContent='Visual settings published for all visitors.';
      try{localStorage.setItem('biggestFanArchiveVisuals', JSON.stringify({theme:next.theme,layout:next.layout,accent:next.accent,background:next.background,text:next.text,title:next.title,subtitle:next.subtitle,description:next.description,image:next.image}));}catch(_){}
      sendPreview();
      return true;
    } catch(e) { status.textContent=e.message || 'Could not publish. Check permissions and database setup.'; $('visualStatus').textContent=e.message||'Could not publish visual settings.'; return false; }
  }
  async function loadComments() {
    const list=$('adminGuestList'); if(!list) return;
    const {data,error}=await db.from('archive_comments').select('*').order('created_at',{ascending:false}).limit(100);
    list.replaceChildren(); if(error){list.textContent='Unable to load comments. Check database schema and admin session.';const n=$('guestStat');if(n)n.textContent='—';$('guestbookModerationStatus').textContent='Comments could not be loaded.';return;}
    const stat=$('guestStat');if(stat)stat.textContent=String(data?.length||0);
    $('guestbookModerationStatus').textContent=`${(data||[]).filter(c=>!c.approved).length} pending · ${(data||[]).filter(c=>c.approved).length} published`;
    if(!data?.length){list.textContent='No visitor comments yet.';return;}
    data.forEach(c=>{
      const item=document.createElement('article'); item.className='admin-item';
      const body=document.createElement('div'); body.className='admin-item-copy';
      const title=document.createElement('strong'); title.textContent=c.display_name+(c.approved?' · PUBLISHED':' · PENDING');
      const msg=document.createElement('p'); msg.textContent=c.message;
      const date=document.createElement('small'); date.textContent=new Date(c.created_at).toLocaleString(); body.append(title,msg,date); item.append(body);
      const actions=document.createElement('div'); actions.className='admin-item-actions';
      if(!c.approved){const approve=document.createElement('button');approve.className='primary-button';approve.type='button';approve.textContent='Approve';approve.setAttribute('aria-label','Approve note from '+c.display_name);approve.onclick=async()=>{approve.disabled=true;const r=await db.from('archive_comments').update({approved:true}).eq('id',c.id); if(!r.error){$('guestbookModerationStatus').textContent='Note approved and published.';loadComments();}else{$('guestbookModerationStatus').textContent='Could not approve this note. Check your connection and permissions.';approve.disabled=false;}};actions.append(approve);}
      const del=document.createElement('button');del.className='text-button';del.type='button';del.textContent='Delete';del.setAttribute('aria-label','Delete note from '+c.display_name);del.onclick=async()=>{if(confirm('Delete this comment permanently?')){const r=await db.from('archive_comments').delete().eq('id',c.id);if(!r.error){$('guestbookModerationStatus').textContent='Note deleted.';loadComments();}else $('guestbookModerationStatus').textContent='Could not delete this note. Check your connection and permissions.';}};actions.append(del);item.append(actions);list.append(item);
    });
  }
  window.addEventListener('archive-auth-ready', async()=>{db=window.archiveSupabase; await load();});
  window.addEventListener('archive-collections-saved',event=>{cloud={...cloud,songs:event.detail?.songs||[],thoughts:event.detail?.thoughts||[]};sendPreview();});
  $('savePageContent')?.addEventListener('click',save);
  $('saveContentDraft')?.addEventListener('click',()=>{
    try { localStorage.setItem('biggestFanArchiveContentDraft',JSON.stringify(readFields())); $('contentStatus').textContent='Draft saved in this browser. It is not published yet.'; }
    catch(error) { $('contentStatus').textContent='Could not save the draft in this browser.'; }
  });
  $('restoreContentDraft')?.addEventListener('click',()=>{
    try {
      const raw=localStorage.getItem('biggestFanArchiveContentDraft');
      if(!raw){$('contentStatus').textContent='No saved draft was found in this browser.';return;}
      fillFields(JSON.parse(raw));
      window.dispatchEvent(new CustomEvent('archive-content-loaded',{detail:{content:cloud}}));
      sendPreview();
      $('contentStatus').textContent='Draft restored. Review it, then publish when ready.';
    } catch(error) { $('contentStatus').textContent='Could not read this draft. Save a new draft to replace it.'; }
  });
  $('resetVisuals')?.addEventListener('click',()=>{
    const visualDefaults={theme:'editorial',layout:'left',accent:'#2456d7',background:'#f4f7fb',text:'#111827',title:'רואי',subtitle:'A study of ordinary days.',description:'Light shifts across familiar places. A song returns with the weather.',image:''};
    cloud={...cloud,...visualDefaults};
    window.dispatchEvent(new CustomEvent('archive-visual-settings-changed',{detail:visualDefaults}));
    sendPreview();$('visualStatus').textContent='Visual defaults loaded. Publish changes to apply them.';
  });
  // Keep old local editor from treating local storage as the authoritative shared source.
  window.addEventListener('archive-content-loaded', e=>{fillFields(e.detail.content);});
  window.archiveGetPublishedContent=()=>contentLoaded?({...defaults,...cloud}):null;
  window.archiveRestorePublishedContent=async content=>{
    if(!db||!contentLoaded)throw new Error('Wait for the shared content to load before restoring.');
    fillFields({...defaults,...content});
    window.dispatchEvent(new CustomEvent('archive-content-loaded',{detail:{content:cloud}}));
    const published=await save();
    if(!published)throw new Error($('contentStatus').textContent||'Could not publish the restored content.');
  };
})();
