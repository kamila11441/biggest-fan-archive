(() => {

  // Apply saved visual editor settings on the public page too.
  try {
    const v=JSON.parse(localStorage.getItem('biggestFanArchiveVisuals')||'null');
    if(v){
      document.body.dataset.theme=v.theme==='noir'?'noir':(v.theme||'noir');
      document.body.dataset.layout=v.layout||'center';
      const root=document.documentElement;
      if(v.accent)root.style.setProperty('--rose',v.accent);
      if(v.background)root.style.setProperty('--paper',v.background);
      if(v.text)root.style.setProperty('--ink',v.text);
      const title=document.querySelector('.hero h1');
      if(title){title.textContent=v.title||'רואי';title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title||'')?'he':'en');}
      const subtitle=document.querySelector('.hero-subtitle');if(subtitle)subtitle.textContent=v.subtitle||'';
      const description=document.querySelector('.hero-description');if(description)description.textContent=v.description||'';
      const image=document.querySelector('.hero-image');
      if(image&&v.image){image.style.backgroundImage=`linear-gradient(90deg,#0007,transparent),url("${String(v.image).replace(/"/g,'%22')}")`;image.style.backgroundSize='cover';image.style.backgroundPosition='center';}
      const logo=document.querySelector('.logo [lang="he"]');if(logo)logo.textContent=v.title||'רואי';
      document.title=(v.title||'רואי')+' — Biggest Fan Archive';
    }
  } catch (_) {}

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  document.querySelectorAll('[data-gallery-filter]').forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.galleryFilter;
    document.querySelectorAll('[data-gallery-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('.gallery-item[data-category]').forEach(item => { item.hidden = filter !== 'all' && item.dataset.category !== filter; });
  }));
  const featureTrack = document.getElementById('featureTrack');
  document.querySelectorAll('[data-reel-move]').forEach(button => button.addEventListener('click', () => {
    if (!featureTrack) return;
    const card = featureTrack.querySelector('.feature-card');
    const gap = parseFloat(getComputedStyle(featureTrack).gap) || 0;
    featureTrack.scrollBy({ left: Number(button.dataset.reelMove) * ((card?.getBoundingClientRect().width || featureTrack.clientWidth) + gap), behavior: 'smooth' });
  }));
  document.getElementById('year').textContent = new Date().getFullYear();

  const revealTargets = document.querySelectorAll('.section-label, .intro-copy, .quality, .gallery-item, .note, .guestbook-form, .guest-note');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    revealTargets.forEach(el => { el.classList.add('will-reveal'); observer.observe(el); });
  }

  const form = document.getElementById('guestbookForm');
  const nameField = document.getElementById('guestName');
  const messageField = document.getElementById('guestMessage');
  const count = document.getElementById('charCount');
  const status = document.getElementById('formStatus');
  const list = document.getElementById('guestbookList');
  const key = 'biggestFanArchiveNotes';
  messageField.addEventListener('input', () => count.textContent = `${messageField.value.length} / 240`);

  function makeNote(name, message, saved = false) {
    const article = document.createElement('article'); article.className = 'guest-note';
    const avatar = document.createElement('span'); avatar.className = 'note-avatar'; avatar.textContent = (name[0] || '•').toUpperCase();
    const body = document.createElement('div'), meta = document.createElement('div');
    meta.className = 'guest-meta';
    const strong = document.createElement('strong'); strong.textContent = name;
    const time = document.createElement('time'); time.textContent = saved ? 'saved in this browser' : 'just now';
    const p = document.createElement('p'); p.textContent = message;
    meta.append(strong, time); body.append(meta, p); article.append(avatar, body);
    return article;
  }
  let saved = [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(value)) saved = value.filter(x => x && typeof x.name === 'string' && typeof x.message === 'string').slice(0, 20);
  } catch (_) {}
  saved.slice().reverse().forEach(item => list.prepend(makeNote(item.name, item.message, true)));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameField.value.trim().replace(/\s+/g, ' ').slice(0, 32);
    const message = messageField.value.trim().slice(0, 240);
    if (!name || !message) { status.textContent = 'Add your name and a note first.'; return; }
    list.prepend(makeNote(name, message));
    saved = [{ name, message, at: Date.now() }, ...saved].slice(0, 20);
    try { localStorage.setItem(key, JSON.stringify(saved)); status.textContent = 'Your note has been saved in this browser.'; }
    catch (_) { status.textContent = 'Your note is visible for now, but could not be saved on this device.'; }
    form.reset(); count.textContent = '0 / 240';
  });

  const dialog = document.getElementById('lightbox');
  const art = document.getElementById('lightboxArt');
  const caption = document.getElementById('lightboxCaption');
  document.querySelectorAll('.gallery-item').forEach(item => item.addEventListener('click', () => {
    const source = item.querySelector('.gallery-art');
    art.style.background = getComputedStyle(source).background;
    caption.textContent = item.dataset.caption || 'A little moment.';
    if (dialog.showModal) dialog.showModal();
  }));
  document.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });


})();

/* Shared Supabase content and comment integration. */

(() => {
  if (!window.archiveBackendReady?.() || !window.supabase?.createClient) return;
  const c=window.ARCHIVE_BACKEND, db=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);
  const $=id=>document.getElementById(id);
  let adminPreviewActive=false;
  const fallback={navAbout:'About',navMoments:'Work',navNotes:'Notes',navGuestbook:'Contact',aboutHeading:'A record of ordinary days.',aboutLead:'Everyday life leaves its marks in unexpected places.',momentsHeading:'Selected frames.',momentsIntro:'Photographs and fragments from the archive.',galleryImages:['','','','',''],footerText:'A personal archive of photographs, music, and notes.'};
  function text(selector,value){const el=document.querySelector(selector);if(el&&typeof value==='string'&&value.trim())el.textContent=value;}
  function apply(data){if(!data)return;
    const v={...fallback,...data};
    const nav=document.querySelectorAll('.nav a'); [v.navAbout,v.navMoments,v.navNotes,v.navGuestbook].forEach((x,i)=>{if(nav[i])nav[i].textContent=x;});
    text('.intro-title h2',v.aboutHeading); text('.intro-copy .lead',v.aboutLead); text('.section-heading h2',v.momentsHeading); text('.section-heading p',v.momentsIntro); text('.footer>p',v.footerText);
    const body=document.querySelector('.intro-copy'); if(body&&Array.isArray(v.aboutBody)){body.replaceChildren(...v.aboutBody.map(p=>{const el=document.createElement('p');el.textContent=p;return el;}));} else if(body&&typeof v.aboutBody==='string'&&v.aboutBody.trim()){const paras=v.aboutBody.split(/\n\s*\n/); const lead=body.querySelector('.lead'); body.replaceChildren(); if(lead)body.append(lead); paras.forEach((p,i)=>{if(i===0&&p===v.aboutLead)return;const el=document.createElement('p');el.textContent=p;body.append(el);});}
    if(Array.isArray(v.galleryCaptions))document.querySelectorAll('.gallery-item').forEach((el,i)=>{if(v.galleryCaptions[i]){el.dataset.caption=v.galleryCaptions[i];const strong=el.querySelector('.gallery-caption strong');if(strong)strong.textContent=v.galleryCaptions[i];}});
    if(Array.isArray(v.galleryImages))document.querySelectorAll('.gallery-item').forEach((el,i)=>{
      const art=el.querySelector('.gallery-art'),raw=v.galleryImages[i];if(!art)return;if(typeof raw!=='string'||!raw.trim()){art.style.backgroundImage='';art.style.backgroundSize='';return;}
      try{const image=new URL(raw);if(image.protocol!=='https:'||!image.hostname||image.username||image.password)throw new Error();art.style.backgroundImage=`linear-gradient(#0001,#0001),url("${image.href.replace(/"/g,'%22')}")`;art.style.backgroundSize='cover';art.style.backgroundPosition='center';}
      catch(_){art.style.backgroundImage='';art.style.backgroundSize='';}
    });
    if(Array.isArray(v.notes))document.querySelectorAll('.note-list .note').forEach((el,i)=>{const n=v.notes[i];if(n){const h=el.querySelector('h3'),p=el.querySelector('p');if(h)h.textContent=n.title||'';if(p)p.textContent=n.text||'';}});
    if(Array.isArray(v.qualities))document.querySelectorAll('.qualities .quality p').forEach((el,i)=>{if(v.qualities[i])el.textContent=v.qualities[i];});
    const root=document.documentElement; if(v.accent)root.style.setProperty('--rose',v.accent);if(v.background)root.style.setProperty('--paper',v.background);if(v.text)root.style.setProperty('--ink',v.text);
    document.body.dataset.theme=v.theme||'editorial';document.body.dataset.layout=v.layout||'left';
    const title=document.querySelector('.hero h1');if(title&&v.title){title.textContent=v.title;title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title)?'he':'en');}
    const logo=document.querySelector('.logo [lang="he"]');if(logo&&v.title)logo.textContent=v.title;
    text('.hero-subtitle',v.subtitle);text('.hero-description',v.description);
    const hero=document.querySelector('.hero-image');
    if(hero){if(typeof v.image!=='string'||!v.image.trim()){hero.style.backgroundImage='';hero.style.backgroundSize='';}else try{const image=new URL(v.image);if(image.protocol!=='https:'||!image.hostname||image.username||image.password)throw new Error();hero.style.backgroundImage=`linear-gradient(90deg,#0007,transparent),url("${image.href.replace(/"/g,'%22')}")`;hero.style.backgroundSize='cover';hero.style.backgroundPosition='center';}catch(_){hero.style.backgroundImage='';hero.style.backgroundSize='';}}
    document.title=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function ensureCollectionSections(){
    const moments=document.querySelector('#moments');
    if(moments&&!document.getElementById('songsSection')){const sec=document.createElement('section');sec.id='songsSection';sec.className='section archive-collection';sec.innerHTML='<div class="section-label"><span>03</span><span>AUDIO INDEX</span></div><div class="section-heading"><h2>Soundtrack.</h2><p>Tracks and listening notes from the archive.</p></div><div id="publicSongs" class="archive-song-grid"></div>';moments.after(sec);}
    const notes=document.querySelector('#notes');
    if(notes&&!document.getElementById('thoughtsSection')){const sec=document.createElement('section');sec.id='thoughtsSection';sec.className='section archive-collection';sec.innerHTML='<div class="section-label"><span>04</span><span>TEXT INDEX</span></div><div class="section-heading"><h2>Notes.</h2><p>Short observations, gathered along the way.</p></div><div id="publicThoughts" class="archive-thought-grid"></div>';notes.after(sec);}
  }
  function safeEmbedUrl(value){try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&((url.hostname==='open.spotify.com'&&url.pathname.startsWith('/embed/'))||(url.hostname==='www.youtube-nocookie.com'&&url.pathname.startsWith('/embed/'))))return url.href;}catch(_){}return null;}
  function renderSongs(items){ensureCollectionSections();const root=$('publicSongs');if(!root)return;root.replaceChildren();(items||[]).forEach(song=>{const embed=safeEmbedUrl(song.embed);if(!embed)return;const card=document.createElement('article');card.className='archive-song';const label=document.createElement('h3');label.textContent=song.label||song.title||'A song for you';const frame=document.createElement('iframe');frame.src=embed;frame.title=label.textContent;frame.loading='lazy';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.width='100%';frame.style.border='0';frame.style.borderRadius='12px';frame.style.minHeight=song.kind==='spotify'?'152px':'190px';card.append(label,frame);root.append(card);});if(!items?.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='The soundtrack is waiting for its first song.';root.append(p);}}
  function renderThoughts(items){ensureCollectionSections();const root=$('publicThoughts');if(!root)return;root.replaceChildren();(items||[]).forEach(t=>{const card=document.createElement('article');card.className='archive-thought';const mark=document.createElement('span');mark.className='archive-thought-index';mark.textContent='—';const p=document.createElement('p');p.textContent=t.text;card.append(mark,p);root.append(card);});if(!items?.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='A few observations are waiting to be added.';root.append(p);}}
  async function loadContent(){const {data}=await db.from('archive_content').select('content').eq('id',true).maybeSingle();if(adminPreviewActive)return;if(data?.content){apply(data.content);renderSongs(data.content.songs||[]);renderThoughts(data.content.thoughts||[]);}else{renderSongs([]);renderThoughts([]);}}
  window.addEventListener('message',event=>{
    if(window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='biggest-fan-admin-preview')return;
    const content=event.data.content;if(!content||typeof content!=='object')return;
    adminPreviewActive=true;
    apply(content);renderSongs(content.songs||[]);renderThoughts(content.thoughts||[]);
  });
  function makeComment(c){const article=document.createElement('article');article.className='guest-note';const avatar=document.createElement('span');avatar.className='note-avatar';avatar.textContent=(c.display_name?.[0]||'•').toUpperCase();const body=document.createElement('div'),meta=document.createElement('div');meta.className='guest-meta';const name=document.createElement('strong');name.textContent=c.display_name;const time=document.createElement('time');time.textContent=new Date(c.created_at).toLocaleDateString();const msg=document.createElement('p');msg.textContent=c.message;meta.append(name,time);body.append(meta,msg);article.append(avatar,body);return article;}
  async function loadComments(){const list=$('guestbookList');if(!list)return;const {data,error}=await db.from('archive_comments').select('id,display_name,message,created_at').eq('approved',true).order('created_at',{ascending:false}).limit(30);if(error)return;list.replaceChildren();(data||[]).forEach(c=>list.append(makeComment(c)));}
  document.addEventListener('DOMContentLoaded',()=>{
    loadContent();loadComments();
    const form=$('guestbookForm');if(!form)return;
    form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const name=$('guestName').value.trim().replace(/\s+/g,' ').slice(0,32),message=$('guestMessage').value.trim().slice(0,240),status=$('formStatus');if(!name||!message)return;
      const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;status.textContent='Sending your note for review…';
      const {error}=await db.from('archive_comments').insert({display_name:name,message,approved:false});if(button)button.disabled=false;
      if(error){status.textContent='Could not send the note. Please try again later.';return;}form.reset();$('charCount').textContent='0 / 240';status.textContent='Thank you — your note was sent for approval.';
    },true);
    if(window.parent!==window)window.parent.postMessage({type:'biggest-fan-preview-ready'},location.origin==='null'?'*':location.origin);
  });
})();
