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
  $('adminSignOut')?.addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); window.archiveGitHub?.disconnect(); app.hidden = true; gate.hidden = false; status.textContent = 'Signed out.'; });
  if (supabase) supabase.auth.getSession().then(({ data }) => { if (data.session) showApp(data.session.user); });
})();

/* Admin content editor and local collection tools. */

(() => {
  const KEYS = { songs: 'biggestFanArchiveSongs', noises: 'biggestFanArchiveNoises', thoughts: 'biggestFanArchiveThoughts' };
  const $ = id => document.getElementById(id);
  const safeRead = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const validPostUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? u.href : null; } catch (_) { return null; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const githubConfigKey='biggestFanGitHubConfig',githubTokenKey='biggestFanGitHubTokenSession';let githubToken='';
  try{githubToken=sessionStorage.getItem(githubTokenKey)||'';}catch(_){}
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
  let ghQueue=Promise.resolve();
  const ghEnqueue=fn=>{const run=ghQueue.then(fn);ghQueue=run.catch(()=>{});return run;};
  function putGitHubBytes(path,bytes,message){return ghEnqueue(async()=>{for(let attempt=0;;attempt++){const previous=await githubFile(path);try{return await githubRequest(`/contents/${githubPath(path)}`,'PUT',{message,content:bytesToBase64(bytes),branch:githubConfig.branch,...(previous?.sha?{sha:previous.sha}:{})});}catch(error){if(attempt<2&&/409|does not match/i.test(error.message))continue;throw error;}}});}
  window.archiveStaging=window.archiveStaging||{uploads:new Set(),deletes:new Set()};
  async function compressImage(file,maxDim=2000,quality=.82){
    const typeExt={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
    const original={blob:file,ext:typeExt[file.type]||'jpg',optimized:false};
    if(file.type==='image/gif'||!window.createImageBitmap)return original;
    try{
      const bmp=await createImageBitmap(file);
      const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
      const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(bmp,0,0,w,h);bmp.close?.();
      const toBlob=(type)=>new Promise(res=>canvas.toBlob(res,type,quality));
      let blob=await toBlob('image/webp'),ext='webp';
      if((!blob||blob.type!=='image/webp')&&file.type!=='image/png'){blob=await toBlob('image/jpeg');ext='jpg';}
      if(!blob||!['image/webp','image/jpeg'].includes(blob.type))return original;
      if(scale===1&&blob.size>=file.size)return original;
      return {blob,ext,optimized:true};
    }catch(_){return original;}
  }
  window.archiveCompressImage=compressImage;
  function inlineEditForm(fields,onSave,onCancel){
    const form=document.createElement('form');form.className='admin-form inline-edit';
    fields.forEach(f=>{const id='ie-'+Math.random().toString(36).slice(2,9);const label=document.createElement('label');label.htmlFor=id;label.textContent=f.label;const el=document.createElement(f.rows?'textarea':'input');el.id=id;if(f.rows)el.rows=f.rows;else el.type=f.type||'text';if(f.max)el.maxLength=f.max;el.value=f.value||'';el.dataset.key=f.key;form.append(label,el);});
    const actions=document.createElement('div');actions.className='inline-edit-actions';
    const save=document.createElement('button');save.type='submit';save.className='primary-button';save.textContent='Save changes';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='Cancel';cancel.addEventListener('click',onCancel);
    actions.append(save,cancel);form.append(actions);
    form.addEventListener('submit',e=>{e.preventDefault();const out={};form.querySelectorAll('[data-key]').forEach(el=>{out[el.dataset.key]=el.value.trim();});onSave(out);});
    return form;
  }
  window.archiveInlineEdit=inlineEditForm;
  const siteBase=()=>String(window.ARCHIVE_BACKEND?.siteBase||`https://${githubConfig.owner}.github.io/${githubConfig.repo}`).replace(/\/+$/,'');
  window.archiveGitHub={
    get connected(){return Boolean(githubToken)},get config(){return {...githubConfig}},
    configure(owner,repo,branch,token){if(!/^[A-Za-z0-9-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo)||!/^[A-Za-z0-9._/-]+$/.test(branch))throw new Error('Enter a valid GitHub owner, repository, and branch.');githubConfig={owner,repo,branch};githubToken=token.trim();localStorage.setItem(githubConfigKey,JSON.stringify(githubConfig));try{if(githubToken)sessionStorage.setItem(githubTokenKey,githubToken);else sessionStorage.removeItem(githubTokenKey);}catch(_){}},
    disconnect(){githubToken='';try{sessionStorage.removeItem(githubTokenKey);}catch(_){}},
    async connect(){const repo=await githubRequest('');if(repo.permissions?.push===false)throw new Error('This token can read the repository but cannot write to it. Enable Contents read/write.');return repo;},
    async getText(path){const f=await githubFile(path);return f?decodeGitHubText(f.content):null;},
    putText(path,text,message='Update site file'){return putGitHubBytes(path,new TextEncoder().encode(text),message);},
    async getJson(path){const file=await githubFile(path);if(!file)return null;return JSON.parse(decodeGitHubText(file.content));},
    async putJson(path,value,message='Update archive content'){const text=JSON.stringify(value,null,2);return putGitHubBytes(path,new TextEncoder().encode(text),message);},
    async upload(path,file,message='Add archive media'){return putGitHubBytes(path,new Uint8Array(await file.arrayBuffer()),message);},
    async uploadBytes(path,bytes,message='Import archive media'){return putGitHubBytes(path,bytes,message);},
    async delete(path,message='Remove archive media'){return ghEnqueue(async()=>{const previous=await githubFile(path);if(!previous)return false;await githubRequest(`/contents/${githubPath(path)}`,'DELETE',{message,sha:previous.sha,branch:githubConfig.branch});return true;});},
    pagesUrl(path){return `${siteBase()}/${path.split('/').map(encodeURIComponent).join('/')}`;},
    repoPathFromPagesUrl(url){try{const base=siteBase()+'/',u=new URL(url);if(!u.href.toLowerCase().startsWith(base.toLowerCase()))return null;return decodeURIComponent(u.href.slice(base.length).split(/[?#]/)[0]);}catch(_){return null;}}
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
    songs.forEach((song,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=song.label||song.title||'Untitled song';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=(song.kind||'link').toUpperCase()+' · EMBED READY';main.append(title,meta);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Edit',()=>editSong(i,row),false,'Edit '+(song.label||song.title||'song')),makeButton('↑',()=>moveSong(i,-1),false,'Move '+(song.label||song.title||'song')+' up'),makeButton('↓',()=>moveSong(i,1),false,'Move '+(song.label||song.title||'song')+' down'),makeButton('Remove',()=>{if(!window.archiveGitHub?.connected){$('adminSongStatus').textContent='Connect GitHub before editing songs.';return;}songs.splice(i,1);persistSongs();renderSongs();},true));row.append(main,actions);root.append(row);});
  }
  function renderNoises(){
    const root=$('adminNoiseList');if(!root)return;root.replaceChildren();const count=$('noiseCount');if(count)count.textContent=`${noises.length} ITEM${noises.length===1?'':'S'}`;
    if(!noises.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No recordings yet. Add the first voice note.';root.append(empty);return;}
    noises.forEach((noise,i)=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const title=document.createElement('div');title.className='admin-item-title';title.textContent=noise.title||'Untitled recording';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=[noise.date||'Undated',noise.caption||'Audio recording'].join(' · ');const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=validPostUrl(noise.url)||'';player.className='admin-noise-preview';main.append(title,meta,player);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Edit',()=>editNoise(i,row),false,'Edit '+title.textContent),makeButton('↑',()=>moveNoise(i,-1),false,'Move '+title.textContent+' up'),makeButton('↓',()=>moveNoise(i,1),false,'Move '+title.textContent+' down'),makeButton('Remove',()=>deleteNoise(noise),true));row.append(main,actions);root.append(row);});
  }
  function editSong(i,row){
    if(row.querySelector('.inline-edit'))return;const song=songs[i];
    const form=inlineEditForm([{key:'label',label:'DISPLAY LABEL',value:song.label||song.title||'',max:90}],values=>{songs[i].label=values.label||song.title||'Untitled song';persistSongs();renderSongs();},()=>form.remove());
    row.append(form);form.querySelector('input').focus();
  }
  function editNoise(i,row){
    if(row.querySelector('.inline-edit'))return;const n=noises[i];
    const form=inlineEditForm([{key:'title',label:'TITLE',value:n.title||'',max:90},{key:'caption',label:'CAPTION',value:n.caption||'',rows:2,max:240},{key:'date',label:'DATE',value:n.date||'',type:'date'}],v=>{noises[i]={...n,title:v.title||n.title||'Untitled recording',caption:v.caption,date:v.date};persistSharedCollections().then(()=>{const s=$('adminNoiseStatus');if(s)s.textContent='Edit staged. Publish all changes to go live.';});renderNoises();},()=>form.remove());
    row.append(form);form.querySelector('input').focus();
  }
  function moveNoise(i,dir){const j=i+dir;if(j<0||j>=noises.length)return;[noises[i],noises[j]]=[noises[j],noises[i]];persistSharedCollections().then(ok=>{const status=$('adminNoiseStatus');if(status)status.textContent=ok?'Order staged. Publish all changes to go live.':'Saved locally, but shared publishing failed.';});renderNoises();}
  async function deleteNoise(noise){
    if(!window.archiveGitHub?.connected){$('adminNoiseStatus').textContent='Connect GitHub before deleting recordings.';return;}
    if(!confirm(`Remove “${noise.title||'this recording'}” from Noises?`))return;
    noises=noises.filter(item=>item.id!==noise.id);
    if(noise.path?.startsWith('assets/archive/'))window.archiveStaging.deletes.add(noise.path);
    await persistSharedCollections();
    $('adminNoiseStatus').textContent='Recording removed. Publish all changes to delete the file.';
    renderNoises();
  }
  $('adminNoiseForm')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,file=$('adminNoiseFile').files?.[0],status=$('adminNoiseStatus'),button=form.querySelector('button[type=submit]');if(!file)return;if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before uploading a recording.';return;}if(!file.type.startsWith('audio/')&& !/\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(file.name)){status.textContent='Choose a supported audio file.';return;}if(file.size>25*1024*1024){status.textContent='Audio files must be 25 MB or smaller.';return;}button.disabled=true;status.textContent='Uploading recording to GitHub…';let path='';try{const ext=(file.name.split('.').pop()||'audio').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'audio',slug=($('adminNoiseTitle').value.trim()||file.name.replace(/\.[^.]+$/,'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'recording';path=`assets/archive/noises/${Date.now()}-${slug}.${ext}`;await window.archiveGitHub.upload(path,file,`Add recording: ${slug.slice(0,50)}`);window.archiveStaging.uploads.add(path);const url=window.archiveGitHub.pagesUrl(path);noises.unshift({id:`noise-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:$('adminNoiseTitle').value.trim()||file.name.replace(/\.[^.]+$/,''),caption:$('adminNoiseCaption').value.trim(),date:$('adminNoiseDate').value||new Date().toISOString().slice(0,10),url,path,mime:file.type||'',addedAt:Date.now()});noises=noises.slice(0,50);const ok=await persistSharedCollections();if(!ok)throw new Error('The file uploaded, but the archive JSON could not be published.');form.reset();status.textContent='Recording uploaded and staged. Publish all changes to go live.';renderNoises();}catch(error){if(path)try{await window.archiveGitHub.delete(path,'Remove unpublished audio upload');}catch(_){}status.textContent=error.message||'Could not upload recording. Check GitHub token and repository permissions.';}finally{button.disabled=false;}});

  function moveSong(i,dir){if(!window.archiveGitHub?.connected){$('adminSongStatus').textContent='Connect GitHub before editing songs.';return;}const j=i+dir;if(j<0||j>=songs.length)return;[songs[i],songs[j]]=[songs[j],songs[i]];persistSongs();renderSongs();}
  async function persistSharedCollections(){
    safeWrite(KEYS.songs,songs); safeWrite(KEYS.noises,noises); safeWrite(KEYS.thoughts,thoughts);
    window.archiveMarkDirty?.();
    window.dispatchEvent(new CustomEvent('archive-collections-saved',{detail:{songs,noises,thoughts}}));
    return true;
  }
  function persistSongs(){
    safeWrite(KEYS.songs,songs);
    persistSharedCollections().then(ok=>{const status=$('adminSongStatus');if(status)status.textContent=ok?'Staged. Publish all changes to go live.':'GitHub publish failed. Connect GitHub and confirm Contents read/write access.';});
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
  $('adminSongForm').addEventListener('submit',e=>{e.preventDefault();const status=$('adminSongStatus');if(!window.archiveGitHub?.connected){status.textContent='Connect GitHub before adding songs.';return;}const parsed=parseLink($('adminSongLink').value.trim());if(!parsed){status.textContent='Use a full Spotify URL or a YouTube video/playlist URL.';return;}if(songs.some(s=>s.embed===parsed.embed)){status.textContent='That song is already in the soundtrack.';return;}parsed.label=$('adminSongLabel').value.trim()||parsed.title;parsed.addedAt=Date.now();songs.unshift(parsed);songs=songs.slice(0,15);persistSongs();renderSongs();e.target.reset();status.textContent='Staging…';});

  function renderThoughts(){
    const root=$('adminThoughtList');root.replaceChildren();$('thoughtStat').textContent=thoughts.length;
    if(!thoughts.length){const e=document.createElement('div');e.className='admin-empty';e.textContent='No notes yet. Add an observation to the collection.';root.append(e);return;}
    thoughts.forEach(t=>{const row=document.createElement('article');row.className='admin-item';const main=document.createElement('div');main.className='admin-item-main';const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=new Date(t.at||Date.now()).toLocaleDateString();const body=document.createElement('div');body.className='admin-item-text';body.textContent=t.text;main.append(meta,body);const actions=document.createElement('div');actions.className='admin-item-actions';actions.append(makeButton('Edit',()=>startEdit(t)),makeButton('Delete',()=>{if(!window.archiveGitHub?.connected){$('adminThoughtStatus').textContent='Connect GitHub before editing notes.';return;}thoughts=thoughts.filter(x=>x.id!==t.id);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Staged. Publish all changes to go live. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();},true));row.append(main,actions);root.append(row);});
  }
  function startEdit(t){editingThoughtId=t.id;$('adminThoughtText').value=t.text;$('editMode').textContent='EDITING NOTE';$('saveThoughtButton').innerHTML='Update thought <span>↗</span>';$('cancelEdit').hidden=false;$('adminThoughtText').focus();}
  function resetEdit() {editingThoughtId=null;$('adminThoughtForm').reset();$('editMode').textContent='NEW NOTE';$('saveThoughtButton').innerHTML='Save thought <span>↗</span>';$('cancelEdit').hidden=true;}
  $('cancelEdit').addEventListener('click',resetEdit);
  $('adminThoughtForm').addEventListener('submit',e=>{e.preventDefault();if(!window.archiveGitHub?.connected){$('adminThoughtStatus').textContent='Connect GitHub before editing notes.';return;}const text=$('adminThoughtText').value.trim();const status=$('adminThoughtStatus');if(!text){status.textContent='Write something before saving.';return;}if(editingThoughtId){const t=thoughts.find(x=>x.id===editingThoughtId);if(t)t.text=text;}else{thoughts.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text,at:Date.now()});}thoughts=thoughts.slice(0,50);safeWrite(KEYS.thoughts,thoughts);persistSharedCollections().then(ok=>{const s=$('adminThoughtStatus');if(s)s.textContent=ok?'Staged. Publish all changes to go live. ':'Saved locally, but shared publishing failed. Check Supabase permissions.';});renderThoughts();resetEdit();status.textContent='Staging note…';});

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
        const matchesStatus=status==='all'||row.dataset.status===status;
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

  ['heroTitle','heroSubtitle','heroDescription','adminThoughtText'].forEach(id=>{
    const field=$(id);if(!field)return;
    const counter=document.createElement('span');counter.className='character-count';counter.id=id+'Count';counter.setAttribute('aria-live','off');
    field.setAttribute('aria-describedby',counter.id);field.insertAdjacentElement('afterend',counter);
    const update=()=>{counter.textContent=`${field.value.length} / ${field.maxLength} characters`;};
    field.addEventListener('input',update);update();
  });

  const VISUAL_KEY = 'biggestFanArchiveVisuals';
  const visualDefaults = {theme:'noir',layout:'left',accent:'#5f73a5',background:'#ffffff',text:'#090a0c',title:'רואי',subtitle:'A study of ordinary days.',description:'Light shifts across familiar places. A song returns with the weather.',image:'',mobileImage:'',songLayout:'masonry',songCardPadding:24};
  let visuals = {...visualDefaults};
  try { visuals = {...visualDefaults, ...JSON.parse(localStorage.getItem(VISUAL_KEY) || '{}')}; } catch (_) {}
  if(['#778173','#2456d7','#315bff'].includes((visuals.accent||'').toLowerCase()))visuals.accent='#5f73a5';
  const visualEls = {accent:'accentColor',title:'heroTitle',subtitle:'heroSubtitle',description:'heroDescription',image:'heroImageUrl',mobileImage:'heroMobileImageUrl',songLayout:'songLayout',songCardPadding:'songCardPadding'};
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
    if(image){image.style.backgroundImage=v.image?`url("${v.image.replace(/"/g,'%22')}")`:'';image.style.backgroundSize=v.image?'cover':'';image.style.backgroundPosition='center';image.setAttribute('aria-label',v.image?'Main photograph from the personal archive':'Abstract blue and white hero artwork');}
    root.style.setProperty('--hero-mobile-image',v.mobileImage?`url("${v.mobileImage.replace(/"/g,'%22')}")`:'none');
    const logo=document.querySelector('.logo [lang="he"]'); if(logo)logo.textContent=v.title||'רואי';
    const titleTag=document.querySelector('title');if(titleTag)titleTag.textContent=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function readVisualInputs(){
    return {theme:'noir',layout:'left',accent:$('accentColor').value,background:'#ffffff',text:'#090a0c',title:$('heroTitle').value.trim()||'רואי',subtitle:$('heroSubtitle').value.trim(),description:$('heroDescription').value.trim(),image:$('heroImageUrl').value.trim(),mobileImage:$('heroMobileImageUrl')?.value.trim()||'',songLayout:$('songLayout')?.value||'masonry',songCardPadding:Number($('songCardPadding')?.value||24)};
  }
  function fillVisualInputs(){
    Object.entries(visualEls).forEach(([key,id])=>{if($(id))$(id).value=visuals[key]||visualDefaults[key]||'';});
    updateImagePreview();
  }
  function updateImagePreview(){
    [['heroImagePreview','image','Illustrated sky background'],['heroMobileImagePreview','mobileImage','No mobile picture set']].forEach(([id,key,empty])=>{
      const preview=$(id);if(!preview)return;
      if(visuals[key]){preview.style.backgroundImage=`url("${visuals[key].replace(/"/g,'%22')}")`;preview.textContent='';}
      else{preview.style.backgroundImage='';preview.textContent=empty;}
    });
  }
  function bindHeroUpload(fileId,urlId,folder,label){
    $(fileId)?.addEventListener('change',async event=>{
      const input=event.currentTarget,file=input.files?.[0],status=$('visualStatus');if(!file)return;
      const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
      if(!allowed.includes(file.type)){status.textContent='Choose a JPG, PNG, WebP, GIF, or AVIF image.';input.value='';return;}
      if(file.size>10*1024*1024){status.textContent=`The ${label} must be 10 MB or smaller.`;input.value='';return;}
      if(!window.archiveGitHub?.connected){status.textContent=`Connect GitHub before uploading the ${label}.`;input.value='';return;}
      input.disabled=true;status.textContent=`Uploading ${label} to GitHub…`;let objectPath='';
      try{
        status.textContent=`Optimizing ${label}…`;
        const opt=await compressImage(file,2400);
        objectPath=`assets/archive/${folder}/${Date.now()}.${opt.ext}`;
        await window.archiveGitHub.upload(objectPath,opt.blob,`Update archive ${folder} image`);
        window.archiveStaging.uploads.add(objectPath);
        const url=window.archiveGitHub.pagesUrl(objectPath);
        $(urlId).value=url;$(urlId).dispatchEvent(new Event('input',{bubbles:true}));
        status.textContent=`${label[0].toUpperCase()+label.slice(1)} uploaded. It can take 1–2 minutes to appear while GitHub Pages rebuilds. Save visual changes to publish.`;
      }catch(error){if(objectPath)try{await window.archiveGitHub.delete(objectPath,'Remove unpublished hero image');}catch(_){}status.textContent=error.message||`Could not upload the ${label}.`;}
      finally{input.disabled=false;input.value='';}
    });
  }
  bindHeroUpload('heroImageFile','heroImageUrl','hero','main picture');
  bindHeroUpload('heroMobileImageFile','heroMobileImageUrl','hero-mobile','mobile picture');
  Object.values(visualEls).forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>{visuals=readVisualInputs();applyVisuals(visuals);if(id==='heroImageUrl'||id==='heroMobileImageUrl')updateImagePreview();});el.addEventListener('change',()=>{visuals=readVisualInputs();applyVisuals(visuals);});}});
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
    blogPosts:[],kamilaPhotos:[],marketItems:[],customNotifications:[],journalOrder:'date',kissMessages:[],kissMilestones:[
      {type:'streak',target:3,sticker:'🌱',title:'A little beginning'},
      {type:'streak',target:7,sticker:'🌷',title:'One lovely week'},
      {type:'streak',target:14,sticker:'💌',title:'Two weeks close'},
      {type:'streak',target:30,sticker:'💖',title:'A month of kisses'},
      {type:'total',target:10,sticker:'✨',title:'Ten kisses kept'},
      {type:'total',target:50,sticker:'🌟',title:'Fifty sweet days'},
      {type:'total',target:100,sticker:'💎',title:'One hundred kisses'}
    ],
    aboutBody:"This archive gathers photographs, music, and brief notes from shared places and familiar routines.\n\nSome days return as a particular light through a window; others arrive by way of a song heard again years later.\n\nA collection still in progress.",
    momentsHeading:'Photo journal.', momentsIntro:'Images, captions, and dates. One entry at a time.',
    footerText:'A personal archive of photographs, music, and notes.',
    theme:'editorial',layout:'left',accent:'#5f73a5',background:'#f4f7fb',text:'#111827',songLayout:'masonry',songCardPadding:24
  };
  function validPostUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function normalizeContent(value={}){
    const next={...defaults,...(value||{})};
    next.kamilaPhotos=(Array.isArray(value?.kamilaPhotos)?value.kamilaPhotos:[]).map((photo,index)=>typeof photo==='string'?{id:`kamila-${index}`,image:validPostUrl(photo),path:'',caption:''}:{id:String(photo?.id||`kamila-${index}`),image:validPostUrl(photo?.image),path:typeof photo?.path==='string'?photo.path:'',caption:typeof photo?.caption==='string'?photo.caption.trim().slice(0,100):''}).filter(photo=>photo.image).slice(0,100);
    next.marketItems=(Array.isArray(value?.marketItems)?value.marketItems:[]).map((item,index)=>({id:String(item?.id||`market-${index}`),title:String(item?.title||'').trim().slice(0,70),description:String(item?.description||'').trim().slice(0,240),type:item?.type==='service'?'service':'item',kissCost:Math.floor(Number(item?.kissCost)),active:item?.active!==false,offerRef:String(item?.offerRef||'')})).filter(item=>item.title&&item.kissCost>0&&item.kissCost<=100000).slice(0,100);
    next.customNotifications=(Array.isArray(value?.customNotifications)?value.customNotifications:[]).map((item,index)=>({id:String(item?.id||`notification-${index}`),title:String(item?.title||'').trim().slice(0,60),message:String(item?.message||'').trim().slice(0,240),createdAt:Number(item?.createdAt)||0})).filter(item=>item.title&&item.message).slice(0,30);
    if(!Array.isArray(value?.blogPosts))next.blogPosts=(value?.galleryImages||[]).map((image,index)=>({id:`legacy-${index}`,image,path:'',caption:value?.galleryCaptions?.[index]||'From the archive',date:''})).filter(post=>validPostUrl(post.image));
    if(!value?.accent||['#778173','#2456d7','#315bff'].includes(String(value.accent).toLowerCase()))next.accent='#5f73a5';
    if(!value?.background||value.background==='#f4f1ea')next.background='#f4f7fb';
    if(!value?.text||value.text==='#292a27')next.text='#111827';
    next.songLayout=value?.songLayout==='grid'?'grid':'masonry';next.songCardPadding=Math.max(12,Math.min(32,Number(value?.songCardPadding)||24));
    const milestoneSource=Array.isArray(value?.kissMilestones)?value.kissMilestones:defaults.kissMilestones;const seenMilestones=new Set();next.kissMilestones=milestoneSource.map(item=>({type:item?.type==='total'?'total':'streak',target:Math.floor(Number(item?.target)),sticker:String(item?.sticker||'').trim().slice(0,12),title:String(item?.title||'').trim().slice(0,70),graphic:validPostUrl(item?.graphic)||''})).filter(item=>item.target>0&&item.target<=10000&&(item.sticker||item.graphic)&&item.title).filter(item=>{const id=`${item.type}-${item.target}`;if(seenMilestones.has(id))return false;seenMilestones.add(id);return true;}).sort((a,b)=>a.type.localeCompare(b.type)||a.target-b.target).slice(0,40);
    if(!value?.navMoments||['Work','Moments'].includes(value.navMoments))next.navMoments='Journal';
    if(!value?.momentsHeading||value.momentsHeading==='Selected frames.')next.momentsHeading='Photo journal.';
    if(!value?.momentsIntro||value.momentsIntro==='Photographs and fragments from the archive.')next.momentsIntro='Images, captions, and dates. One entry at a time.';
    delete next.galleryImages;delete next.galleryCaptions;delete next.notes;
    return next;
  }
  function setVal(id, value) { const el=$(id); if (el && value !== undefined) el.value = value; }
  let appendKissMilestoneRow=()=>{};
  function renderKissMilestoneRows(items){
    const root=$('kissMilestoneRows');if(!root)return;root.replaceChildren();
    const makeField=(label,control)=>{const wrap=document.createElement('label');wrap.className='kiss-milestone-field';wrap.append(document.createTextNode(label),control);return wrap;};
    const addRow=(item={type:'streak',target:3,sticker:'✨',title:'',graphic:''})=>{
      const row=document.createElement('article');row.className='kiss-milestone-row';
      const type=document.createElement('select');type.setAttribute('aria-label','Milestone type');[['streak','Consecutive-day streak'],['total','Total kisses']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;type.append(o);});type.value=item.type;
      const target=document.createElement('input');target.type='number';target.min='1';target.max='10000';target.step='1';target.value=String(item.target);target.setAttribute('aria-label','Milestone number');
      const title=document.createElement('input');title.type='text';title.maxLength=70;title.value=item.title||'';title.placeholder='Award title';title.setAttribute('aria-label','Award title');
      const sticker=document.createElement('input');sticker.type='text';sticker.maxLength=12;sticker.value=item.sticker||'';sticker.placeholder='✨';sticker.setAttribute('aria-label','Fallback emoji');
      const graphic=document.createElement('input');graphic.type='url';graphic.value=item.graphic||'';graphic.placeholder='https://… image URL';graphic.setAttribute('aria-label','Sticker image URL');
      const preview=document.createElement('img');preview.className='kiss-milestone-preview';preview.alt='Sticker preview';preview.hidden=!item.graphic;preview.src=item.graphic||'';
      graphic.addEventListener('input',()=>{const safe=validPostUrl(graphic.value.trim());preview.hidden=!safe;preview.src=safe||'';});
      const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif,image/avif';file.className='kiss-milestone-file';file.setAttribute('aria-label','Upload sticker graphic');
      file.addEventListener('change',async()=>{const chosen=file.files?.[0],status=$('kissMilestoneStatus');if(!chosen)return;if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(chosen.type)||chosen.size>10*1024*1024){if(status)status.textContent='Choose a PNG, JPEG, WebP, GIF, or AVIF image under 10 MB.';file.value='';return;}if(!window.archiveGitHub?.connected){if(status)status.textContent='Connect GitHub before uploading a sticker graphic.';file.value='';return;}const ext=chosen.type.split('/')[1].replace('jpeg','jpg');const path=`assets/archive/stickers/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;const uploadButton=row.querySelector('.kiss-milestone-upload');uploadButton.disabled=true;if(status)status.textContent='Uploading sticker graphic…';try{await window.archiveGitHub.upload(path,chosen,'Add kiss milestone sticker');window.archiveStaging.uploads.add(path);graphic.value=window.archiveGitHub.pagesUrl(path);graphic.dispatchEvent(new Event('input',{bubbles:true}));graphic.dispatchEvent(new Event('change',{bubbles:true}));if(status)status.textContent='Sticker graphic uploaded. Publish changes to make it live.';}catch(error){if(status)status.textContent=error.message||'Could not upload sticker graphic.';}finally{uploadButton.disabled=false;file.value='';}});
      const upload=document.createElement('button');upload.type='button';upload.className='secondary-button kiss-milestone-upload';upload.textContent='Upload image';upload.addEventListener('click',()=>file.click());
      const remove=document.createElement('button');remove.type='button';remove.className='text-button kiss-milestone-remove';remove.textContent='Remove milestone';remove.addEventListener('click',()=>{row.remove();window.archiveMarkDirty();schedulePreview();});
      row.append(makeField('MILESTONE',type),makeField('NUMBER',target),makeField('TITLE',title),makeField('FALLBACK EMOJI',sticker),makeField('GRAPHIC URL',graphic),preview,file,upload,remove);root.append(row);
    };
    appendKissMilestoneRow=addRow;
    (items||[]).forEach(addRow);
  }
  $('addKissMilestone')?.addEventListener('click',()=>{appendKissMilestoneRow({type:'streak',target:3,sticker:'✨',title:'',graphic:''});window.archiveMarkDirty();schedulePreview();});
  function fillFields(data) {
    cloud = normalizeContent(data || {});
    Object.keys(cloud).forEach(k => {
      const el = document.querySelector(`[data-content="${k}"]`); if (!el) return;
      const v=cloud[k]; if(k==='kissMilestones')return;el.value = Array.isArray(v) ? (k==='notes' ? JSON.stringify(v,null,2) : v.join('\n')) : String(v ?? '');
    });
    if ($('accentColor')) setVal('accentColor', cloud.accent || '#5f73a5');
    if ($('backgroundColor')) setVal('backgroundColor', cloud.background || '#f4f7fb');
    if ($('textColor')) setVal('textColor', cloud.text || '#111827');
    setVal('heroTitle', cloud.title || 'רואי'); setVal('heroSubtitle', cloud.subtitle || 'A study of ordinary days.'); setVal('heroDescription', cloud.description || 'Light shifts across familiar places. A song returns with the weather.'); setVal('heroImageUrl', cloud.image || '');setVal('heroMobileImageUrl', cloud.mobileImage || '');
    setVal('songLayout',cloud.songLayout==='grid'?'grid':'masonry');setVal('songCardPadding',Math.max(12,Math.min(32,Number(cloud.songCardPadding)||24)));
    const spacing=$('songCardPaddingValue');if(spacing)spacing.value=`${$('songCardPadding').value} px`;
    renderAdminPhotoPosts(cloud.blogPosts);
    renderAdminKamilaPhotos(cloud.kamilaPhotos);
    renderKissMilestoneRows(cloud.kissMilestones);renderAdminMarketItems(cloud.marketItems);
    renderAdminCustomNotifications(cloud.customNotifications);
  }
  function readFields() {
    const result={...cloud};
    document.querySelectorAll('[data-content]').forEach(el => {
      const k=el.dataset.content;
      if(k==='qualities'||k==='kissMessages') result[k]=el.value.split('\n').map(x=>x.trim()).filter(Boolean);
      else result[k]=el.value;
    });
    result.blogPosts=cloud.blogPosts||[];result.kamilaPhotos=cloud.kamilaPhotos||[];result.marketItems=cloud.marketItems||[];result.customNotifications=cloud.customNotifications||[];delete result.galleryImages;delete result.galleryCaptions;delete result.notes;
    result.kissMilestones=[...document.querySelectorAll('.kiss-milestone-row')].map(row=>({type:row.querySelector('select')?.value==='total'?'total':'streak',target:Math.floor(Number(row.querySelector('input[type="number"]')?.value)),title:row.querySelector('input[aria-label="Award title"]')?.value.trim().slice(0,70)||'',sticker:row.querySelector('input[aria-label="Fallback emoji"]')?.value.trim().slice(0,12)||'',graphic:validPostUrl(row.querySelector('input[type="url"]')?.value.trim())||''})).filter(item=>item.target>0&&item.target<=10000&&item.title&&(item.sticker||item.graphic)).filter((item,index,array)=>array.findIndex(other=>other.type===item.type&&other.target===item.target)===index).slice(0,40);
    result.theme='noir'; result.layout='left';
    result.accent=$('accentColor')?.value || '#5f73a5'; result.background='#ffffff'; result.text='#090a0c';
    result.title=$('heroTitle')?.value || 'רואי'; result.subtitle=$('heroSubtitle')?.value || ''; result.description=$('heroDescription')?.value || ''; result.image=$('heroImageUrl')?.value || '';result.mobileImage=$('heroMobileImageUrl')?.value || '';
    result.songLayout=$('songLayout')?.value==='grid'?'grid':'masonry';result.songCardPadding=Math.max(12,Math.min(32,Number($('songCardPadding')?.value)||24));
    return result;
  }
  let dirty=false;
  const updateBar=()=>{const bar=$('publishBar');if(bar)bar.hidden=!dirty;};
  window.archiveMarkDirty=()=>{dirty=true;updateBar();};
  ['contentFields','visualManager','kissMilestoneFields'].forEach(id=>$(id)?.addEventListener('input',()=>window.archiveMarkDirty()));
  ['contentFields','visualManager','kissMilestoneFields'].forEach(id=>$(id)?.addEventListener('change',()=>window.archiveMarkDirty()));
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  const previewFrame=$('pagePreview');
  function sendPreview(){
    if(!previewFrame?.contentWindow)return;
    try{previewFrame.contentWindow.postMessage({type:'biggest-fan-admin-preview',content:readFields()},location.origin);}
    catch(error){$('visualStatus').textContent=error.message||'Preview could not update.';}
  }
  function schedulePreview(){clearTimeout(schedulePreview.timer);schedulePreview.timer=setTimeout(sendPreview,120);}
  ['contentFields','visualManager','kissMilestoneFields'].forEach(id=>$(id)?.addEventListener('input',schedulePreview));
  ['contentFields','visualManager','kissMilestoneFields'].forEach(id=>$(id)?.addEventListener('change',schedulePreview));
  window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.source===previewFrame?.contentWindow&&event.data?.type==='biggest-fan-preview-ready')sendPreview();
  });
  previewFrame?.addEventListener('load',sendPreview);

  function journalMode(){return $('editJournalOrder')?.value||cloud.journalOrder||'date';}
  function orderedPhotoPosts(posts){const list=[...(posts||[])];return journalMode()==='manual'?list:list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));}
  function stagePhotoPosts(list,message){cloud={...cloud,blogPosts:list};window.archiveMarkDirty();renderAdminPhotoPosts();sendPreview();if(message)$('photoPostStatus').textContent=message;}
  const mkButton=(label,fn,danger,aria)=>{const b=document.createElement('button');b.type='button';b.className='small-action'+(danger?' danger':'');b.textContent=label;b.setAttribute('aria-label',aria||label);b.addEventListener('click',fn);return b;};
  function renderAdminPhotoPosts(posts=cloud.blogPosts||[]){
    const root=$('adminPhotoPostList');if(!root)return;root.replaceChildren();
    const ordered=orderedPhotoPosts(posts),manual=journalMode()==='manual';
    $('photoPostCount').textContent=`${ordered.length} POST${ordered.length===1?'':'S'}`;
    if(!ordered.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No photo posts yet. Add the first one above.';root.append(empty);return;}
    ordered.forEach(post=>{
      const row=document.createElement('article');row.className='admin-item photo-post-admin-item';
      const img=document.createElement('img');img.className='photo-post-thumb';img.src=validPostUrl(post.image)||'';img.alt='';img.loading='lazy';
      const main=document.createElement('div');main.className='admin-item-main';
      const title=document.createElement('div');title.className='admin-item-title';title.textContent=post.caption||'Untitled photo';
      const meta=document.createElement('div');meta.className='admin-item-meta';meta.textContent=[post.date||'Undated archive',post.alt?'ALT TEXT SET':'NO ALT TEXT (USES CAPTION)'].join(' · ');
      main.append(title,meta);
      const actions=document.createElement('div');actions.className='admin-item-actions';
      const label=post.caption||'photo';
      actions.append(mkButton('Edit',()=>editPhotoPost(post,row),false,`Edit photo post: ${label}`));
      if(manual)actions.append(mkButton('↑',()=>movePhotoPost(post.id,-1),false,`Move ${label} up`),mkButton('↓',()=>movePhotoPost(post.id,1),false,`Move ${label} down`));
      actions.append(mkButton('Delete',()=>deletePhotoPost(post),true,`Delete photo post: ${label}`));
      row.append(img,main,actions);root.append(row);
    });
  }
  function stageKamilaPhotos(photos,message){cloud={...cloud,kamilaPhotos:photos.slice(0,100)};window.archiveMarkDirty();renderAdminKamilaPhotos();sendPreview();if(message)$('kamilaPhotoStatus').textContent=message;}
  function renderAdminKamilaPhotos(photos=cloud.kamilaPhotos||[]){
    const root=$('adminKamilaPhotoList');if(!root)return;root.replaceChildren();const items=photos.slice(0,100);$('kamilaPhotoCount').textContent=`${items.length} CARD${items.length===1?'':'S'}`;
    if(!items.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No Kamila card photos yet. Upload a few to start the collection.';root.append(empty);return;}
    items.forEach(photo=>{const row=document.createElement('article');row.className='admin-item kamila-photo-admin-item';const img=document.createElement('img');img.className='photo-post-thumb';img.src=photo.image;img.alt='';img.loading='lazy';const main=document.createElement('div');main.className='admin-item-main';const label=document.createElement('label');label.className='kamila-photo-caption-label';label.textContent='CARD CAPTION';const caption=document.createElement('input');caption.type='text';caption.maxLength=100;caption.value=photo.caption||'';caption.placeholder='A little moment with Kamila';caption.setAttribute('aria-label','Kamila card caption');caption.addEventListener('input',()=>{cloud.kamilaPhotos=(cloud.kamilaPhotos||[]).map(item=>item.id===photo.id?{...item,caption:caption.value.slice(0,100)}:item);window.archiveMarkDirty();schedulePreview();});main.append(label,caption);const remove=mkButton('Remove',()=>{if(photo.path?.startsWith('assets/archive/'))window.archiveStaging.deletes.add(photo.path);stageKamilaPhotos((cloud.kamilaPhotos||[]).filter(item=>item.id!==photo.id),'Photo removed from the card folder. Publish all changes to update the live collection.');},true,`Remove Kamila card photo${photo.caption?': '+photo.caption:''}`);row.append(img,main,remove);root.append(row);});
  }
  $('kamilaPhotoFiles')?.addEventListener('change',async event=>{const files=[...(event.currentTarget.files||[])],status=$('kamilaPhotoStatus');if(!files.length)return;if(!window.archiveGitHub?.connected||!contentLoaded){status.textContent='Connect GitHub and load the archive before adding card photos.';event.currentTarget.value='';return;}const chosen=files.slice(0,Math.max(0,100-(cloud.kamilaPhotos||[]).length));if(!chosen.length){status.textContent='The card folder holds up to 100 photos.';event.currentTarget.value='';return;}const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'],added=[];event.currentTarget.disabled=true;try{for(let i=0;i<chosen.length;i++){const file=chosen[i];if(!allowed.includes(file.type)||file.size>25*1024*1024)throw new Error('Use JPG, PNG, WebP, GIF or AVIF images under 25 MB each.');status.textContent=`Preparing card photo ${i+1} of ${chosen.length}…`;const opt=await window.archiveCompressImage(file,1800);const ext=opt.ext||'jpg',path=`assets/archive/kamila-cards/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;await window.archiveGitHub.upload(path,opt.blob,`Add Kamila collectible photo`);window.archiveStaging.uploads.add(path);added.push({id:crypto.randomUUID(),image:window.archiveGitHub.pagesUrl(path),path,caption:file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').slice(0,100)});}stageKamilaPhotos([...(cloud.kamilaPhotos||[]),...added],'Card photos uploaded and staged. Publish all changes to make them available.');}catch(error){status.textContent=error.message||'Could not upload the card photos. Check GitHub access.';}finally{event.currentTarget.disabled=false;event.currentTarget.value='';}});
  function stageMarketItems(items,message){cloud={...cloud,marketItems:items.slice(0,100)};window.archiveMarkDirty();renderAdminMarketItems();sendPreview();if(message)$('kissMarketAdminStatus').textContent=message;}
  function stageCustomNotifications(items,message){cloud={...cloud,customNotifications:items.slice(0,30)};window.archiveMarkDirty();renderAdminCustomNotifications();sendPreview();if(message)$('customNotificationStatus').textContent=message;}
  function renderAdminCustomNotifications(items=cloud.customNotifications||[]){
    const root=$('adminCustomNotificationList');if(!root)return;root.replaceChildren();const list=items.slice(0,30),count=$('customNotificationCount');if(count)count.textContent=`${list.length} UPDATE${list.length===1?'':'S'}`;
    if(!list.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No custom notifications yet.';root.append(empty);return;}
    list.slice().reverse().forEach(item=>{const row=document.createElement('article');row.className='admin-item custom-notification-admin-item';const body=document.createElement('div');body.className='admin-item-copy';const title=document.createElement('strong');title.className='admin-item-title';title.textContent=item.title;const message=document.createElement('p');message.className='admin-item-text';message.textContent=item.message;const date=document.createElement('small');date.className='admin-item-meta';date.textContent=item.createdAt?new Date(item.createdAt).toLocaleString():'Not published yet';body.append(title,message,date);row.append(body);const remove=mkButton('Remove',()=>stageCustomNotifications((cloud.customNotifications||[]).filter(value=>value.id!==item.id),'Notification removed. Publish all changes to remove it for visitors.'),true,`Remove notification: ${item.title}`);row.append(remove);root.append(row);});
  }
  $('customNotificationForm')?.addEventListener('submit',event=>{event.preventDefault();const title=$('customNotificationTitle').value.trim(),message=$('customNotificationMessage').value.trim(),status=$('customNotificationStatus');if(!title||!message)return;if((cloud.customNotifications||[]).length>=30){status.textContent='The page can have up to 30 custom notifications. Remove one first.';return;}const notification={id:`notice-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,message,createdAt:Date.now()};stageCustomNotifications([...(cloud.customNotifications||[]),notification],'Notification added. Publish all changes to send it to visitors.');event.currentTarget.reset();});
  function renderAdminMarketItems(items=cloud.marketItems||[]){
    const root=$('adminKissMarketList');if(!root)return;root.replaceChildren();const list=items.slice(0,100);const count=$('kissMarketCount');if(count)count.textContent=`${list.length} LISTING${list.length===1?'':'S'}`;const stat=$('marketStat');if(stat)stat.textContent=String(list.filter(item=>item.active!==false).length);
    if(!list.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent='No market listings yet. Add an item or service above.';root.append(empty);return;}
    const update=(id,key,value)=>{cloud={...cloud,marketItems:(cloud.marketItems||[]).map(item=>item.id===id?{...item,[key]:value}:item)};window.archiveMarkDirty();schedulePreview();};
    list.forEach(item=>{const row=document.createElement('article');row.className='admin-item market-admin-item';const fields=document.createElement('div');fields.className='market-admin-fields';
      const titleLabel=document.createElement('label');titleLabel.textContent='LISTING TITLE';const title=document.createElement('input');title.type='text';title.maxLength=70;title.value=item.title;title.setAttribute('aria-label','Market listing title');title.addEventListener('input',()=>update(item.id,'title',title.value.slice(0,70).trimStart()));titleLabel.append(title);
      const typeLabel=document.createElement('label');typeLabel.textContent='TYPE';const type=document.createElement('select');[['item','Item'],['service','Service']].forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;type.append(option);});type.value=item.type;type.setAttribute('aria-label','Market listing type');type.addEventListener('change',()=>update(item.id,'type',type.value));typeLabel.append(type);
      const costLabel=document.createElement('label');costLabel.textContent='KISS PRICE';const cost=document.createElement('input');cost.type='number';cost.min='1';cost.max='100000';cost.step='1';cost.value=String(item.kissCost);cost.setAttribute('aria-label','Kiss price');cost.addEventListener('change',()=>update(item.id,'kissCost',Math.max(1,Math.min(100000,Math.floor(Number(cost.value)||1)))));costLabel.append(cost);
      const descriptionLabel=document.createElement('label');descriptionLabel.className='market-description-field';descriptionLabel.textContent='DESCRIPTION / RIGHTS';const description=document.createElement('textarea');description.rows=2;description.maxLength=240;description.value=item.description||'';description.placeholder='Describe the item, service, and what the ticket lets its owner claim.';description.setAttribute('aria-label','Market listing description and collection rights');description.addEventListener('input',()=>update(item.id,'description',description.value.slice(0,240)));descriptionLabel.append(description);
      const activeLabel=document.createElement('label');activeLabel.className='market-active-field';const active=document.createElement('input');active.type='checkbox';active.checked=item.active!==false;active.setAttribute('aria-label','Listing available in the market');active.addEventListener('change',()=>update(item.id,'active',active.checked));activeLabel.append(active,document.createTextNode('Available in market'));
      fields.append(titleLabel,typeLabel,costLabel,descriptionLabel,activeLabel);const remove=mkButton('Remove listing',()=>stageMarketItems((cloud.marketItems||[]).filter(value=>value.id!==item.id),'Listing removed. Publish all changes to update the market.'),true,`Remove market listing: ${item.title}`);row.append(fields,remove);root.append(row);
    });
  }
  $('kissMarketForm')?.addEventListener('submit',event=>{event.preventDefault();const title=$('marketItemTitle').value.trim(),description=$('marketItemDescription').value.trim().slice(0,240),kissCost=Math.floor(Number($('marketItemCost').value)),type=$('marketItemType').value==='service'?'service':'item',status=$('kissMarketAdminStatus');if(!title||kissCost<1||kissCost>100000){status.textContent='Add a title and a kiss price between 1 and 100,000.';return;}if((cloud.marketItems||[]).length>=100){status.textContent='The market can hold up to 100 listings.';return;}stageMarketItems([...(cloud.marketItems||[]),{id:`market-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,description,type,kissCost,active:true}],'Listing added. Publish all changes to open it in the market.');event.currentTarget.reset();$('marketItemCost').value='5';});
  function editPhotoPost(post,row){
    if(row.querySelector('.inline-edit'))return;
    const form=window.archiveInlineEdit([{key:'caption',label:'CAPTION',value:post.caption||'',rows:2,max:220},{key:'alt',label:'ALT TEXT',value:post.alt||'',max:220},{key:'date',label:'DATE',value:post.date||'',type:'date'}],values=>{
      if(!values.caption){$('photoPostStatus').textContent='A caption is required.';return;}
      stagePhotoPosts((cloud.blogPosts||[]).map(p=>p.id===post.id?{...p,caption:values.caption.slice(0,220),alt:values.alt.slice(0,220),date:values.date||p.date}:p),'Edit staged. Publish all changes to go live.');
    },()=>form.remove());
    row.append(form);form.querySelector('textarea,input').focus();
  }
  function movePhotoPost(id,dir){const list=[...(cloud.blogPosts||[])];const i=list.findIndex(p=>p.id===id),j=i+dir;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];stagePhotoPosts(list);}
  function deletePhotoPost(post){
    if(!confirm(`Delete “${post.caption||'this photo post'}” from the journal?`))return;
    if(post.path?.startsWith('assets/archive/'))window.archiveStaging.deletes.add(post.path);
    stagePhotoPosts((cloud.blogPosts||[]).filter(item=>item.id!==post.id),'Photo post removed. Publish all changes to delete the file.');
  }
  async function readSupabaseContent(){const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();if(error)throw error;return normalizeContent(data?.content||cloud);}
  async function readLatestContent(){if(window.archiveGitHub?.connected){const content=await window.archiveGitHub.getJson('archive-data.json');if(!content)throw new Error('Copy the existing archive to GitHub once before editing it.');return normalizeContent(content);}if(archiveFromGitHub)throw new Error('Reconnect GitHub in the admin dashboard before editing the archive.');return readSupabaseContent();}
  $('photoPostForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,file=$('photoPostFile').files?.[0],caption=$('photoPostCaption').value.trim(),alt=$('photoPostAlt').value.trim(),date=$('photoPostDate').value,status=$('photoPostStatus'),button=$('publishPhotoPost');
    if(!file||!caption||!date)return;
    const allowed=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if(!allowed.includes(file.type)){status.textContent='Choose a JPG, PNG, WebP, GIF, or AVIF image.';return;}
    if(file.size>25*1024*1024){status.textContent='Images must be 25 MB or smaller.';return;}
    if(!window.archiveGitHub?.connected||!contentLoaded){status.textContent='Connect GitHub before uploading a photo.';return;}
    button.disabled=true;status.textContent='Optimizing image…';let objectPath='';
    try{
      const opt=await window.archiveCompressImage(file,2000);
      const slug=caption.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'photo';
      objectPath=`assets/archive/photos/${Date.now()}-${slug}.${opt.ext}`;
      status.textContent='Uploading image…';
      await window.archiveGitHub.upload(objectPath,opt.blob,`Add journal photo: ${caption.slice(0,60)}`);
      window.archiveStaging.uploads.add(objectPath);
      const post={id:crypto.randomUUID(),image:window.archiveGitHub.pagesUrl(objectPath),path:objectPath,caption:caption.slice(0,220),alt:alt.slice(0,220),date};
      const list=cloud.blogPosts||[];
      const note=opt.optimized?` Optimized ${(file.size/1048576).toFixed(1)} MB → ${(opt.blob.size/1048576).toFixed(1)} MB.`:'';
      stagePhotoPosts(journalMode()==='manual'?[post,...list]:[...list,post],'Photo staged.'+note+' Publish all changes to add it to the journal.');
      form.reset();
    }catch(error){if(objectPath)try{await window.archiveGitHub.delete(objectPath,'Remove failed photo upload');window.archiveStaging.uploads.delete(objectPath);}catch(_){}status.textContent=error.message||'Upload failed. Check the GitHub token and repository permissions.';}
    finally{button.disabled=false;}
  });

  async function load() {
    db=window.archiveSupabase; if(!db) return;
    let githubSource=false,content=null;
    if(window.archiveGitHub?.connected){try{const repo=await window.archiveGitHub.connect();content=await window.archiveGitHub.getJson('archive-data.json');githubSource=Boolean(content&&typeof content==='object');const connectionStatus=$('githubLoginStatus');if(connectionStatus)connectionStatus.textContent=`GitHub connection restored for ${repo.full_name}.`;}catch(error){window.archiveGitHub.disconnect();const connectionStatus=$('githubLoginStatus');if(connectionStatus)connectionStatus.textContent=`Saved GitHub connection needs attention: ${error.message||'paste the token again.'}`;}}
    if(!githubSource)try{const response=await fetch(new URL('archive-data.json',location.href),{cache:'no-store'});if(response.ok){content=await response.json();githubSource=Boolean(content&&typeof content==='object');}}catch(_){}
    if(!githubSource){const {data,error}=await db.from('archive_content').select('content').eq('id',true).single();if(error){$('contentStatus').textContent='Could not load the initial archive. Check Supabase setup, or connect GitHub if archive-data.json is already published.';return;}content=data?.content||{};}
    archiveFromGitHub=githubSource;fillFields(content);
    contentLoaded = true;
    window.dispatchEvent(new CustomEvent('archive-content-loaded',{detail:{content:cloud,githubSource}}));
    if(githubSource){const status=$('githubStorageStatus');if(status)status.textContent=window.archiveGitHub?.connected?'Loaded archive-data.json from GitHub. Content and media are ready to publish from admin.':'Loaded archive-data.json from GitHub Pages. Connect GitHub here to publish edits.';$('copyArchiveToGitHub').disabled=true;}
    else if($('copyArchiveToGitHub')){$('copyArchiveToGitHub').disabled=!window.archiveGitHub?.connected;const status=$('githubStorageStatus');if(status&&window.archiveGitHub?.connected)status.textContent='Current content is still in Supabase. Copy it once to GitHub to make GitHub the archive source.';}
    sendPreview();
  }
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  async function publishSeoFiles(next){
    const gh=window.archiveGitHub,base=gh.pagesUrl('').replace(/\/+$/,''),notes=[];
    const title=(next.title||'רואי')+' — Biggest Fan Archive';
    const desc=[next.subtitle,next.description].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()||'A personal archive of photographs, music, and notes.';
    try{
      const html=await gh.getText('index.html');
      if(html&&html.includes('<!-- og:start -->')){
        const image=validPostUrl(next.image);
        const block=['<!-- og:start -->','<meta property="og:type" content="website">',`<meta property="og:title" content="${esc(title)}">`,`<meta property="og:description" content="${esc(desc)}">`,`<meta property="og:url" content="${esc(base+'/')}">`,...(image?[`<meta property="og:image" content="${esc(image)}">`]:[]),`<meta name="twitter:card" content="${image?'summary_large_image':'summary'}">`,`<link rel="alternate" type="application/rss+xml" title="${esc(next.momentsHeading||'Photo journal')}" href="feed.xml">`,'<!-- og:end -->'].join('\n  ');
        let out=html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->/,()=>block);
        out=out.replace(/<title>[^<]*<\/title>/,()=>`<title>${esc(title)}</title>`).replace(/<meta name="description" content="[^"]*">/,()=>`<meta name="description" content="${esc(desc)}">`);
        if(out!==html)await gh.putText('index.html',out,'Update page metadata');
      }else notes.push('index.html has no og:start marker, so link-preview tags were not updated.');
    }catch(error){notes.push('Link-preview tags could not be updated.');}
    try{
      const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'};
      const posts=(next.blogPosts||[]).filter(p=>p&&validPostUrl(p.image)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,30);
      const items=posts.map(p=>{
        const ext=(new URL(p.image).pathname.split('.').pop()||'').toLowerCase();
        const when=/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')?new Date(p.date+'T12:00:00Z').toUTCString():'';
        const id=String(p.id||'').replace(/[^\w-]/g,'');
        return `<item><title>${esc((p.caption||'Untitled photo').slice(0,80))}</title><link>${esc(base+'/#post-'+id)}</link><guid isPermaLink="false">${esc(id||p.image)}</guid>${when?`<pubDate>${when}</pubDate>`:''}<description>${esc(p.alt||p.caption||'')}</description><media:content url="${esc(validPostUrl(p.image))}" medium="image"${mime[ext]?` type="${mime[ext]}"`:''}/></item>`;
      }).join('\n');
      const latest=/^\d{4}-\d{2}-\d{2}$/.test(posts[0]?.date||'')?new Date(posts[0].date+'T12:00:00Z').toUTCString():'';
      const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">\n<channel>\n<title>${esc(title)}</title>\n<link>${esc(base+'/')}</link>\n<description>${esc(desc)}</description>${latest?`\n<lastBuildDate>${latest}</lastBuildDate>`:''}\n${items}\n</channel>\n</rss>\n`;
      const previous=await gh.getText('feed.xml');
      if(previous!==xml)await gh.putText('feed.xml',xml,'Update RSS feed');
    }catch(error){notes.push('The RSS feed could not be updated.');}
    return notes.length?' '+notes.join(' '):'';
  }
  async function cleanupStagedMedia(next){
    const gh=window.archiveGitHub,stg=window.archiveStaging;
    const referenced=new Set([next.image,next.mobileImage,...(next.blogPosts||[]).map(p=>p.image),...(next.kamilaPhotos||[]).map(p=>p.image),...(next.noises||[]).map(n=>n.url),...(next.kissMilestones||[]).map(m=>m.graphic)].map(u=>u?gh.repoPathFromPagesUrl(u):null).filter(Boolean));
    for(const path of new Set([...stg.deletes,...stg.uploads])){if(referenced.has(path))continue;try{await gh.delete(path,'Remove unused archive media');}catch(_){}}
    stg.deletes.clear();stg.uploads.clear();
  }
  async function save(override) {
    const status=$('contentStatus');
    try {
      if(!contentLoaded)throw new Error('Wait for shared content to finish loading before publishing.');
      const next=override||readFields();
      const imageUrls=[next.image,next.mobileImage,...(next.blogPosts||[]).map(post=>post.image),...(next.kamilaPhotos||[]).map(photo=>photo.image),...(next.kissMilestones||[]).map(item=>item.graphic)].filter(Boolean);
      if(imageUrls.some(value=>!validPostUrl(value)))throw new Error('Images must use public HTTPS URLs.');
      status.textContent='Publishing…';
      if(!window.archiveGitHub?.connected)throw new Error('Connect GitHub in the admin dashboard before publishing.');
      await window.archiveGitHub.putJson('archive-data.json',next,'Update archive content');
      const previousMedia=window.archiveGitHub.repoPathFromPagesUrl(cloud.image||'');
      const nextMedia=window.archiveGitHub.repoPathFromPagesUrl(next.image||'');
      const prevMobile=window.archiveGitHub.repoPathFromPagesUrl(cloud.mobileImage||''),nextMobile=window.archiveGitHub.repoPathFromPagesUrl(next.mobileImage||'');
      const seoNote=await publishSeoFiles(next);
      cloud=next;archiveFromGitHub=true; status.textContent='Published to the shared site.'+seoNote;$('visualStatus').textContent='Visual settings published for all visitors.';
      if(previousMedia&&previousMedia!==nextMedia)try{await window.archiveGitHub.delete(previousMedia,'Remove replaced hero image');}catch(error){$('visualStatus').textContent='Content is published, but the replaced hero image could not be removed from the repository.';}
      if(prevMobile&&prevMobile!==nextMobile)try{await window.archiveGitHub.delete(prevMobile,'Remove replaced mobile hero image');}catch(_){}
      await cleanupStagedMedia(next);dirty=false;updateBar();
      try{localStorage.setItem('biggestFanArchiveVisuals', JSON.stringify({theme:next.theme,layout:next.layout,accent:next.accent,background:next.background,text:next.text,title:next.title,subtitle:next.subtitle,description:next.description,image:next.image,mobileImage:next.mobileImage,songLayout:next.songLayout,songCardPadding:next.songCardPadding}));}catch(_){}
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
  $('saveVisualSettings')?.addEventListener('click',()=>{
    window.archiveMarkDirty();sendPreview();
    $('visualStatus').textContent='Visual changes staged and shown in the preview. Use “Publish all changes” to go live.';
  });
  $('publishAll')?.addEventListener('click',async event=>{
    const button=event.currentTarget,text=$('publishBarText');button.disabled=true;text.textContent='Publishing…';
    const ok=await save();button.disabled=false;
    text.textContent=ok?'Unpublished changes':($('contentStatus').textContent||'Could not publish.');
  });
  $('discardStaged')?.addEventListener('click',async()=>{
    if(!confirm('Discard all unpublished changes? Files uploaded since your last publish will be removed.'))return;
    const text=$('publishBarText');text.textContent='Discarding…';
    try{
      const content=await readLatestContent(),stg=window.archiveStaging;
      for(const path of stg.uploads){try{await window.archiveGitHub.delete(path,'Remove unpublished upload');}catch(_){}}
      stg.uploads.clear();stg.deletes.clear();
      fillFields(content);
      window.dispatchEvent(new CustomEvent('archive-github-content-loaded',{detail:{content:cloud}}));
      window.dispatchEvent(new CustomEvent('archive-visual-settings-changed',{detail:cloud}));
      dirty=false;updateBar();sendPreview();
    }catch(error){text.textContent=error.message||'Could not discard changes.';}
  });
  let kissOffers=[];
  function parseKissOffer(message){const value=String(message||'');const head=value.match(/^\[KISS OFFER · (\d+) KISSES\]\s*/);const ref=value.match(/\[OFFER REF: ([^\]]+)\]/)?.[1]||'';return{amount:Math.floor(Number(head?.[1])||0),ref,request:value.replace(/^\[KISS OFFER · \d+ KISSES\]\s*/,'').replace(/^\[OFFER REF: [^\]]+\]\s*/,'').trim()};}
  async function loadKissOffers(){
    const root=$('adminKissOfferList');if(!root||!db)return;root.replaceChildren();
    const {data,error}=await db.from('archive_comments').select('id,display_name,message,approved,created_at').order('created_at',{ascending:false}).limit(200);
    if(error){root.textContent='Unable to load offers. Check the admin database connection.';$('kissOfferModerationStatus').textContent='Offers could not be loaded.';return;}
    kissOffers=(data||[]).filter(item=>String(item.message||'').startsWith('[KISS OFFER · '));renderKissOffers();
  }
  function renderKissOffers(){
    const root=$('adminKissOfferList');if(!root)return;root.replaceChildren();const search=($('kissOfferSearch')?.value||'').trim().toLowerCase(),filter=$('kissOfferStatusFilter')?.value||'all';
    const visible=kissOffers.filter(offer=>{const accepted=Boolean(offer.approved),text=`${offer.display_name} ${offer.message}`.toLowerCase();return(filter==='all'||(filter==='accepted'?accepted:!accepted))&&(!search||text.includes(search));});
    const count=$('kissOfferCount');if(count)count.textContent=`${visible.length} OF ${kissOffers.length} OFFERS · ${kissOffers.filter(item=>!item.approved).length} PENDING`;
    if(!visible.length){const empty=document.createElement('div');empty.className='admin-empty';empty.textContent=kissOffers.length?'No offers match this filter.':'No kiss offers yet.';root.append(empty);return;}
    visible.forEach(offer=>{const parsed=parseKissOffer(offer.message);const row=document.createElement('article');row.className='admin-item kiss-offer-admin-item';row.dataset.status=offer.approved?'accepted':'pending';const body=document.createElement('div');body.className='admin-item-copy';const title=document.createElement('strong');title.className='admin-item-title';title.textContent=`${offer.display_name||'Visitor'} · ${parsed.amount||'?'} KISSES · ${offer.approved?'ACCEPTED':'PENDING'}`;const request=document.createElement('p');request.className='admin-item-text';request.textContent=parsed.request;const date=document.createElement('small');date.className='admin-item-meta';date.textContent=new Date(offer.created_at).toLocaleString();body.append(title,request,date);row.append(body);const actions=document.createElement('div');actions.className='admin-item-actions';
      if(!offer.approved){const accept=mkButton('Accept & list item',async()=>{accept.disabled=true;const status=$('kissOfferModerationStatus');const listingId=`accepted-offer-${String(offer.id).replace(/[^a-zA-Z0-9_-]/g,'')}`;let listings=cloud.marketItems||[];if(!listings.some(item=>item.id===listingId)){if(listings.length>=100){status.textContent='The market already has 100 listings. Remove one before accepting this offer.';accept.disabled=false;return;}const titleText=parsed.request.slice(0,70)||`Offer from ${offer.display_name||'visitor'}`;listings=[...listings,{id:listingId,title:titleText,description:parsed.request.slice(0,240),type:'item',kissCost:parsed.amount||1,active:true,offerRef:parsed.ref}];stageMarketItems(listings,'Accepted offer listing staged. Publishing the listing…');}const published=await save();if(!published){status.textContent='The listing is staged but could not be published. Connect GitHub, then publish the staged changes before accepting this offer.';accept.disabled=false;return;}const result=await db.from('archive_comments').update({approved:true}).eq('id',offer.id);if(result.error){status.textContent='The market listing is live, but the offer status could not be updated. Try Accept & list item again.';accept.disabled=false;return;}status.textContent=parsed.ref?'Offer accepted, listed in the market, and ready to notify its visitor.':'Offer listed and accepted. This older offer has no visitor notification link.';await loadKissOffers();},false,`Accept offer from ${offer.display_name} and list it in the market`);actions.append(accept);}
      else{const reopen=mkButton('Mark pending',async()=>{reopen.disabled=true;const result=await db.from('archive_comments').update({approved:false}).eq('id',offer.id);if(result.error){$('kissOfferModerationStatus').textContent='Could not reopen the offer.';reopen.disabled=false;return;}$('kissOfferModerationStatus').textContent='Offer moved back to pending.';await loadKissOffers();},false,`Move offer from ${offer.display_name} back to pending`);actions.append(reopen);}
      const decline=mkButton('Decline',async()=>{if(!confirm('Decline and remove this offer?'))return;decline.disabled=true;const result=await db.from('archive_comments').delete().eq('id',offer.id);if(result.error){$('kissOfferModerationStatus').textContent='Could not decline the offer.';decline.disabled=false;return;}$('kissOfferModerationStatus').textContent='Offer declined and removed.';await loadKissOffers();},true,`Decline offer from ${offer.display_name}`);actions.append(decline);row.append(actions);root.append(row);
    });
  }
  $('kissOfferSearch')?.addEventListener('input',renderKissOffers);$('kissOfferStatusFilter')?.addEventListener('change',renderKissOffers);
  window.addEventListener('archive-auth-ready', async()=>{db=window.archiveSupabase; await load();await loadKissOffers();});
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
    const visualDefaults={theme:'noir',layout:'left',accent:'#5f73a5',background:'#ffffff',text:'#090a0c',title:'רואי',subtitle:'A study of ordinary days.','description':'Light shifts across familiar places. A song returns with the weather.',image:'',mobileImage:''};
    cloud={...cloud,...visualDefaults};
    window.dispatchEvent(new CustomEvent('archive-visual-settings-changed',{detail:visualDefaults}));
    window.archiveMarkDirty();sendPreview();$('visualStatus').textContent='Visual defaults loaded. Publish all changes to apply them.';
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

/* Expandable admin sections for faster navigation. */
(() => {
  const app=document.getElementById('adminApp');
  if(!app)return;
  const panels=[...app.querySelectorAll('.admin-panel, .photo-post-manager')];
  const initiallyCollapsed=new Set(['.github-storage-panel','#pageEditor','#visualManager','#pageContentManager','#noiseManager','#backupManager','.photo-post-manager']);
  const controls=[];
  panels.forEach((panel,index)=>{
    const heading=panel.querySelector(':scope > .panel-heading');
    if(!heading)return;
    const title=heading.querySelector('h2,h3')?.textContent.trim()||`Section ${index+1}`;
    const body=document.createElement('div');
    body.className='admin-panel-content';
    body.id=`${panel.id||'admin-subsection'}Content`;
    [...panel.children].slice([...panel.children].indexOf(heading)+1).forEach(child=>body.append(child));
    panel.append(body);
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='admin-panel-toggle';
    toggle.setAttribute('aria-controls',body.id);
    const initiallyOpen=!([...initiallyCollapsed].some(selector=>panel.matches(selector)));
    const setOpen=open=>{
      body.hidden=!open;
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',`${open?'Collapse':'Expand'} ${title}`);
      toggle.textContent=open?'−':'+';
    };
    setOpen(initiallyOpen);
    toggle.addEventListener('click',()=>setOpen(body.hidden));
    heading.append(toggle);
    controls.push(setOpen);
  });
  document.getElementById('expandAdminSections')?.addEventListener('click',()=>controls.forEach(setOpen=>setOpen(true)));
  document.getElementById('collapseAdminSections')?.addEventListener('click',()=>controls.forEach(setOpen=>setOpen(false)));
})();
