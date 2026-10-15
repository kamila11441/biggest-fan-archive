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
    const cloud = $('cloudStatus'); if (cloud) cloud.textContent = 'Authenticated · shared archive';
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
  const KEYS = { songs: 'biggestFanArchiveSongs', noises: 'biggestFanArchiveNoises', thoughts: 'biggestFanArchiveThoughts' };
  const $ = id => document.getElementById(id);
  const safeRead = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const githubConfigKey='biggestFanGitHubConfig';let githubToken='';
  let githubConfig={owner:'kamila11441',repo:'biggest-fan-archive',branch:'main'};
  try{githubConfig={...githubConfig,...JSON.parse(localStorage.getItem(githubConfigKey)||'{}')};}catch(_){}
  const githubApiBase=()=>`https://api.github.com/repos/${encodeURIComponent(githubConfig.owner)}/${encodeURIComponent(githubConfig.repo)}`;
  const githubPath=path=>path.split('/').map(encodeURIComponent).join('/');
  async function githubRequest(path,method='GET',body){
    if(!githubToken)throw new Error('Connect GitHub with your repository token first.');
    const response=await fetch(`${githubApiBase()}${path}`,{method,headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${githubToken}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||`GitHub request failed (${response.status}). Check the token and repository permissions.`);
    return data;
  }
  async function githubFile(path){try{return await githubRequest(`/contents/${githubPath(path)}?ref=${encodeURIComponent(githubConfig.branch)}`);}catch(error){if(/404|Not Found/i.test(error.message))return null;throw error;}}
  function decodeGitHubText(base64){const bytes=Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
  function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
  async function putGitHubBytes(path,bytes,message){const previous=await githubFile(path);return githubRequest(`/contents/${githubPath(path)}`,'PUT',{message,content:bytesToBase64(bytes),branch:githubConfig.branch,...(previous?.sha?{sha:previous.sha}:{})});}
  window.archiveGitHub={
    get connected(){return Boolean(githubToken)},get config(){return {...githubConfig}},
    configure(owner,repo,branch,token){if(!/^[A-Za-z0-9-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo)||!/^[A-Za-z0-9._/-]+$/.test(branch))throw new Error('Enter a valid GitHub owner, repository, and branch.');githubConfig={owner,repo,branch};githubToken=token.trim();localStorage.setItem(githubConfigKey,JSON.stringify(githubConfig));},
    disconnect(){githubToken='';},
    async connect(){const repo=await githubRequest('');if(repo.permissions?.push===false)throw new Error('This token can read the repository but cannot write to it. Enable Contents read/write.');return repo;},
    async getJson(path){const file=await githubFile(path);if(!file)return null;return JSON.parse(decodeGitHubText(file.content));},
    async putJson(path,value,message='Update archive content'){const text=JSON.stringify(value,null,2);return putGitHubBytes(path,new TextEncoder().encode(text),message);},
    async upload(path,file,message='Add archive media'){return putGitHubBytes(path,new Uint8Array(await file.arrayBuffer()),message);},
    async uploadBytes(path,bytes,message='Import archive media'){return putGitHubBytes(path,bytes,message);},
    async delete(path,message='Remove archive media'){const previous=await githubFile(path);if(!previous)return false;await githubRequest(`/contents/${githubPath(path)}`,'DELETE',{message,sha:previous.sha,branch:githubConfig.branch});return true;},
    pagesUrl(path){return `https://${githubConfig.owner}.github.io/${githubConfig.repo}/${path.split('/').map(encodeURIComponent).join('/')}`;},
    repoPathFromPagesUrl(url){try{const u=new URL(url),prefix=`/${githubConfig.repo}/`;if(u.hostname!==`${githubConfig.owner}.github.io`||!u.pathname.startsWith(prefix))return null;return decodeURIComponent(u.pathname.slice(prefix.length));}catch(_){return null;}}
  };
  ['githubOwner','githubRepo','githubBranch'].forEach((id,i)=>{const value=[githubConfig.owner,githubConfig.repo,githubConfig.branch][i];if($(id)&&value)$(id).value=value;});
  let songs = safeRead(KEYS.songs).filter(x => x && typeof x.embed === 'string');
  let thoughts = safeRead(KEYS.thoughts).filter(x => x && typeof x.text === 'string');
  let noises = safeRead(KEYS.noises).filter(x => x && typeof x.url === 'string');
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
    songs.forEach((song,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=song.label||song.title||'Untitled song';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=(song.kind||'link').toUpperCase()+' · EMBED READY';main.append(title,meta);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('↑',()=>moveSong(i,-1),false,'Move '+(song.label||song.title||'song')+' up'),makeButton('↓',()=>moveSong(i,1),false,'Move '+(song.label||song.title||'song')+' down'),makeButton('Remove',()=>{if(!window.archiveGitHub?.connected){$('adminSongStatus').textContent='Connect GitHub before editing songs.';return;}songs.splice(i,1);persistSongs();renderSongs();},true));row.append(main,actions);root.append(row);});
  }
  function renderNoises(){
    const root=$('adminNoiseList');if(!root)return;root.replaceChildren();const count=$('noiseCount');if(count)count.textContent=`${noises.length} ITEM${noises.length===1?'':'S'}`;
    if(!noises.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No recordings yet. Add the first voice note.';root.append(empty);return;}
    noises.forEach((noise,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=noise.title||'Untitled recording';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=[noise.date||'Undated',noise.caption||'Audio recording'].join(' · ');const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=validPostUrl(noise.url)||'';player.className='admin-noise-preview';main.append(title,meta,player);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('↑',()=>moveNoise(i,-1),false,'Move '+title.textContent+' up'),makeButton('↓',()=>moveNoise(i,1),false,'Move '+title.textContent+' down'),makeButton('Remove',()=>deleteNoise(noise),true));row.append(main,actions);root.append(row);});
  }
  function moveNoise(i,dir){const j=i+dir;if(j<0||j>=noises.length)return;[noises[i],noises[j]]=[noises[j],noises[i]];persistSharedCollections().then(ok=>{const status=$('adminNoiseStatus');if(status)status.textContent=ok?'Order saved and published.':'Saved locally, but shared publishing failed.';});renderNoises();}
  async function deleteNoise(noise){if(!window.archiveGitHub?.connected){$('adminNoiseStatus').textContent='Connect GitHub before deleting recordings.';return;}if(!confirm(`Remove “${noise.title||'this recording'}” from Noises?`))return;const status=$('adminNoiseStatus');status.textContent='Removing recording…';noises=noises.filter(item=>item.id!==noise.id);const ok=await persistSharedCollections();if(ok&&noise.path?.startsWith('assets/archive/'))await window.archiveGitHub.delete(noise.path,`Remove recording: ${(noise.title||'noise').slice(0,60)}`);status.textContent=ok?'Recording removed from GitHub.':'Could not publish the removal to GitHub.';renderNoises();}
  $('adminNoiseForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,file=$('adminNoiseFile').files?.[0],status=$('adminNoiseStatus'),button=form.querySelector('button[type=submit]');if(!file)return;if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before uploading a recording.';return;}if(!file.type.startsWith('audio/')&& !/\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(file.name)){status.textContent='Choose a supported audio file.';return;}if(file.size>25*1024*1024){status.textContent='Audio files must be 25 MB or smaller.';return;}button.disabled=true;status.textContent='Uploading recording to GitHub…';let path='';try{const ext=(file.name.split('.').pop()||'audio').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'audio',slug=($('adminNoiseTitle').value.trim()||file.name.replace(/\.[^.]+$/,'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'recording';path=`assets/archive/noises/${Date.now()}-${slug}.${ext}`;await window.archiveGitHub.upload(path,file,`Add recording: ${slug.slice(0,50)}`);const url=window.archiveGitHub.pagesUrl(path);noises.unshift({id:`noise-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:$('adminNoiseTitle').value.trim()||file.name.replace(/\.[^.]+$/,''),caption:$('adminNoiseCaption').value.trim(),date:$('adminNoiseDate').value||new Date().toISOString().slice(0,10),url,path,mime:file.type||'',addedAt:Date.now()});noises=noises.slice(0,50);const ok=await persistSharedCollections();if(!ok)throw new Error('The file uploaded, but the archive JSON could not be published.');form.reset();status.textContent='Recording and archive entry published to GitHub.';renderNoises();}catch(error){if(path)try{await window.archiveGitHub.delete(path,'Remove unpublished audio upload');}catch(_){}status.textContent=error.message||'Could not upload recording. Check GitHub token and repository permissions.';}finally{button.disabled=false;}});

  function moveSong(i,dir){if(!window.archiveGitHub?.connected){$('adminSongStatus').textContent='Connect GitHub before editing songs.';return;}const j=i+dir;if(j<0||j>=songs.length)return;[songs[i],songs[j]]=[songs[j],songs[i]];persistSongs();renderSongs();}
  async function persistSharedCollections(){
    safeWrite(KEYS.songs,songs); safeWrite(KEYS.noises,noises); safeWrite(KEYS.thoughts,thoughts);
    if(!window.archiveGitHub?.connected||!window.archivePublishContent)return false;
    try {
      const existing=await window.archiveGitHub.getJson('archive-data.json');
      if(!existing)throw new Error('Copy the existing archive to GitHub before editing collections.');
      const saved=await window.archivePublishContent({...existing,songs,noises,thoughts});
      if(!saved)throw new Error('GitHub did not confirm the archive update.');
      window.dispatchEvent(new CustomEvent('archive-collections-saved',{detail:{songs,noises,thoughts}}));
      return true;
    } catch(err) { console.error('GitHub archive save failed:',err); return false; }
  }
  function persistSongs(){
    safeWrite(KEYS.songs,songs);
    persistSharedCollections().then(ok=>{const status=$('adminSongStatus');if(status)status.textContent=ok?'Saved and published to GitHub Pages.':'GitHub publish failed. Connect GitHub and confirm Contents read/write access.';});
  }
  async function loadSharedCollections(){
    const db=window.archiveSupabase;if(!db)return;
    try {
      const githubContent=window.archiveGitHub?.connected?await window.archiveGitHub.getJson('archive-data.json'):null;
      const {data,error}=githubContent?{data:{content:githubContent},error:null}:await db.from('archive_content').select('content').eq('id',true).single();
      if(error)throw error;
      const content=data?.content||{};
      if(Array.isArray(content.songs)) songs=content.songs.filter(x=>x&&typeof x.embed==='string').slice(0,15);
      else if(songs.length){ await persistSharedCollections(); }
      if(Array.isArray(content.noises)) noises=content.noises.filter(x=>x&&typeof x.url==='string').slice(0,50);
      else if(noises.length){ await persistSharedCollections(); }
      if(Array.isArray(content.thoughts)) thoughts=content.thoughts.filter(x=>x&&typeof x.text==='string').slice(0,50);
      else if(thoughts.length){ await persistSharedCollections(); }
      safeWrite(KEYS.songs,songs);safeWrite(KEYS.noises,noises);safeWrite(KEYS.thoughts,thoughts);refreshAll();
      const ss=$('adminSongStatus');if(ss)ss.textContent=githubContent?'Loaded from GitHub.':'Loaded from the initial Supabase archive. Copy it to GitHub to stop using the database for page content.';
    } catch(err){console.error(err);const ss=$('adminSongStatus');if(ss)ss.textContent='Could not load the archive. Check GitHub access or Supabase setup.';}
  }
  window.addEventListener('archive-content-loaded',event=>{const content=event.detail?.content;if(event.detail?.githubSource&&content){songs=Array.isArray(content.songs)?content.songs.filter(x=>x&&typeof x.embed==='string'):[];noises=Array.isArray(content.noises)?content.noises.filter(x=>x&&typeof x.url==='string'):[];thoughts=Array.isArray(content.thoughts)?content.thoughts.filter(x=>x&&typeof x.text==='string'):[];refreshAll();return;}loadSharedCollections();},{once:true});
  window.addEventListener('archive-github-content-loaded',event=>{const content=event.detail?.content||{};songs=Array.isArray(content.songs)?content.songs.filter(x=>x&&typeof x.embed==='string'):[];noises=Array.isArray(content.noises)?content.noises.filter(x=>x&&typeof x.url==='string'):[];thoughts=Array.isArray(content.thoughts)?content.thoughts.filter(x=>x&&typeof x.text==='string'):[];safeWrite(KEYS.songs,songs);safeWrite(KEYS.noises,noises);safeWrite(KEYS.thoughts,thoughts);refreshAll();});
  $('adminSongForm').addEventListener('submit',e=>{e.preventDefault();const status=$('adminSongStatus');if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before adding songs.';return;}const parsed=parseLink($('adminSongLink').value.trim());if(!parsed){status.textContent='Use a full Spotify URL or a YouTube video/playlist URL.';return;}if(songs.some(s=>s.embed===parsed.embed)){status.textContent='That song is already in the soundtrack.';return;}parsed.label=$('adminSongLabel').value.trim()||parsed.title;parsed.addedAt=Date.now();songs.unshift(parsed);songs=songs.slice(0,15);persistSongs();renderSongs();e.target.reset();status.textContent='Publishing…';});

  function renderThoughts(){
    const root=$('adminThoughtList');root.replaceChildren();$('thoughtStat').textContent=thoughts.length;
    if(!thoughts.length){const e=document.createElement('div');e.className='admin-empty';e.textContent='No notes yet. Add an observation to the collection.';root.append(e);return;}
    thoughts.forEach(t=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=new Date(t.at||Date.now()).toLocaleDateString();const body=document.createElement('div');body.className='admin-item-text';body.textContent=t.text;main.append(meta,body);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Edit',()=>startEdit(t)),makeButton('Delete',()=>{if(!window.archiveGitHub?.connected){$('adminThoughtStatus').textContent='Connect GitHub before editing notes.';return;}thoughts=thoughts.filter(x=>x.id!==t.id);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Published for all visitors. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();},true));row.append(main,actions);root.append(row);});
  }
  function startEdit(t){editingThoughtId=t.id;$('adminThoughtText').value=t.text;$('editMode').textContent='EDITING NOTE';$('saveThoughtButton').innerHTML='Update thought <span>↗</span>';$('cancelEdit').hidden=false;$('adminThoughtText').focus();}
  function resetEdit() {editingThoughtId=null;$('adminThoughtForm').reset();$('editMode').textContent='NEW NOTE';$('saveThoughtButton').innerHTML='Save thought <span>↗</span>';$('cancelEdit').hidden=true;}
  $('cancelEdit').addEventListener('click',resetEdit);
  $('adminThoughtForm').addEventListener('submit',e=>{e.preventDefault();if(!window.archiveGitHub?.connected){$('adminThoughtStatus').textContent='Connect GitHub before editing notes.';return;}const text=$('adminThoughtText').value.trim();const status=$('adminThoughtStatus');if(!text){status.textContent='Write something before saving.';return;}if(editingThoughtId){const t=thoughts.find(x=>x.id===editingThoughtId);if(t)t.text=text;}else{thoughts.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text,at:Date.now()});}thoughts=thoughts.slice(0,50);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Published for all visitors. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();resetEdit();status.textContent='Publishing note…';});

  function refreshAll(){renderSongs();renderNoises();renderThoughts();}
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
  const visualDefaults = {theme:'noir',layout:'left',accent:'#5f73a5',background:'#ffffff',text:'#090a0c',title:'רואי',subtitle:'A study of ordinary days.',description:'Light shifts across familiar places. A song returns with the weather.',image:'',songLayout:'masonry',songCardPadding:24};
  let visuals = {...visualDefaults};
  try { visuals = {...visualDefaults, ...JSON.parse(localStorage.getItem(VISUAL_KEY) || '{}')}; } catch (_) {}
  if(['#778173','#2456d7','#315bff'].includes((visuals.accent||'').toLowerCase()))visuals.accent='#5f73a5';
  const visualEls = {accent:'accentColor',title:'heroTitle',subtitle:'heroSubtitle',description:'heroDescription',image:'heroImageUrl',songLayout:'songLayout',songCardPadding:'songCardPadding'};
  function applyVisuals(v) {
    const body=document.body;
    body.dataset.theme=v.theme==='noir'?'noir':v.theme;
    body.dataset.layout=v.layout||'center';body.dataset.songLayout=v.songLayout==='grid'?'grid':'masonry';
    const root=document.documentElement;
    root.style.setProperty('--rose',v.accent||visualDefaults.accent);
    root.style.setProperty('--song-card-padding',`${Math.max(12,Math.min(32,Number(v.songCardPadding)||24))}px`);
    const title=document.querySelector('.hero h1');
    if(title){title.textContent=v.title||'רואי';title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title||'')?'he':'en');}
    const subtitle=document.querySelector('.hero-subtitle');
    if(subtitle)subtitle.textContent=v.subtitle||'';
    const description=document.querySelector('.hero-description');
    if(description)description.textContent=v.description||'';
    const image=document.querySelector('.hero-image');
    if(image){image.style.backgroundImage=v.image?`linear-gradient(90deg,#0007,transparent),url("${v.image.replace(/"/g,'%22')}")`:'';image.style.backgroundSize=v.image?'cover':'';image.style.backgroundPosition='center';image.setAttribute('aria-label',v.image?'Main photograph from the personal archive':'Abstract blue and white hero artwork');}
    const logo=document.querySelector('.logo [lang="he"]'); if(logo)logo.textContent=v.title||'רואי';
    const titleTag=document.querySelector('title');if(titleTag)titleTag.textContent=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function readVisualInputs(){
    return {theme:'noir',layout:'left',accent:$('accentColor').value,background:'#ffffff',text:'#090a0c',title:$('heroTitle').value.trim()||'רואי',subtitle:$('heroSubtitle').value.trim(),description:$('heroDescription').value.trim(),image:$('heroImageUrl').value.trim(),songLayout:$('songLayout')?.value||'masonry',songCardPadding:Number($('songCardPadding')?.value||24)};
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
  $('heroImageFile')?.addEventListener('change',async event=>{
    const input=event.currentTarget,file=input.files?.[0],status=$('visualStatus');if(!file)return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if(!allowed.includes(file.type)){status.textContent='Choose a JPG, PNG, WebP, GIF, or AVIF image.';input.value='';return;}
    if(file.size>10*1024*1024){status.textContent='The main picture must be 10 MB or smaller.';input.value='';return;}
    if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before uploading the main picture.';input.value='';return;}
    input.disabled=true;status.textContent='Uploading main picture to GitHub…';let objectPath='';
    try{
      const extension=file.type.split('/')[1].replace('jpeg','jpg');
      objectPath=`assets/archive/hero/${Date.now()}.${extension}`;
      await window.archiveGitHub.upload(objectPath,file,'Update archive hero image');
      const url=window.archiveGitHub.pagesUrl(objectPath);
      $('heroImageUrl').value=url;$('heroImageUrl').dispatchEvent(new Event('input',{bubbles:true}));
      status.textContent='Main picture uploaded to GitHub. Review the preview, then save visual changes.';
    }catch(error){if(objectPath)try{await window.archiveGitHub.delete(objectPath,'Remove unpublished hero image');}catch(_){}status.textContent=error.message||'Could not upload the main picture.';}
    finally{input.disabled=false;input.value='';}
  });
  Object.values(visualEls).forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>{visuals=readVisualInputs();applyVisuals(visuals);if(id==='heroImageUrl')updateImagePreview();});el.addEventListener('change',()=>{visuals=readVisualInputs();applyVisuals(visuals);});}});
  $('songCardPadding')?.addEventListener('input',event=>{const label=$('songCardPaddingValue');if(label)label.value=`${event.currentTarget.value} px`;});

  function colorLuminance(hex){
    const parts=(hex.match(/[0-9a-f]{2}/ig)||[]).map(v=>parseInt(v,16)/255);
    if(parts.length!==3)return 0;
    const linear=parts.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
  }
  function updateContrastStatus(){
    const output=$('contrastStatus');if(!output)return;
    const white=1,black=0,accent=colorLuminance($('accentColor').value);
    const ratio=(a,b)=>{const hi=Math.max(a,b),lo=Math.min(a,b);return (hi+.05)/(lo+.05);};
    const lightRatio=ratio(white,accent),darkRatio=ratio(black,accent);
    output.textContent=`Accent contrast: ${lightRatio.toFixed(1)}:1 on white and ${darkRatio.toFixed(1)}:1 on black. Choose a deeper or lighter accent if text needs stronger contrast.`;
    output.classList.remove('contrast-warning');
  }
  fillVisualInputs();applyVisuals(visuals);updateContrastStatus();
  function syncVisualEditor(content){
    visuals={...visualDefaults,...(content||{})};
    fillVisualInputs();applyVisuals(visuals);updateContrastStatus();updateImagePreview();
  }
  window.addEventListener('archive-content-loaded',event=>syncVisualEditor(event.detail?.content));
  window.addEventListener('archive-visual-settings-changed',event=>syncVisualEditor(event.detail));
  ['accentColor'].forEach(id=>$(id)?.addEventListener('input',updateContrastStatus));


  $('exportBackup').addEventListener('click',()=>{
    const sharedContent=window.archiveGetPublishedContent?.();
    if(!sharedContent){$('backupStatus').textContent='Wait for shared content to load before exporting a complete backup.';return;}
    const backup={app:'biggest-fan-archive',formatVersion:2,exportedAt:new Date().toISOString(),content:sharedContent};
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
      const importedNoises=Array.isArray(content.noises)?content.noises.filter(x=>x&&typeof x.url==='string').slice(0,50):[];
      if(!confirm('Restore this backup? Published page content, songs, noises, and reminders will be replaced in the shared archive. Visitor submissions remain in guestbook moderation.'))return;
      const current=window.archiveGetPublishedContent?.();
      if(!current)throw new Error('Wait for shared content to load before importing a backup.');
      await window.archiveRestorePublishedContent({...current,...(data.content||{}),songs:importedSongs,noises:importedNoises,thoughts:importedThoughts});
      songs=importedSongs;noises=importedNoises;thoughts=importedThoughts;
      safeWrite(KEYS.songs,songs);safeWrite(KEYS.noises,noises);safeWrite(KEYS.thoughts,thoughts);refreshAll();
      $('backupStatus').textContent='Shared page content and collections restored. Visitor submissions are unchanged.';
    }catch(err){$('backupStatus').textContent=err.message||'Could not read that backup.';}
    finally{e.target.value='';}
  });
})();

/* Shared Supabase content and moderation integration. */

(() => {
  const $ = id => document.getElementById(id);
  let db, cloud = {}, contentLoaded = false, archiveFromGitHub = false;
  const defaults = {
    songs:[],noises:[],thoughts:[],
    navAbout:'About', navMoments:'Journal', navNotes:'Notes', navGuestbook:'Contact',
    aboutHeading:'A record of ordinary days.', aboutLead:'Everyday life leaves its marks in unexpected places.',
    blogPosts:[],
    aboutBody:"This archive gathers photographs, music, and brief notes from shared places and familiar routines.\n\nSome days return as a particular light through a window; others arrive by way of a song heard again years later.\n\nA collection still in progress.",
    momentsHeading:'Photo journal.', momentsIntro:'Images, captions, and dates. One entry at a time.',
    qualities:['places','people','sound','observations','details'],
    footerText:'A personal archive of photographs, music, and notes.',
    theme:'editorial',layout:'left',accent:'#5f73a5',background:'#f4f7fb',text:'#111827',songLayout:'masonry',songCardPadding:24
  };
  function validPostUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function normalizeContent(value={}){
    const next={...defaults,...(value||{})};
    if(!Array.isArray(value?.blogPosts))next.blogPosts=(value?.galleryImages||[]).map((image,index)=>({id:`legacy-${index}`,image,path:'',caption:value?.galleryCaptions?.[index]||'From the archive',date:''})).filter(post=>validPostUrl(post.image));
    if(!value?.accent||['#778173','#2456d7','#315bff'].includes(String(value.accent).toLowerCase()))next.accent='#5f73a5';
    if(!value?.background||value.background==='#f4f1ea')next.background='#f4f7fb';
    if(!value?.text||value.text==='#292a27')next.text='#111827';
    next.songLayout=value?.songLayout==='grid'?'grid':'masonry';next.songCardPadding=Math.max(12,Math.min(32,Number(value?.songCardPadding)||24));
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
    if ($('accentColor')) setVal('accentColor', cloud.accent || '#5f73a5');
    if ($('backgroundColor')) setVal('backgroundColor', cloud.background || '#f4f7fb');
    if ($('textColor')) setVal('textColor', cloud.text || '#111827');
    setVal('heroTitle', cloud.title || 'רואי'); setVal('heroSubtitle', cloud.subtitle || 'A study of ordinary days.'); setVal('heroDescription', cloud.description || 'Light shifts across familiar places. A song returns with the weather.'); setVal('heroImageUrl', cloud.image || '');
    setVal('songLayout',cloud.songLayout==='grid'?'grid':'masonry');setVal('songCardPadding',Math.max(12,Math.min(32,Number(cloud.songCardPadding)||24)));
    const spacing=$('songCardPaddingValue');if(spacing)spacing.value=`${$('songCardPadding').value} px`;
    visuals={...visuals,...cloud};applyVisuals(visuals);
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
    result.theme='noir'; result.layout='left';
    result.accent=$('accentColor')?.value || '#5f73a5'; result.background='#ffffff'; result.text='#090a0c';
    result.title=$('heroTitle')?.value || 'רואי'; result.subtitle=$('heroSubtitle')?.value || ''; result.description=$('heroDescription')?.value || ''; result.image=$('heroImageUrl')?.value || '';
    result.songLayout=$('songLayout')?.value==='grid'?'grid':'masonry';result.songCardPadding=Math.max(12,Math.min(32,Number($('songCardPadding')?.value)||24));
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
  async function readSupabaseContent(){const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();if(error)throw error;return normalizeContent(data?.content||cloud);}
  async function readLatestContent(){if(window.archiveGitHub?.connected){const content=await window.archiveGitHub.getJson('archive-data.json');if(!content)throw new Error('Copy the existing archive to GitHub once before editing it.');return normalizeContent(content);}if(archiveFromGitHub)throw new Error('Reconnect GitHub in the admin dashboard before editing the archive.');return readSupabaseContent();}
  async function persistPhotoPost(post){
    if(!window.archiveGitHub?.connected||!contentLoaded)throw new Error('Connect GitHub before publishing photo posts.');
    const next=await readLatestContent();next.blogPosts=[...(next.blogPosts||[]),post].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const published=await save(next);if(!published)throw new Error($('contentStatus').textContent||'Could not publish the photo post to GitHub.');
    renderAdminPhotoPosts();return true;
  }
  $('photoPostForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,file=$('photoPostFile').files?.[0],caption=$('photoPostCaption').value.trim(),date=$('photoPostDate').value,status=$('photoPostStatus'),button=$('publishPhotoPost');
    if(!file||!caption||!date)return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if(!allowed.includes(file.type)){status.textContent='Choose a JPG, PNG, WebP, GIF, or AVIF image.';return;}
    if(file.size>10*1024*1024){status.textContent='Images must be 10 MB or smaller.';return;}
    if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before uploading a photo.';return;}
    button.disabled=true;status.textContent='Uploading image…';let objectPath='';
    try{
      const extension=file.type.split('/')[1].replace('jpeg','jpg'),slug=caption.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'photo';
      objectPath=`assets/archive/photos/${Date.now()}-${slug}.${extension}`;
      await window.archiveGitHub.upload(objectPath,file,`Add journal photo: ${caption.slice(0,60)}`);
      const image=window.archiveGitHub.pagesUrl(objectPath);
      const post={id:crypto.randomUUID(),image,path:objectPath,caption:caption.slice(0,220),date};
      try{await persistPhotoPost(post);}catch(error){await window.archiveGitHub.delete(objectPath,'Remove unpublished photo upload');throw error;}
      form.reset();status.textContent='Photo post published to the journal.';
    }catch(error){status.textContent=error.message||'Upload failed. Check the GitHub token and repository permissions.';}
    finally{button.disabled=false;}
  });
  async function deletePhotoPost(post){
    if(!confirm(`Delete “${post.caption||'this photo post'}” from the journal?`))return;
    const status=$('photoPostStatus');status.textContent='Removing photo post…';
    try{
      if(!window.archiveGitHub?.connected)throw new Error('Connect GitHub before deleting a photo post.');
      const next=await readLatestContent();next.blogPosts=(next.blogPosts||[]).filter(item=>item.id!==post.id);
      if(!await save(next))throw new Error($('contentStatus').textContent||'Could not remove the photo post from GitHub.');
      if(post.path?.startsWith('assets/archive/'))await window.archiveGitHub.delete(post.path,`Remove journal photo: ${(post.caption||'photo').slice(0,60)}`);
      renderAdminPhotoPosts();
      status.textContent='Photo post deleted.';
    }catch(error){status.textContent=error.message||'Could not delete this photo post.';}
  }

  async function load() {
    db=window.archiveSupabase; if(!db) return;
    let githubSource=false,content=null;
    if(window.archiveGitHub?.connected){try{content=await window.archiveGitHub.getJson('archive-data.json');githubSource=Boolean(content&&typeof content==='object');}catch(_){}}
    if(!githubSource)try{const response=await fetch(new URL('archive-data.json',location.href),{cache:'no-store'});if(response.ok){content=await response.json();githubSource=Boolean(content&&typeof content==='object');}}catch(_){}
    if(!githubSource){const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();if(error){$('contentStatus').textContent='Could not load the initial archive. Check Supabase setup, or connect GitHub if archive-data.json is already published.';return;}content=data?.content||{};}
    archiveFromGitHub=githubSource;fillFields(content);
    contentLoaded = true;
    window.dispatchEvent(new CustomEvent('archive-content-loaded',{detail:{content:cloud,githubSource}}));
    if(githubSource){const status=$('githubStorageStatus');if(status)status.textContent=window.archiveGitHub?.connected?'Loaded archive-data.json from GitHub. Content and media are ready to publish from admin.':'Loaded archive-data.json from GitHub Pages. Connect GitHub here to publish edits.';$('copyArchiveToGitHub').disabled=true;}
    else if($('copyArchiveToGitHub')){$('copyArchiveToGitHub').disabled=!window.archiveGitHub?.connected;const status=$('githubStorageStatus');if(status&&window.archiveGitHub?.connected)status.textContent='Current content is still in Supabase. Copy it once to GitHub to make GitHub the archive source.';}
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
      if(!window.archiveGitHub?.connected)throw new Error('Connect GitHub in the admin dashboard before publishing.');
      await window.archiveGitHub.putJson('archive-data.json',next,'Update archive content');
      const previousMedia=window.archiveGitHub.repoPathFromPagesUrl(cloud.image||'');
      const nextMedia=window.archiveGitHub.repoPathFromPagesUrl(next.image||'');
      cloud=next;archiveFromGitHub=true; status.textContent='Published to the shared site.';$('visualStatus').textContent='Visual settings published for all visitors.';
      if(previousMedia&&previousMedia!==nextMedia)try{await window.archiveGitHub.delete(previousMedia,'Remove replaced hero image');}catch(error){$('visualStatus').textContent='Content is published, but the replaced hero image could not be removed from the repository.';}
      try{localStorage.setItem('biggestFanArchiveVisuals', JSON.stringify({theme:next.theme,layout:next.layout,accent:next.accent,background:next.background,text:next.text,title:next.title,subtitle:next.subtitle,description:next.description,image:next.image,songLayout:next.songLayout,songCardPadding:next.songCardPadding}));}catch(_){}
      sendPreview();
      return true;
    } catch(e) { status.textContent=e.message || 'Could not publish. Check permissions and database setup.'; $('visualStatus').textContent=e.message||'Could not publish visual settings.'; return false; }
  }
  window.archivePublishContent=save;
  $('connectGitHub')?.addEventListener('click',async event=>{
    const button=event.currentTarget,status=$('githubLoginStatus'),token=$('githubToken').value;
    if(!token.trim()){status.textContent='Paste a fine-grained GitHub token first.';return;}
    button.disabled=true;status.textContent='Checking repository access…';
    try{
      window.archiveGitHub.configure($('githubOwner').value.trim(),$('githubRepo').value.trim(),$('githubBranch').value.trim()||'main',token);
      const repo=await window.archiveGitHub.connect();$('githubToken').value='';
      const remote=await window.archiveGitHub.getJson('archive-data.json');archiveFromGitHub=Boolean(remote);
      status.textContent=`Connected to ${repo.full_name}. Publishing is enabled for this admin session.`;
      const cloudStatus=$('cloudStatus');if(cloudStatus)cloudStatus.textContent='Authenticated · GitHub publishing connected';
      const copy=$('copyArchiveToGitHub');if(copy)copy.disabled=Boolean(remote)||!contentLoaded;
      const sharedStatus=$('githubStorageStatus');if(sharedStatus)sharedStatus.textContent=remote?'Connected. Content and uploaded files publish directly to this repository.':(contentLoaded?'Connected. Copy the current archive to GitHub once to start.':'Connected. The current archive will load after sign-in.');
      if(remote){fillFields(remote);contentLoaded=true;window.dispatchEvent(new CustomEvent('archive-github-content-loaded',{detail:{content:cloud}}));sendPreview();if(copy)copy.disabled=true;}
    }catch(error){window.archiveGitHub.disconnect();status.textContent=error.message||'Could not connect to GitHub.';}
    finally{button.disabled=false;}
  });
  async function copyRemoteMedia(url,folder,index){
    if(!validPostUrl(url))return {url,path:null,copied:false};
    const existingPath=window.archiveGitHub.repoPathFromPagesUrl(url);if(existingPath)return {url,path:existingPath,copied:true};
    try{
      const response=await fetch(url,{mode:'cors'});if(!response.ok)throw new Error('Source unavailable');
      const blob=await response.blob();if(!blob.size||blob.size>25*1024*1024)throw new Error('Media over 25 MB or empty');
      const sourceUrl=new URL(url),last=sourceUrl.pathname.split('/').pop()||'',suffix=(last.match(/\.[a-z0-9]{2,5}$/i)||[])[0]||({ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif','image/gif':'.gif','audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/wav':'.wav','audio/ogg':'.ogg','audio/aac':'.aac','audio/webm':'.webm' }[blob.type]||'');
      if(!suffix)throw new Error('Unsupported media format');
      const path=`assets/archive/${folder}/${Date.now()}-${index}${suffix}`;
      await window.archiveGitHub.uploadBytes(path,new Uint8Array(await blob.arrayBuffer()),`Import ${folder} media`);
      return {url:window.archiveGitHub.pagesUrl(path),path,copied:true};
    }catch(error){console.warn('Could not copy an existing media URL into GitHub; retaining its source URL.',url,error);return {url,path:null,copied:false};}
  }
  $('copyArchiveToGitHub')?.addEventListener('click',async event=>{
    const button=event.currentTarget,status=$('githubStorageStatus');
    if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub in this admin panel first.';return;}
    if(!contentLoaded){status.textContent='Sign in to load the current Supabase archive before copying it.';return;}
    if(await window.archiveGitHub.getJson('archive-data.json')){status.textContent='A GitHub archive already exists. Connect loaded that version; it was not overwritten.';button.disabled=true;return;}
    if(!confirm('Copy the current Supabase archive and its downloadable photos/audio into GitHub? After this, GitHub becomes the source for page content.'))return;
    button.disabled=true;status.textContent='Reading the current Supabase archive…';
    try{
      const next=await readSupabaseContent();let copied=0,external=0;
      if(next.image){const asset=await copyRemoteMedia(next.image,'hero',1);next.image=asset.url;next.heroImagePath=asset.path||'';asset.copied?copied++:external++;}
      for(let i=0;i<(next.blogPosts||[]).length;i++){const post=next.blogPosts[i],asset=await copyRemoteMedia(post.image,'photos',i+1);post.image=asset.url;post.path=asset.path||post.path||'';asset.copied?copied++:external++;}
      for(let i=0;i<(next.noises||[]).length;i++){const noise=next.noises[i],asset=await copyRemoteMedia(noise.url,'noises',i+1);noise.url=asset.url;noise.path=asset.path||noise.path||'';asset.copied?copied++:external++;}
      fillFields(next);const published=await save(next);if(!published)throw new Error($('contentStatus').textContent||'Could not publish the archive to GitHub.');
      window.dispatchEvent(new CustomEvent('archive-github-content-loaded',{detail:{content:cloud}}));
      status.textContent=`Archive copied to GitHub with ${copied} media file${copied===1?'':'s'}.${external?` ${external} external media URL${external===1?' was':'s were'} retained because GitHub could not fetch the source.`:''}`;
      button.disabled=true;
    }catch(error){status.textContent=error.message||'The archive could not be copied. Check the GitHub token and try again.';button.disabled=false;}
  });
  $('saveVisualSettings')?.addEventListener('click',async event=>{
    const button=event.currentTarget,status=$('visualStatus');button.disabled=true;status.textContent='Saving visual changes…';
    try{
      if(!contentLoaded)throw new Error('Wait for shared content to finish loading before saving.');
      const latest=await readLatestContent();
      const next={...latest,theme:'noir',layout:'left',accent:$('accentColor').value,background:'#ffffff',text:'#090a0c',title:$('heroTitle').value.trim()||'רואי',subtitle:$('heroSubtitle').value.trim(),description:$('heroDescription').value.trim(),image:$('heroImageUrl').value.trim(),songLayout:$('songLayout').value,songCardPadding:Number($('songCardPadding').value)};
      const saved=await save(next);
      if(saved)status.textContent='Visual changes saved and published to the homepage.';
    }catch(error){status.textContent=error.message||'Could not save visual changes.';}
    finally{button.disabled=false;}
  });
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
  window.addEventListener('archive-collections-saved',event=>{cloud={...cloud,songs:event.detail?.songs||[],noises:event.detail?.noises||[],thoughts:event.detail?.thoughts||[]};sendPreview();});
  $('savePageContent')?.addEventListener('click',()=>save());
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
    const visualDefaults={theme:'noir',layout:'left',accent:'#5f73a5',background:'#ffffff',text:'#090a0c',title:'רואי',subtitle:'A study of ordinary days.','description':'Light shifts across familiar places. A song returns with the weather.',image:''};
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
