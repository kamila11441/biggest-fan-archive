/* Shared helpers */
function setLines(el,str){el.replaceChildren();String(str).split('\n').forEach((line,i)=>{if(i)el.append(document.createElement('br'));el.append(document.createTextNode(line));});}
function heroCssUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?`url("${u.href.replace(/"/g,'%22')}")`:'none';}catch(_){return 'none';}}
function retryMedia(el,max=6){const src=el.getAttribute('src');let n=0;if(!src)return;el.addEventListener('error',()=>{if(n>=max)return;n++;setTimeout(()=>{el.src=src+(src.includes('?')?'&':'?')+'r='+n;},15000);});}

(() => {

  // Apply saved visual editor settings on the public page too.
  try {
    const v=JSON.parse(localStorage.getItem('biggestFanArchiveVisuals')||'null');
    if(v){
      document.body.dataset.theme=v.theme==='noir'?'noir':(v.theme||'noir');
      document.body.dataset.layout=v.layout||'center';
      document.body.dataset.songLayout=v.songLayout==='grid'?'grid':'masonry';
      const root=document.documentElement;
      if(v.accent)root.style.setProperty('--rose',['#778173','#2456d7','#315bff'].includes(v.accent.toLowerCase())?'#5f73a5':v.accent);
      root.style.setProperty('--song-card-padding',`${Math.max(12,Math.min(32,Number(v.songCardPadding)||24))}px`);
      const title=document.querySelector('.hero h1');
      if(title){title.textContent=v.title||'רואי';title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title||'')?'he':'en');}
      const subtitle=document.querySelector('.hero-subtitle');if(subtitle)subtitle.textContent=v.subtitle||'';
      const description=document.querySelector('.hero-description');if(description)setLines(description,v.description||'');root.style.setProperty('--hero-mobile-image',heroCssUrl(v.mobileImage));
      const image=document.querySelector('.hero-image');
      if(image&&v.image){image.style.backgroundImage=`url("${String(v.image).replace(/"/g,'%22')}")`;image.style.backgroundSize='cover';image.style.backgroundPosition='center';image.setAttribute('aria-label','Main photograph from the personal archive');}
      else if(image)image.setAttribute('aria-label','Abstract blue and white hero artwork');
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
  document.getElementById('year').textContent = new Date().getFullYear();

  let revealObserver=null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); revealObserver.unobserve(entry.target); }
    }), { threshold: .12 });
  }
  window.archiveReveal=(root=document)=>{if(!revealObserver)return;root.querySelectorAll?.('.section-label, .section-heading, .intro-copy, .quality, .blog-post, .archive-song, .archive-noise, .archive-thought, .note, .guestbook-form, .guest-note').forEach(el=>{if(el.classList.contains('will-reveal'))return;el.classList.add('will-reveal');revealObserver.observe(el);});};
  window.archiveReveal();

  const pageSections=[...document.querySelectorAll('main section[id]')];
  const sectionLinks=[...document.querySelectorAll('.nav a[href^="#"]')];
  if('IntersectionObserver' in window&&pageSections.length){
    const sectionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      sectionLinks.forEach(link=>{
        const active=link.hash==='#'+entry.target.id;
        if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
      });
    }),{rootMargin:'-24% 0px -62% 0px',threshold:0});
    pageSections.forEach(section=>sectionObserver.observe(section));
  }
  let scrollFrame=0;
  const updateScrollMotion=()=>{
    if(scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{
      const maxScroll=document.documentElement.scrollHeight-innerHeight;
      document.documentElement.style.setProperty('--scroll-progress',maxScroll>0?String(scrollY/maxScroll):'0');
      const hero=document.querySelector('.hero-content');
      if(hero&&matchMedia('(prefers-reduced-motion: no-preference)').matches)hero.style.setProperty('--hero-shift',`${Math.min(scrollY*.08,28)}px`);
      scrollFrame=0;
    });
  };
  addEventListener('scroll',updateScrollMotion,{passive:true});
  addEventListener('resize',updateScrollMotion,{passive:true});
  updateScrollMotion();

  const form = document.getElementById('guestbookForm');
  const nameField = document.getElementById('guestName');
  const messageField = document.getElementById('guestMessage');
  const count = document.getElementById('charCount');
  const status = document.getElementById('formStatus');
  const list = document.getElementById('guestbookList');
  messageField.addEventListener('input', () => count.textContent = `${messageField.value.length} / 240`);

  const dialog = document.getElementById('photoLightbox');
  const lightboxImage = document.getElementById('photoLightboxImage');
  const lightboxCaption = document.getElementById('photoLightboxCaption');
  document.getElementById('blogPosts')?.addEventListener('click', event => {
    const button = event.target.closest('.blog-photo-button');
    if (!button || !dialog?.showModal) return;
    lightboxImage.src = button.dataset.photo;
    lightboxImage.alt = button.dataset.alt || button.dataset.caption || 'Photo journal image';
    lightboxCaption.textContent = button.dataset.caption || '';
    dialog.showModal();
  });
  document.querySelector('.lightbox-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });


})();

/* Shared Supabase content and comment integration. */

(() => {
  const backendReady=Boolean(window.archiveBackendReady?.()&&window.supabase?.createClient);
  const c=window.ARCHIVE_BACKEND, db=backendReady?window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey):null;
  const $=id=>document.getElementById(id);
  let adminPreviewActive=false;
  const fallback={navAbout:'About',navMoments:'Journal',navNotes:'Notes',navGuestbook:'Contact',aboutHeading:'A record of ordinary days.',aboutLead:'Everyday life leaves its marks in unexpected places.',momentsHeading:'Photo journal.',momentsIntro:'Images, captions, and dates. One entry at a time.',blogPosts:[],footerText:'A personal archive of photographs, music, and notes.'};
  function text(selector,value){const el=document.querySelector(selector);if(el&&typeof value==='string'&&value.trim())el.textContent=value;}
  function validPhotoUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:null;}catch(_){return null;}}
  function legacyPosts(v){if(Array.isArray(v.blogPosts)&&v.blogPosts.length)return v.blogPosts;const images=v.galleryImages||[],captions=v.galleryCaptions||[];const migrated=images.map((image,i)=>({id:`legacy-${i}`,image,path:'',caption:captions[i]||'From the archive',date:''})).filter(post=>validPhotoUrl(post.image));return migrated.length?migrated:(Array.isArray(v.blogPosts)?v.blogPosts:[]);}
  const BLOG_PAGE=9;
  function renderBlogPosts(posts,order){
    const root=$('blogPosts');if(!root)return;root.replaceChildren();
    const more=$('blogMore'),moreBtn=$('blogMoreButton');if(more)more.hidden=true;
    let ordered=(posts||[]).filter(post=>post&&validPhotoUrl(post.image));
    if(order!=='manual')ordered=[...ordered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(!ordered.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='Photo posts will appear here.';root.append(empty);return;}
    let shown=0;
    const build=(post,index)=>{
      const article=document.createElement('article');article.className=`blog-post${index===0?' blog-post-featured':''}`;article.dataset.postId=String(post.id||'');
      if(post.id)article.id='post-'+String(post.id).replace(/[^\w-]/g,'');
      const figure=document.createElement('figure');figure.className='blog-figure';
      const alt=post.alt||post.caption||'Photo journal image';
      const zoom=document.createElement('button');zoom.type='button';zoom.className='blog-photo-button';zoom.dataset.photo=validPhotoUrl(post.image);zoom.dataset.caption=post.caption||'';zoom.dataset.alt=post.alt||'';zoom.setAttribute('aria-label',`Open photo: ${post.caption||'Photo journal image'}`);
      const image=document.createElement('img');image.src=validPhotoUrl(post.image);image.alt=alt;image.loading='lazy';image.decoding='async';retryMedia(image);zoom.append(image);figure.append(zoom);
      const copy=document.createElement('div');copy.className='blog-post-copy';const date=document.createElement('time');date.className='blog-post-date';
      if(/^\d{4}-\d{2}-\d{2}$/.test(post.date||'')){date.dateTime=post.date;date.textContent=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(`${post.date}T12:00:00Z`));}else date.textContent='FROM THE ARCHIVE';
      const caption=document.createElement('h3');caption.textContent=post.caption||'Untitled photo';copy.append(date,caption);article.append(figure,copy);
      return article;
    };
    const showMore=()=>{
      const next=ordered.slice(shown,shown+BLOG_PAGE),firstNew=shown;
      next.forEach((post,i)=>root.append(build(post,shown+i)));shown+=next.length;
      window.archiveReveal(root);
      if(more)more.hidden=shown>=ordered.length;
      if(moreBtn)moreBtn.textContent=`Load more entries (${ordered.length-shown} left)`;
      if(firstNew>0)root.children[firstNew]?.querySelector('.blog-photo-button')?.focus({preventScroll:true});
    };
    if(moreBtn)moreBtn.onclick=showMore;
    showMore();
  }
  function apply(data){if(!data)return;
    const v={...fallback,...data};
    if(['Work','Moments'].includes(v.navMoments))v.navMoments='Journal';
    if(v.momentsHeading==='Selected frames.')v.momentsHeading='Photo journal.';
    if(v.momentsIntro==='Photographs and fragments from the archive.')v.momentsIntro='Images, captions, and dates. One entry at a time.';
    const navLabels={'#about':v.navAbout,'#moments':v.navMoments,'#notes':v.navNotes,'#guestbook':v.navGuestbook};document.querySelectorAll('.nav a').forEach(link=>{if(navLabels[link.hash])link.textContent=navLabels[link.hash];});
    text('.intro-title h2',v.aboutHeading); text('.intro-copy .lead',v.aboutLead); if(v.momentsHeading&&v.momentsHeading!=='Photo journal.')text('#journalHeading',v.momentsHeading); text('.journal-heading>p',v.momentsIntro); text('.footer>p',v.footerText);renderBlogPosts(legacyPosts(v),v.journalOrder);
    const body=document.querySelector('.intro-copy'); if(body&&Array.isArray(v.aboutBody)){body.replaceChildren(...v.aboutBody.map((p,i,all)=>{const el=document.createElement('p');el.textContent=p;if(i===all.length-1&&all.length>1)el.className='signature';return el;}));} else if(body&&typeof v.aboutBody==='string'&&v.aboutBody.trim()){const paras=v.aboutBody.split(/\n\s*\n/); const lead=body.querySelector('.lead'); body.replaceChildren(); if(lead)body.append(lead); paras.forEach((p,i)=>{if(i===0&&p===v.aboutLead)return;const el=document.createElement('p');el.textContent=p;if(i===paras.length-1&&paras.length>1)el.className='signature';body.append(el);});}
    const root=document.documentElement; if(v.accent)root.style.setProperty('--rose',['#778173','#2456d7','#315bff'].includes(v.accent.toLowerCase())?'#5f73a5':v.accent);
    document.body.dataset.theme=v.theme||'editorial';document.body.dataset.layout=v.layout||'left';document.body.dataset.songLayout=v.songLayout==='grid'?'grid':'masonry';
    root.style.setProperty('--song-card-padding',`${Math.max(12,Math.min(32,Number(v.songCardPadding)||24))}px`);
    const title=document.querySelector('.hero h1');if(title&&v.title){title.textContent=v.title;title.setAttribute('lang',/[\u0590-\u05FF]/.test(v.title)?'he':'en');}
    const logo=document.querySelector('.logo [lang="he"]');if(logo&&v.title)logo.textContent=v.title;
    {const s=document.querySelector('.hero-subtitle');if(s&&typeof v.subtitle==='string')s.textContent=v.subtitle;const d=document.querySelector('.hero-description');if(d&&typeof v.description==='string')setLines(d,v.description);}
    const hero=document.querySelector('.hero-image');
    if(hero){if(typeof v.image!=='string'||!v.image.trim()){hero.style.backgroundImage='';hero.style.backgroundSize='';hero.setAttribute('aria-label','Abstract blue and white hero artwork');}else try{const image=new URL(v.image);if(image.protocol!=='https:'||!image.hostname||image.username||image.password)throw new Error();hero.style.backgroundImage=`url("${image.href.replace(/"/g,'%22')}")`;hero.style.backgroundSize='cover';hero.style.backgroundPosition='center';hero.setAttribute('aria-label','Main photograph from the personal archive');}catch(_){hero.style.backgroundImage='';hero.style.backgroundSize='';hero.setAttribute('aria-label','Abstract blue and white hero artwork');}}
    window.archiveSetKissMessages?.((Array.isArray(v.kissMessages)?v.kissMessages:[]).map(m=>String(m).trim()).filter(Boolean).slice(0,60));
    document.documentElement.style.setProperty('--hero-mobile-image',heroCssUrl(v.mobileImage));
    document.title=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function ensureCollectionSections(){
    const moments=document.querySelector('#moments');
    if(moments&&!document.getElementById('publicSongs')){const sec=document.createElement('section');sec.id='songsSection';sec.className='section archive-collection songs-section';sec.innerHTML='<div class="section-label"><span>03</span><span>AUDIO INDEX</span></div><div class="section-heading"><h2>Soundtrack.</h2><p>Tracks and listening notes from the archive.</p></div><div id="publicSongs" class="archive-song-grid" aria-live="polite"></div>';moments.after(sec);}
    if(!document.getElementById('publicNoises')){const sec=document.createElement('section');sec.id='noises';sec.className='section archive-collection noises-section';sec.innerHTML='<div class="section-label"><span>04</span><span>FIELD RECORDINGS</span></div><div class="section-heading"><h2>Noises.</h2><p>Small sounds, saved as voice notes.</p></div><div id="publicNoises" class="archive-noise-list" aria-live="polite"></div>';const songs=document.getElementById('songsSection');(songs||moments)?.after(sec);}
    if(!document.getElementById('publicThoughts')){const sec=document.createElement('section');sec.id='notes';sec.className='section archive-collection';sec.innerHTML='<div class="section-label"><span>05</span><span>TEXT INDEX</span></div><div class="section-heading"><h2>Notes.</h2><p>Short observations, gathered along the way.</p></div><div id="publicThoughts" class="archive-thought-grid"></div>';const noises=document.getElementById('noises');(noises||document.getElementById('songsSection')||moments)?.after(sec);}
  }
  function safeEmbedUrl(value){try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&((url.hostname==='open.spotify.com'&&url.pathname.startsWith('/embed/'))||(url.hostname==='www.youtube-nocookie.com'&&url.pathname.startsWith('/embed/'))))return url.href;}catch(_){}return null;}
  function renderSongs(items){ensureCollectionSections();const root=$('publicSongs');if(!root)return;root.replaceChildren();(items||[]).forEach(song=>{const embed=safeEmbedUrl(song.embed);if(!embed)return;const card=document.createElement('article');card.className='archive-song';const label=document.createElement('h3');label.textContent=song.label||song.title||'A song for you';const frame=document.createElement('iframe');frame.src=embed;frame.title=label.textContent;frame.loading='lazy';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.width='100%';frame.style.border='0';frame.style.borderRadius='12px';frame.style.minHeight=song.kind==='spotify'?'152px':'190px';card.append(frame,label);root.append(card);});if(!items?.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='The soundtrack is waiting for its first song.';root.append(p);}window.archiveReveal(root);}
  function safeAudioUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function renderNoises(items){ensureCollectionSections();const root=$('publicNoises');if(!root)return;root.replaceChildren();(items||[]).forEach(noise=>{const url=safeAudioUrl(noise.url);if(!url)return;const row=document.createElement('article');row.className='archive-noise';const icon=document.createElement('span');icon.className='noise-mark';icon.setAttribute('aria-hidden','true');icon.textContent='▂▅▇▅▃';const body=document.createElement('div');body.className='noise-content';const title=document.createElement('h3');title.textContent=noise.title||'Untitled recording';const caption=document.createElement('p');caption.className='noise-caption';caption.textContent=noise.caption||'';const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=url;retryMedia(player);player.setAttribute('aria-label','Play '+title.textContent);body.append(title);if(caption.textContent)body.append(caption);if(noise.date){const date=document.createElement('time');date.className='noise-date';date.dateTime=noise.date;date.textContent=noise.date;body.append(date);}body.append(player);row.append(icon,body);root.append(row);});if(!root.children.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='No sounds in the archive yet.';root.append(p);}window.archiveReveal(root);}
  let lastSurprise=-1;
  function setupSurprise(root,items){
    let row=document.getElementById('surpriseRow');
    if(!row){
      row=document.createElement('div');row.id='surpriseRow';row.className='fun-row';
      const button=document.createElement('button');button.type='button';button.id='surpriseNote';button.className='fun-button';button.textContent='Surprise me ✦';
      row.append(button);root.before(row);
      button.addEventListener('click',()=>{
        const cards=[...root.querySelectorAll('.archive-thought')];if(!cards.length)return;
        let i;do{i=Math.floor(Math.random()*cards.length);}while(cards.length>1&&i===lastSurprise);
        lastSurprise=i;cards.forEach(c=>c.classList.remove('spotlight'));
        const card=cards[i];card.classList.add('spotlight');
        const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
        card.tabIndex=-1;card.focus({preventScroll:true});
        clearTimeout(setupSurprise.timer);setupSurprise.timer=setTimeout(()=>card.classList.remove('spotlight'),6000);
      });
    }
    row.hidden=!items?.length;
  }
  function renderThoughts(items){ensureCollectionSections();const root=$('publicThoughts');if(!root)return;root.replaceChildren();(items||[]).forEach(t=>{const card=document.createElement('article');card.className='archive-thought';const mark=document.createElement('span');mark.className='archive-thought-index';mark.textContent='—';const p=document.createElement('p');p.textContent=t.text;card.append(mark,p);root.append(card);});if(!items?.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='A few observations are waiting to be added.';root.append(p);}setupSurprise(root,items);window.archiveReveal(root);}
  async function loadContent(){ensureCollectionSections();if(adminPreviewActive)return;try{const response=await fetch(new URL('archive-data.json',location.href),{cache:'no-store'});if(response.ok){const content=await response.json();if(content&&typeof content==='object'){apply(content);renderSongs(content.songs||[]);renderNoises(content.noises||[]);renderThoughts(content.thoughts||[]);return;}}}catch(error){console.warn('GitHub archive file is not available yet; using the initial Supabase copy.',error);}if(!db){renderSongs([]);renderNoises([]);renderThoughts([]);return;}try{const {data,error}=await db.from('archive_content').select('content').eq('id',true).maybeSingle();if(error)throw error;if(data?.content){apply(data.content);renderSongs(data.content.songs||[]);renderNoises(data.content.noises||[]);renderThoughts(data.content.thoughts||[]);}else{renderSongs([]);renderNoises([]);renderThoughts([]);}}catch(error){console.error('Could not load archive content:',error);renderSongs([]);renderNoises([]);renderThoughts([]);}}
  window.addEventListener('message',event=>{
    if(window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='biggest-fan-admin-preview')return;
    const content=event.data.content;if(!content||typeof content!=='object')return;
    adminPreviewActive=true;
    apply(content);renderSongs(content.songs||[]);renderNoises(content.noises||[]);renderThoughts(content.thoughts||[]);
  });
  function makeComment(c){const article=document.createElement('article');article.className='guest-note';const avatar=document.createElement('span');avatar.className='note-avatar';avatar.textContent=(c.display_name?.[0]||'•').toUpperCase();const body=document.createElement('div'),meta=document.createElement('div');meta.className='guest-meta';const name=document.createElement('strong');name.textContent=c.display_name;const time=document.createElement('time');time.textContent=new Date(c.created_at).toLocaleDateString();const msg=document.createElement('p');msg.textContent=c.message;meta.append(name,time);body.append(meta,msg);article.append(avatar,body);return article;}
  async function loadComments(){const list=$('guestbookList');if(!list||!db)return;const {data,error}=await db.from('archive_comments').select('id,display_name,message,created_at').eq('approved',true).order('created_at',{ascending:false}).limit(30);if(error)return;list.replaceChildren();(data||[]).forEach(c=>list.append(makeComment(c)));}
  const init=()=>{
    loadContent();loadComments();
    const form=$('guestbookForm');
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();
      const status=$('formStatus'),button=form.querySelector('button[type="submit"]');
      if(!db){status.textContent='Guestbook submissions are temporarily unavailable. Please try again later.';return;}
      if($('guestWebsite')?.value){form.reset();status.textContent='Thank you — your note was sent for approval.';return;}
      let last=0;try{last=Number(localStorage.getItem('archiveLastNote')||0);}catch(_){}
      if(Date.now()-last<60000){status.textContent='Please wait a minute before sending another note.';return;}
      const name=$('guestName').value.trim().replace(/\s+/g,' ').slice(0,32),message=$('guestMessage').value.trim().slice(0,240);
      if(!name||!message)return;
      if(button)button.disabled=true;status.textContent='Sending your note for review…';
      const {error}=await db.from('archive_comments').insert({display_name:name,message,approved:false});
      if(button)button.disabled=false;
      if(error){status.textContent='Could not send the note. Please try again later.';return;}
      try{localStorage.setItem('archiveLastNote',String(Date.now()));}catch(_){}
      form.reset();$('charCount').textContent='0 / 240';status.textContent='Thank you — your note was sent for approval.';
    });
    if(window.parent!==window)window.parent.postMessage({type:'biggest-fan-preview-ready'},location.origin==='null'?'*':location.origin);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Daily kiss: one claim per day per browser, with a streak. */
(() => {
  const $ = id => document.getElementById(id);
  const button = $('kissButton');
  if (!button) return;
  const label = $('kissButtonLabel'), message = $('kissMessage'), stats = $('kissStats'), note = $('kissNote'), burst = $('kissBurst');
  const defaults = [
    'A kiss for the quiet part of your day.',
    'Delivered with the light through the window.',
    'One kiss, no questions asked.',
    'Saved up since yesterday, all for you.',
    'For every ordinary day that turned out better with you in it.',
    'A small kiss for a big week.',
    'Sent ahead of the weather. Dress warm.',
    'Handle with care. Best claimed with a smile.',
    'Because today deserved a good start.',
    'A kiss, a song, and a slow afternoon.',
    'Proof that small things count.',
    'Claimed, kept, and remembered.'
  ];
  let messages = defaults;
  const KEY = 'archiveKissGame';
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { last: typeof v.last === 'string' ? v.last : '', streak: Number(v.streak) || 0, total: Number(v.total) || 0 }; } catch (_) { return { last: '', streak: 0, total: 0 }; } };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) {} };
  let state = read();
  const todaysMessage = () => messages[dayNumber() % messages.length];
  function untilMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.ceil((next - now) / 60000)), hours = Math.floor(mins / 60);
    return hours ? `${hours}h ${mins % 60}m` : `${mins}m`;
  }
  function render() {
    const claimed = state.last === dayKey();
    const streak = claimed || state.last === yesterdayKey() ? state.streak : 0;
    button.disabled = claimed;
    button.setAttribute('aria-pressed', String(claimed));
    label.textContent = claimed ? 'Claimed today' : 'Claim today’s kiss';
    message.textContent = claimed ? todaysMessage() : 'Today’s note is waiting for you.';
    note.textContent = claimed ? `Next kiss in ${untilMidnight()}` : '';
    stats.hidden = state.total === 0;
    stats.textContent = `${streak} day${streak === 1 ? '' : 's'} in a row · ${state.total} kiss${state.total === 1 ? '' : 'es'} claimed`;
  }
  function floatHearts() {
    if (!burst || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glyphs = ['♥', '♡', '✦', 'x'];
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('span');
      el.className = 'kiss-float';
      el.textContent = glyphs[i % glyphs.length];
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 70;
      el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      el.style.setProperty('--dy', `${Math.sin(angle) * dist - 50}px`);
      el.style.setProperty('--rot', `${Math.round(Math.random() * 60 - 30)}deg`);
      el.style.setProperty('--size', `${14 + Math.round(Math.random() * 14)}px`);
      el.style.setProperty('--delay', `${(Math.random() * 0.15).toFixed(2)}s`);
      burst.append(el);
      setTimeout(() => el.remove(), 1900);
    }
  }
  button.addEventListener('click', () => {
    const today = dayKey();
    if (state.last === today) return;
    const streak = state.last === yesterdayKey() ? state.streak + 1 : 1;
    state = { last: today, streak, total: state.total + 1 };
    write(state);
    render();
    floatHearts();
    navigator.vibrate?.(25);
  });
  window.archiveSetKissMessages = list => { messages = Array.isArray(list) && list.length ? list : defaults; render(); };
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
})();
