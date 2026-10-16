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
  const updatedDate=document.getElementById('archiveUpdatedDate');
  if(updatedDate){const lastModified=new Date(document.lastModified);if(!Number.isNaN(lastModified.getTime())){updatedDate.dateTime=lastModified.toISOString().slice(0,10);updatedDate.textContent=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'long',day:'numeric'}).format(lastModified);}else updatedDate.parentElement.hidden=true;}

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
  const offerBalance=document.getElementById('offerKissBalance'),offerAmount=document.getElementById('kissOfferAmount');
  const refreshOfferBalance=()=>{const balance=Number(window.archiveKissSnapshot?.kissesAvailable)||0;if(offerBalance)offerBalance.textContent=String(balance);if(offerAmount)offerAmount.max=String(Math.max(1,balance));};window.addEventListener('archive-kiss-updated',refreshOfferBalance);refreshOfferBalance();
  window.addEventListener('archive-kiss-updated',refreshOfferBalance);refreshOfferBalance();

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
  window.archivePublicDb=db;
  const pendingKissOffersKey='archivePendingKissOffers';
  function readPendingKissOffers(){try{const rows=JSON.parse(localStorage.getItem(pendingKissOffersKey)||'[]');return Array.isArray(rows)?rows:[];}catch(_){return[];}}
  const $=id=>document.getElementById(id);
  let adminPreviewActive=false;
  const fallback={navAbout:'About',navMoments:'Journal',navNotes:'Notes',navGuestbook:'Contact',aboutHeading:'A record of ordinary days.',aboutLead:'Everyday life leaves its marks in unexpected places.',momentsHeading:'Photo journal.',momentsIntro:'Images, captions, and dates. One entry at a time.',blogPosts:[],kissMessages:[],kissMilestones:[{type:'streak',target:3,sticker:'🌱',title:'A little beginning'},{type:'streak',target:7,sticker:'🌷',title:'One lovely week'},{type:'streak',target:14,sticker:'💌',title:'Two weeks close'},{type:'streak',target:30,sticker:'💖',title:'A month of kisses'},{type:'total',target:10,sticker:'✨',title:'Ten kisses kept'},{type:'total',target:50,sticker:'🌟',title:'Fifty sweet days'},{type:'total',target:100,sticker:'💎',title:'One hundred kisses'}],footerText:'A personal archive of photographs, music, and notes.'};
  function text(selector,value){const el=document.querySelector(selector);if(el&&typeof value==='string'&&value.trim())el.textContent=value;}
  function validPhotoUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:null;}catch(_){return null;}}
  function legacyPosts(v){if(Array.isArray(v.blogPosts)&&v.blogPosts.length)return v.blogPosts;const images=v.galleryImages||[],captions=v.galleryCaptions||[];const migrated=images.map((image,i)=>({id:`legacy-${i}`,image,path:'',caption:captions[i]||'From the archive',date:''})).filter(post=>validPhotoUrl(post.image));return migrated.length?migrated:(Array.isArray(v.blogPosts)?v.blogPosts:[]);}
  const BLOG_PAGE=9;
  function renderBlogPosts(posts,order){
    const root=$('blogPosts');if(!root)return;root.replaceChildren();
    const more=$('blogMore'),moreBtn=$('blogMoreButton');if(more)more.hidden=true;
    let ordered=(posts||[]).filter(post=>post&&validPhotoUrl(post.image));
    if(order!=='manual')ordered=[...ordered].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    window.archivePosts=ordered;
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
    showMore();window.dispatchEvent(new CustomEvent('archive-content-updated'));
  }
  function apply(data){if(!data)return;
    const v={...fallback,...data};
    window.archiveKamilaPhotos=(Array.isArray(v.kamilaPhotos)?v.kamilaPhotos:[]).map((photo,index)=>typeof photo==='string'?{id:`kamila-${index}`,image:validPhotoUrl(photo),caption:''}:{...photo,image:validPhotoUrl(photo?.image),caption:typeof photo?.caption==='string'?photo.caption:''}).filter(photo=>photo.image);
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
    window.archiveSetKissMilestones?.(Array.isArray(v.kissMilestones)?v.kissMilestones:[]);window.archiveSetMarketItems?.(Array.isArray(v.marketItems)?v.marketItems:[]);window.archiveSetCustomNotifications?.(Array.isArray(v.customNotifications)?v.customNotifications:[]);
    document.documentElement.style.setProperty('--hero-mobile-image',heroCssUrl(v.mobileImage));
    document.title=(v.title||'רואי')+' — Biggest Fan Archive';
  }
  function ensureCollectionSections(){
    const moments=document.querySelector('#moments');
    if(moments&&!document.getElementById('publicSongs')){const sec=document.createElement('section');sec.id='songsSection';sec.className='section archive-collection songs-section';sec.innerHTML='<div class="section-label"><span>04</span><span>AUDIO INDEX</span></div><div class="section-heading"><h2>Soundtrack.</h2><p>Tracks and listening notes from the archive.</p></div><div id="publicSongs" class="archive-song-grid" aria-live="polite"></div>';moments.after(sec);}
    if(!document.getElementById('publicNoises')){const sec=document.createElement('section');sec.id='noises';sec.className='section archive-collection noises-section';sec.innerHTML='<div class="section-label"><span>05</span><span>FIELD RECORDINGS</span></div><div class="section-heading"><h2>Noises.</h2><p>Small sounds, saved as voice notes.</p></div><div id="publicNoises" class="archive-noise-list" aria-live="polite"></div>';const songs=document.getElementById('songsSection');(songs||moments)?.after(sec);}
    if(!document.getElementById('publicThoughts')){const sec=document.createElement('section');sec.id='notes';sec.className='section archive-collection';sec.innerHTML='<div class="section-label"><span>06</span><span>TEXT INDEX</span></div><div class="section-heading"><h2>Notes.</h2><p>Short observations, gathered along the way.</p></div><div id="publicThoughts" class="archive-thought-grid"></div>';const noises=document.getElementById('noises');(noises||document.getElementById('songsSection')||moments)?.after(sec);}
  }
  function safeEmbedUrl(value){try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return null;if(url.hostname==='open.spotify.com'&&url.pathname.startsWith('/embed/'))return url.href;if(url.hostname==='www.youtube-nocookie.com'&&url.pathname.startsWith('/embed/'))return url.href;if(['music.apple.com','embed.music.apple.com'].includes(url.hostname)&&/^\/[a-z]{2}\/(album|song|playlist)\/[^/]+/i.test(url.pathname)){url.hostname='embed.music.apple.com';return url.href;}}catch(_){}return null;}
  window.archiveSafeEmbedUrl=safeEmbedUrl;
  let songsShown=2,noisesExpanded=false;
  function renderSongs(items){window.archiveSongs=(items||[]).filter(song=>safeEmbedUrl(song.embed));ensureCollectionSections();const root=$('publicSongs');if(!root)return;const list=window.archiveSongs;root.replaceChildren();if(!list.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='The soundtrack is waiting for its first song.';root.append(p);}list.slice(0,songsShown).forEach(song=>{const embed=safeEmbedUrl(song.embed);const card=document.createElement('article');card.className='archive-song';const label=document.createElement('h3');label.textContent=song.label||song.title||'A song for you';const frame=document.createElement('iframe');frame.src=embed;frame.title=label.textContent;frame.loading='lazy';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.width='100%';frame.style.height=song.kind==='spotify'?'152px':embed.includes('embed.music.apple.com')?'175px':'190px';frame.style.border='0';frame.style.borderRadius='12px';frame.style.minHeight=song.kind==='spotify'?'152px':'190px';const panel=document.createElement('div');panel.className='song-preview-panel';panel.append(frame);card.append(panel,label);root.append(card);});let more=$('songsMore');if(!more){more=document.createElement('div');more.id='songsMore';more.className='load-more-wrap';const button=document.createElement('button');button.type='button';button.className='load-more';button.addEventListener('click',()=>{songsShown=Math.min(list.length,songsShown+4);renderSongs(window.archiveSongs);});more.append(button);root.after(more);}const moreButton=more.querySelector('button');more.hidden=songsShown>=list.length||list.length<=2;moreButton.textContent=`Load more songs (${Math.max(0,list.length-songsShown)} left)`;window.archiveReveal(root);window.dispatchEvent(new CustomEvent('archive-content-updated'));}
  function safeAudioUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function renderNoises(items){window.archiveNoises=(items||[]).filter(noise=>safeAudioUrl(noise.url));ensureCollectionSections();const root=$('publicNoises');if(!root)return;root.replaceChildren();let shown=0;window.archiveNoises.forEach(noise=>{const url=safeAudioUrl(noise.url);if(!url)return;const row=document.createElement('article');row.className='archive-noise';if(!noisesExpanded&&shown>=1)row.hidden=true;const icon=document.createElement('span');icon.className='noise-mark';icon.setAttribute('aria-hidden','true');icon.textContent='▂▅▇▅▃';const body=document.createElement('div');body.className='noise-content';const title=document.createElement('h3');title.textContent=noise.title||'Untitled recording';const caption=document.createElement('p');caption.className='noise-caption';caption.textContent=noise.caption||'';const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=url;retryMedia(player);player.setAttribute('aria-label','Play '+title.textContent);body.append(title);if(caption.textContent)body.append(caption);if(noise.date){const date=document.createElement('time');date.className='noise-date';date.dateTime=noise.date;date.textContent=noise.date;body.append(date);}body.append(player);row.append(icon,body);root.append(row);shown++;});if(!root.children.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='No sounds in the archive yet.';root.append(p);}const more=$('noisesMore');if(more){more.hidden=shown<=1;more.setAttribute('aria-expanded',String(noisesExpanded));more.textContent=noisesExpanded?'Show fewer noises':`See all noises (${shown-1} more)`;}window.archiveReveal(root);window.dispatchEvent(new CustomEvent('archive-content-updated'));}
  $('noisesMore')?.addEventListener('click',()=>{noisesExpanded=!noisesExpanded;renderNoises(window.archiveNoises||[]);});
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
    row.hidden=true;
  }
  function renderThoughts(items){window.archiveThoughts=(items||[]).filter(t=>t&&typeof t.text==='string');ensureCollectionSections();const root=$('publicThoughts');if(!root)return;root.replaceChildren();(items||[]).forEach(t=>{const card=document.createElement('article');card.className='archive-thought';const mark=document.createElement('span');mark.className='archive-thought-index';mark.textContent='—';const p=document.createElement('p');p.textContent=t.text;card.append(mark,p);root.append(card);});if(!items?.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='A few observations are waiting to be added.';root.append(p);}setupSurprise(root,items);window.archiveReveal(root);window.dispatchEvent(new CustomEvent('archive-content-updated'));}
  async function loadContent(){ensureCollectionSections();if(adminPreviewActive)return;try{const response=await fetch(new URL('archive-data.json',location.href),{cache:'no-store'});if(response.ok){const content=await response.json();if(content&&typeof content==='object'){apply(content);renderSongs(content.songs||[]);renderNoises(content.noises||[]);renderThoughts(content.thoughts||[]);return;}}}catch(error){console.warn('GitHub archive file is not available yet; using the initial Supabase copy.',error);}if(!db){renderSongs([]);renderNoises([]);renderThoughts([]);return;}try{const {data,error}=await db.from('archive_content').select('content').eq('id',true).maybeSingle();if(error)throw error;if(data?.content){apply(data.content);renderSongs(data.content.songs||[]);renderNoises(data.content.noises||[]);renderThoughts(data.content.thoughts||[]);}else{renderSongs([]);renderNoises([]);renderThoughts([]);}}catch(error){console.error('Could not load archive content:',error);renderSongs([]);renderNoises([]);renderThoughts([]);}}
  window.addEventListener('message',event=>{
    if(window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='biggest-fan-admin-preview')return;
    const content=event.data.content;if(!content||typeof content!=='object')return;
    adminPreviewActive=true;
    apply(content);renderSongs(content.songs||[]);renderNoises(content.noises||[]);renderThoughts(content.thoughts||[]);
  });
  function makeComment(c){const article=document.createElement('article');article.className='guest-note';const avatar=document.createElement('span');avatar.className='note-avatar';avatar.textContent=(c.display_name?.[0]||'•').toUpperCase();const body=document.createElement('div'),meta=document.createElement('div');meta.className='guest-meta';const name=document.createElement('strong');name.textContent=c.display_name;const time=document.createElement('time');time.textContent=new Date(c.created_at).toLocaleDateString();const msg=document.createElement('p');msg.textContent=c.message;meta.append(name,time);body.append(meta,msg);article.append(avatar,body);return article;}
  async function loadComments(){const list=$('guestbookList');if(!list||!db)return;const {data,error}=await db.from('archive_comments').select('id,display_name,message,created_at').eq('approved',true).order('created_at',{ascending:false}).limit(30);if(error)return;list.replaceChildren();(data||[]).filter(c=>!String(c.message||'').startsWith('[KISS OFFER · ')).forEach(c=>list.append(makeComment(c)));}
  const init=()=>{
    loadContent();loadComments();
    const form=$('guestbookForm');
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();
      const status=$('formStatus'),button=form.querySelector('button[type="submit"]');
      if($('guestWebsite')?.value){form.reset();status.textContent='Thank you — your offer was sent for review.';return;}
      if(!db){status.textContent='Offers are temporarily unavailable. Please try again later.';return;}
      let last=0;try{last=Number(localStorage.getItem('archiveLastNote')||0);}catch(_){}
      if(Date.now()-last<60000){status.textContent='Please wait a minute before sending another offer.';return;}
      const name=$('guestName').value.trim().replace(/\s+/g,' ').slice(0,32),request=$('guestMessage').value.trim().slice(0,240),amount=Math.floor(Number($('kissOfferAmount')?.value)||0),balance=Number(window.archiveKissSnapshot?.kissesAvailable)||0;
      if(!name||!request)return;if(amount<1||amount>balance){status.textContent=`Choose an amount from 1 to ${balance} kisses.`;return;}const ref=globalThis.crypto?.randomUUID?.()||`offer-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;const message=`[KISS OFFER · ${amount} KISSES] [OFFER REF: ${ref}] ${request}`;
      if(button)button.disabled=true;status.textContent='Sending your offer for review…';
      const {error}=await db.from('archive_comments').insert({display_name:name,message,approved:false});
      if(button)button.disabled=false;
      if(error){status.textContent='Could not send the offer. Please try again later.';return;}
      try{const pending=readPendingKissOffers().filter(item=>item?.ref!==ref);pending.push({ref,submittedAt:Date.now()});localStorage.setItem(pendingKissOffersKey,JSON.stringify(pending.slice(-100)));}catch(_){}
      try{localStorage.setItem('archiveLastNote',String(Date.now()));}catch(_){}
      form.reset();$('charCount').textContent='0 / 240';if(offerAmount)offerAmount.value='1';status.textContent='Thank you — your offer was sent for review. Your kisses are still yours.';
    });
    if(window.parent!==window)window.parent.postMessage({type:'biggest-fan-preview-ready'},location.origin==='null'?'*':location.origin);
  };
  let checkingAcceptedOffers=false;
  window.archiveCheckAcceptedKissOffers=async()=>{
    if(!db||checkingAcceptedOffers)return;const refs=new Set(readPendingKissOffers().map(item=>String(item?.ref||'')).filter(Boolean));if(!refs.size)return;checkingAcceptedOffers=true;
    try{const {data,error}=await db.from('archive_comments').select('message,created_at').eq('approved',true).order('created_at',{ascending:false}).limit(200);if(error)return;const byRef=new Map();(data||[]).forEach(row=>{const message=String(row.message||'');if(!message.startsWith('[KISS OFFER · '))return;const ref=message.match(/\[OFFER REF: ([^\]]+)\]/)?.[1];if(ref&&refs.has(ref))byRef.set(ref,{ref,createdAt:row.created_at,request:message.replace(/^\[KISS OFFER · \d+ KISSES\]\s*/,'').replace(/^\[OFFER REF: [^\]]+\]\s*/,'').trim()});});let liveItems=window.archiveMarketItems||[];if([...byRef.values()].some(offer=>!liveItems.some(item=>item.offerRef===offer.ref))){try{const response=await fetch(new URL('archive-data.json',location.href),{cache:'no-store'});if(response.ok){const content=await response.json();if(Array.isArray(content?.marketItems))window.archiveSetMarketItems?.(content.marketItems);liveItems=window.archiveMarketItems||liveItems;}}catch(_){}}window.archiveAcceptedKissOffers=[...byRef.values()].filter(offer=>liveItems.some(item=>item.offerRef===offer.ref));window.dispatchEvent(new CustomEvent('archive-accepted-offers-updated'));}catch(_){}finally{checkingAcceptedOffers=false;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Archive additions: deal, journal tools, notes, counters, polaroids and pocket. */
(() => {
  const $=id=>document.getElementById(id), reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const validPhoto=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}};
  const photoDialog=$('photoLightbox'),lbImg=$('photoLightboxImage'),lbCaption=$('photoLightboxCaption');
  const openPhoto=(url,caption,alt='')=>{if(!validPhoto(url)||!photoDialog?.showModal)return;lbImg.src=url;lbImg.alt=alt||caption||'Photo journal image';lbCaption.textContent=caption||'';photoDialog.showModal();};
  let posts=[],songs=[],notes=[],noises=[],marketItems=[],pocket=[],activePocket='photos',yearFilter='',query='',noteShown=0,shuffleUsed=0,dealItems=[];
  let migratedKamilaCards=false;try{pocket=JSON.parse(localStorage.getItem('archivePocket')||'[]');if(!Array.isArray(pocket))pocket=[];pocket=pocket.map(entry=>{if(entry?.type==='photos'&&entry.item?.collectible==='kamila'){migratedKamilaCards=true;return{...entry,type:'collectibles',item:{...entry.item,tier:entry.item.tier||'common'}};}return entry;});}catch(_){pocket=[];}
  const writePocket=()=>{try{localStorage.setItem('archivePocket',JSON.stringify(pocket));return true;}catch(_){return false;}};
  if(migratedKamilaCards)writePocket();
  const keep=(type,item)=>{const toggle=$('pocketToggle');if(!reduce()){toggle.classList.remove('pocket-pop');requestAnimationFrame(()=>toggle.classList.add('pocket-pop'));setTimeout(()=>toggle.classList.remove('pocket-pop'),360);}if(pocket.length>=50){announcePocket('Your pocket is full (50 keeps). Remove something to make room.');return;}const key=JSON.stringify([type,item]);if(pocket.some(x=>JSON.stringify([x.type,x.item])===key)){announcePocket('Already tucked into your pocket.');return;}pocket.push({type,item});if(!writePocket()){pocket.pop();announcePocket('Pocket storage is unavailable in this browser.');return;}renderPocket();announcePocket('Saved to your pocket.');};
  const announcePocket=message=>{const hint=$('pocketHint');if(hint)hint.textContent=message;};
  function keepButton(type,item){const b=document.createElement('button');b.type='button';b.className='keep-button';b.textContent='+';b.setAttribute('aria-label','Add this '+(type==='photos'?'photo':type==='songs'?'song':'note')+' to your pocket');b.addEventListener('click',()=>keep(type,item));return b;}
  function setupAboutPhotoFlash(){const button=$('aboutPhotoFlash'),peek=$('aboutPhotoPeek'),status=$('aboutPhotoFlashStatus');if(!button||button.dataset.ready)return;button.dataset.ready='true';let timer;button.addEventListener('click',()=>{const available=posts.filter(post=>validPhoto(post.image));if(!available.length){status.textContent='No journal photos are available yet.';return;}peek.replaceChildren();const chosen=[...available].sort(()=>Math.random()-.5).slice(0,Math.min(4,available.length));chosen.forEach((post,index)=>{const img=document.createElement('img');img.className=`about-photo-flash-tile tile-${index+1}`;img.src=validPhoto(post.image);img.alt='';img.loading='eager';peek.append(img);});button.classList.add('photo-flash-active');status.textContent=`A quick glimpse of ${chosen.length} photos from the journal.`;clearTimeout(timer);timer=setTimeout(()=>{button.classList.remove('photo-flash-active');peek.replaceChildren();},reduce()?260:850);});}
  function renderMarket(items=marketItems){
    const root=$('kissMarketItems');if(!root)return;root.replaceChildren();const active=items.filter(item=>item.active!==false);
    if(!active.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='No items or services are listed yet. Check back soon.';root.append(empty);return;}
    active.forEach(item=>{const card=document.createElement('article');card.className='kiss-market-card';card.dataset.marketId=item.id;const kind=document.createElement('span');kind.className='kiss-market-kind';kind.textContent=item.type==='service'?'SERVICE':'ITEM';const title=document.createElement('h3');title.textContent=item.title;const description=document.createElement('p');description.textContent=item.description||'Includes a collectible ticket with the rights listed by the archive.';const offer=document.createElement('div');offer.className='kiss-market-offer';const priceCopy=document.createElement('span');priceCopy.textContent='KISS PRICE';const price=document.createElement('strong');price.className='kiss-market-price';price.textContent=`${item.kissCost} kisses`;offer.append(priceCopy,price);const buy=document.createElement('button');buy.type='button';buy.className='pill-button kiss-market-buy';buy.textContent='Buy & claim ticket';buy.setAttribute('aria-label',`Buy ${item.title} and claim its ticket for ${item.kissCost} kisses`);const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';buy.append(arrow);buy.addEventListener('click',()=>buyMarketItem(item));card.append(kind,title,description,offer,buy);root.append(card);});
  }
  function buyMarketItem(item){
    const cost=Math.floor(Number(item.kissCost)||0),balance=Number(window.archiveKissSnapshot?.kissesAvailable)||0;
    const marketStatus=$('kissMarketStatus');if(cost<1)return;if(balance<cost){const message=`You need ${cost-balance} more kiss${cost-balance===1?'':'es'} for this ticket.`;if(marketStatus)marketStatus.textContent=message;announcePocket(message);return;}
    if(pocket.length>=50){const message='Your pocket is full (50 keeps). Clear space before claiming a ticket.';if(marketStatus)marketStatus.textContent=message;announcePocket(message);return;}
    const ticket={collectible:'market-ticket',ticketId:`ticket-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,marketId:item.id,title:item.title,description:item.description||'',kind:item.type==='service'?'service':'item',kissCost:cost,claimedAt:Date.now(),collectionRights:true};const entry={type:'collectibles',item:ticket};pocket.push(entry);
    if(!writePocket()){pocket.pop();const message='Pocket storage is unavailable, so this ticket could not be claimed.';if(marketStatus)marketStatus.textContent=message;announcePocket(message);return;}
    if(!window.archiveSpendKisses?.(cost)){pocket.pop();writePocket();const message='Your kiss balance changed. Please try again.';if(marketStatus)marketStatus.textContent=message;announcePocket(message);return;}
    activePocket='collectibles';document.querySelectorAll('[data-pocket-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.pocketTab==='collectibles')));const pocketPanel=$('pocketPanel');if(pocketPanel){pocketPanel.hidden=false;if(matchMedia('(max-width: 620px)').matches){$('archivePetPanel')?.setAttribute('hidden','');$('archivePetToggle')?.setAttribute('aria-expanded','false');}}renderPocket();const successMessage=`${item.title} ticket claimed and added to your collection.`;if(marketStatus)marketStatus.textContent=successMessage;announcePocket(successMessage);renderMarket();
  }
  window.addEventListener('archive-kiss-updated',()=>renderMarket());
  window.archiveSetMarketItems=items=>{marketItems=(Array.isArray(items)?items:[]).filter(item=>item&&item.active!==false&&String(item.id||'')&&String(item.title||'').trim()&&Number(item.kissCost)>0).map(item=>({id:String(item.id),title:String(item.title).slice(0,70),description:String(item.description||'').slice(0,240),type:item.type==='service'?'service':'item',kissCost:Math.floor(Number(item.kissCost)),active:item.active!==false,offerRef:String(item.offerRef||'')}));window.archiveMarketItems=marketItems;renderMarket();window.archiveCheckAcceptedKissOffers?.();};
  function renderPocket(){
    const root=$('pocketItems');if(!root)return;const awards=window.archiveKissSnapshot?.awards||[];const totalCount=pocket.length+awards.length;$('pocketCount').textContent=String(totalCount);$('pocketToggle').setAttribute('aria-label',totalCount?`Open pocket, ${totalCount} collectibles and saved items`:'Open pocket');root.replaceChildren();
    const addRemove=(row,entry)=>{const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>{const real=pocket.indexOf(entry);if(real>=0)pocket.splice(real,1);writePocket();renderPocket();});row.append(remove);};
    if(activePocket==='collectibles'){
      const walletCard=document.createElement('p');walletCard.className='pocket-kiss-balance';const walletValue=Number(window.archiveKissSnapshot?.kissesAvailable)||0;walletCard.textContent=`${walletValue} kiss${walletValue===1?'':'es'} available to offer`;root.append(walletCard);
      const awardGroup=document.createElement('section');awardGroup.className='pocket-collection-group';const awardHeading=document.createElement('h3');awardHeading.textContent='Kiss awards';awardGroup.append(awardHeading);
      if(!awards.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='Kiss milestone awards will collect here as you earn them.';awardGroup.append(empty);}else awards.forEach(award=>{const row=document.createElement('article');row.className='pocket-item pocket-award-card';const graphic=validPhoto(award.graphic);if(graphic){const img=document.createElement('img');img.className='pocket-award-art';img.src=graphic;img.alt='';row.append(img);}else{const sticker=document.createElement('span');sticker.className='pocket-award-art pocket-award-emoji';sticker.setAttribute('aria-hidden','true');sticker.textContent=award.sticker||'✦';row.append(sticker);}const copy=document.createElement('div');copy.className='pocket-award-copy';const title=document.createElement('strong');title.textContent=award.title;const detail=document.createElement('small');detail.textContent=award.type==='streak'?`${award.target}-day kiss streak`:`${award.target} kisses`;copy.append(title,detail);row.append(copy);awardGroup.append(row);});root.append(awardGroup);
      const ticketGroup=document.createElement('section');ticketGroup.className='pocket-collection-group';const ticketHeading=document.createElement('h3');ticketHeading.textContent='Market tickets';ticketGroup.append(ticketHeading);const tickets=pocket.filter(entry=>entry.type==='collectibles'&&entry.item?.collectible==='market-ticket');if(!tickets.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='Tickets from the kiss market will be kept here.';ticketGroup.append(empty);}else tickets.slice().reverse().forEach(entry=>{const ticket=entry.item,row=document.createElement('article');row.className='pocket-item market-ticket-card';const ribbon=document.createElement('span');ribbon.className='market-ticket-ribbon';ribbon.textContent='COLLECTION RIGHT · TICKET';const title=document.createElement('strong');title.textContent=ticket.title;const description=document.createElement('p');description.textContent=ticket.description||'A collectible ticket from the kiss market.';const detail=document.createElement('small');detail.textContent=`${ticket.kind==='service'?'SERVICE':'ITEM'} · ${ticket.kissCost} KISSES · CLAIMED ${new Date(ticket.claimedAt).toLocaleDateString()}`;row.append(ribbon,title,description,detail);ticketGroup.append(row);});root.append(ticketGroup);
      const cardGroup=document.createElement('section');cardGroup.className='pocket-collection-group';const cardHeading=document.createElement('h3');cardHeading.textContent='Kamila cards';cardGroup.append(cardHeading);const cards=pocket.filter(entry=>entry.type==='collectibles'&&entry.item?.collectible==='kamila');if(!cards.length){const empty=document.createElement('p');empty.className='collection-empty';empty.textContent='Catch Kamila to find a card for your collection.';cardGroup.append(empty);}else cards.forEach(entry=>{const row=document.createElement('article');const tier=String(entry.item.tier||'common').toLowerCase();row.className=`pocket-item kamila-pocket-card tier-${tier}`;const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='pocket-photo';const img=document.createElement('img');img.src=entry.item.image;img.alt=entry.item.caption||'Kamila collectible card';imageButton.append(img);imageButton.setAttribute('aria-label',`Open Kamila collectible card: ${entry.item.caption||'A little Kamila collectible'}`);imageButton.addEventListener('click',()=>openKamilaCard(entry.item,`CARD ${String(cards.indexOf(entry)+1).padStart(3,'0')}`));row.append(imageButton);const tierBadge=document.createElement('span');tierBadge.className=`kamila-tier-badge ${tier}`;tierBadge.textContent=tier.toUpperCase();row.append(tierBadge);const tierValue=kamilaCardValues[tier]||1;const worth=document.createElement('small');worth.className='kamila-card-worth';worth.textContent=`Worth · ${tierValue} kiss${tierValue===1?'':'es'}`;row.append(worth);const caption=document.createElement('p');caption.textContent=entry.item.caption||'A little Kamila collectible';row.append(caption);const serial=document.createElement('small');serial.className='kamila-card-number';serial.textContent=`CARD ${String(cards.indexOf(entry)+1).padStart(3,'0')}`;row.append(serial);const exchange=document.createElement('button');exchange.type='button';exchange.className='kamila-card-exchange';exchange.textContent=`Exchange for ${Number(entry.item.kissValue)||tierValue} kisses`;exchange.addEventListener('click',()=>{const value=Number(entry.item.kissValue)||tierValue;const real=pocket.indexOf(entry);if(real<0)return;pocket.splice(real,1);if(!writePocket()){pocket.splice(real,0,entry);announcePocket('Pocket storage is unavailable, so this card was not exchanged.');return;}if(!window.archiveAddKisses?.(value)){pocket.splice(real,0,entry);writePocket();announcePocket('Your kiss balance could not be saved, so the card stayed in your pocket.');return;}renderPocket();announcePocket(`Card exchanged for ${value} kiss${value===1?'':'es'}.`);});row.append(exchange);addRemove(row,entry);cardGroup.append(row);});root.append(cardGroup);$('pocketEmpty').textContent='Clear Kamila cards';return;
    }
    $('pocketEmpty').textContent='Empty pocket';const items=pocket.filter(x=>x.type===activePocket);if(!items.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='Nothing tucked in here yet.';root.append(p);}items.forEach(entry=>{const row=document.createElement('article');row.className=`pocket-item${entry.type==='photos'?' pocket-photo-item':''}`;if(entry.type==='photos'){const b=document.createElement('button');b.className='pocket-photo';b.type='button';const img=document.createElement('img');img.src=entry.item.image;img.alt=entry.item.caption||'Saved photo';b.append(img);b.addEventListener('click',()=>openPhoto(entry.item.image,entry.item.caption));row.append(b);const cap=document.createElement('p');cap.textContent=entry.item.caption||'Photo';row.append(cap);}else if(entry.type==='songs'){const title=document.createElement('p');title.textContent=entry.item.label||'A song for you';row.append(title);const frame=document.createElement('iframe');frame.src=window.archiveSafeEmbedUrl(entry.item.embed)||'';frame.title=title.textContent;frame.loading='lazy';frame.allow='encrypted-media; fullscreen; picture-in-picture';frame.style.width='100%';frame.style.border='0';frame.style.minHeight=entry.item.kind==='spotify'?'152px':'190px';row.append(frame);}else{const p=document.createElement('p');p.textContent=entry.item.text;row.append(p);}addRemove(row,entry);root.append(row);});
  }
  const kamilaCardValues={'common':1,'uncommon':3,'rare':5,'epic':10,'legendary':25,'extremely-rare':50,'priceless':100};
  const kamilaTiers=[{name:'common',limit:.55},{name:'uncommon',limit:.80},{name:'rare',limit:.93},{name:'extremely-rare',limit:.99},{name:'epic',limit:.999},{name:'legendary',limit:.9995},{name:'priceless',limit:1}];
  const cardPreviewDialog=$('kamilaCardPreviewDialog'),cardFlipInner=$('kamilaPocketPreviewFlip'),cardFlipButton=$('kamilaCardFlipButton');
  function setKamilaCardFace(back){if(!cardFlipInner)return;cardFlipInner.classList.toggle('is-flipped',back);cardFlipButton?.setAttribute('aria-pressed',String(back));if(cardFlipButton)cardFlipButton.textContent=back?'Turn card back':'Turn card over';$('kamilaPocketPreviewBack')?.setAttribute('aria-hidden',String(!back));$('kamilaPocketPreviewArt')?.closest('.kamila-card-front')?.setAttribute('aria-hidden',String(back));}
  function openKamilaCard(item,serial){const tier=String(item.tier||'common').toLowerCase();const safeTier=Object.hasOwn(kamilaCardValues,tier)?tier:'common';const caption=item.caption||'A little Kamila collectible';const art=$('kamilaPocketPreviewArt');art?.replaceChildren();if(art&&validPhoto(item.image)){const image=document.createElement('img');image.src=item.image;image.alt=caption;art.append(image);} $('kamilaPocketPreviewCaption').textContent=caption;$('kamilaPocketPreviewDescription').textContent=item.description||'A little moment, kept safe in the pocket collection.';$('kamilaPocketPreviewTier').textContent=safeTier.toUpperCase();$('kamilaPocketPreviewTier').className=`kamila-tier-badge ${safeTier}`;$('kamilaPocketPreviewWorth').textContent=`${Number(item.kissValue)||kamilaCardValues[safeTier]} kiss${(Number(item.kissValue)||kamilaCardValues[safeTier])===1?'':'es'}`;$('kamilaPocketPreviewSerial').textContent=serial;$('kamilaPocketPreviewCard').className=`kamila-trading-card kamila-flippable-card tier-${safeTier}`;setKamilaCardFace(false);cardPreviewDialog?.showModal();}
  cardFlipButton?.addEventListener('click',()=>setKamilaCardFace(!cardFlipInner?.classList.contains('is-flipped')));
  $('kamilaCardPreviewClose')?.addEventListener('click',()=>cardPreviewDialog?.close());
  const cardFlipScene=document.querySelector('.kamila-card-flip-scene');let cardSwipeStart=null;cardFlipScene?.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;cardSwipeStart={x:event.clientX,y:event.clientY};try{cardFlipScene.setPointerCapture(event.pointerId);}catch(_){}});cardFlipScene?.addEventListener('pointerup',event=>{if(!cardSwipeStart)return;const dx=event.clientX-cardSwipeStart.x,dy=event.clientY-cardSwipeStart.y;cardSwipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))setKamilaCardFace(dx<0);});cardFlipScene?.addEventListener('pointercancel',()=>{cardSwipeStart=null;});
  window.archiveCollectKamila=photo=>{if(!photo?.image||!validPhoto(photo.image))return null;const roll=Math.random(),tier=kamilaTiers.find(item=>roll<item.limit)?.name||'common',item={image:photo.image,caption:photo.caption||'A little Kamila collectible',description:photo.description||'',collectible:'kamila',cardId:`kamila-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,collectedAt:Date.now(),tier,kissValue:kamilaCardValues[tier]||1};keep('collectibles',item);return pocket.find(entry=>entry.type==='collectibles'&&entry.item.cardId===item.cardId)?.item||null;};


  $('pocketToggle').addEventListener('click',()=>{const panel=$('pocketPanel');panel.hidden=!panel.hidden;if(!panel.hidden){if(matchMedia('(max-width: 620px)').matches){$('archivePetPanel')?.setAttribute('hidden','');$('archivePetToggle')?.setAttribute('aria-expanded','false');}renderPocket();$('pocketClose').focus();}});$('pocketClose').addEventListener('click',()=>$('pocketPanel').hidden=true);$('pocketEmpty').addEventListener('click',()=>{pocket=activePocket==='collectibles'?pocket.filter(x=>!(x.type==='collectibles'&&x.item?.collectible==='kamila')):pocket.filter(x=>x.type!==activePocket);writePocket();renderPocket();});document.querySelectorAll('[data-pocket-tab]').forEach(b=>b.addEventListener('click',()=>{activePocket=b.dataset.pocketTab;document.querySelectorAll('[data-pocket-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderPocket();}));
  try{if(!localStorage.getItem('archivePocketHintSeen')){announcePocket('Keep a photo, song or note here to find it again.');localStorage.setItem('archivePocketHintSeen','1');}}catch(_){announcePocket('Keep a photo, song or note here to find it again.');}
  function addKeepControls(){document.querySelectorAll('.blog-post').forEach(card=>{if(card.querySelector('.keep-button'))return;const p=posts.find(x=>String(x.id||'')===card.dataset.postId)||posts[0];if(p)card.append(keepButton('photos',{image:validPhoto(p.image),caption:p.caption||'',date:p.date||''}));});document.querySelectorAll('.archive-song').forEach((card,i)=>{if(!card.querySelector('.keep-button')&&songs[i])card.append(keepButton('songs',{embed:window.archiveSafeEmbedUrl(songs[i].embed),label:songs[i].label||songs[i].title||'A song for you',kind:songs[i].kind||''}));});}
  function renderDeal(preserve=false){const section=$('deal'),root=$('dealHand');if(!section||!root)return;const pool=posts.length+songs.length+notes.length;if(!pool){section.hidden=true;return;}section.hidden=false;root.replaceChildren();const pick=(a,previous)=>{if(!a.length)return null;const choices=a.length>1?a.filter(item=>item!==previous):a;return choices[Math.floor(Math.random()*choices.length)];};if(!preserve)dealItems=[pick(posts),pick(songs),pick(notes)];const types=['photos','songs','notes'];dealItems.forEach((item,i)=>{const card=document.createElement('article');card.className='deal-card';card.style.setProperty('--tilt',`${Math.random()*8-4}deg`);if(!item){const p=document.createElement('p');p.textContent=['No photos just yet.','No songs just yet.','No notes just yet.'][i];card.append(p);}else if(i===0){const b=document.createElement('button');b.type='button';b.className='blog-photo-button';b.dataset.photo=validPhoto(item.image);b.dataset.caption=item.caption||'';const img=document.createElement('img');img.src=validPhoto(item.image);img.alt=item.alt||item.caption||'Photo journal image';b.append(img);b.addEventListener('click',()=>openPhoto(item.image,item.caption,item.alt));const p=document.createElement('p');p.textContent=item.caption||'From the archive';card.append(b,p);if(item.date){const t=document.createElement('time');t.textContent=item.date;card.append(t);}}else if(i===1){const h=document.createElement('h3');h.textContent=item.label||item.title||'A song for you';card.append(h);const frame=document.createElement('iframe');frame.src=window.archiveSafeEmbedUrl(item.embed)||'';frame.title=h.textContent;frame.loading='lazy';frame.allow='encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.width='100%';frame.style.border='0';frame.style.borderRadius='12px';frame.style.minHeight=item.kind==='spotify'?'152px':'190px';card.append(frame);}else{const p=document.createElement('p');p.textContent=item.text;card.append(p);}if(item)card.append(keepButton(types[i],i===0?{image:item.image,caption:item.caption||'',date:item.date||''}:i===1?{embed:window.archiveSafeEmbedUrl(item.embed),label:item.label||item.title||'A song for you',kind:item.kind||''}:{text:item.text}));const again=document.createElement('button');again.type='button';again.className='reroll-button';again.textContent='↻';again.setAttribute('aria-label','Redraw this card');again.addEventListener('click',()=>{const poolFor=[posts,songs,notes][i];dealItems[i]=pick(poolFor,dealItems[i]);renderDeal(true);});card.append(again);root.append(card);});}
  const dealDialog=$('dealDialog');$('dealStack').addEventListener('click',()=>{if(!dealDialog.open)dealDialog.showModal();});$('dealClose').addEventListener('click',()=>dealDialog.close());dealDialog.addEventListener('click',event=>{if(event.target===dealDialog)dealDialog.close();});
  $('dealAgain').addEventListener('click',()=>{const pick=(pool,previous)=>{if(!pool.length)return null;const choices=pool.length>1?pool.filter(item=>item!==previous):pool;return choices[Math.floor(Math.random()*choices.length)];};dealItems=[pick(posts,dealItems[0]),pick(songs,dealItems[1]),pick(notes,dealItems[2])];renderDeal(true);});
  function dateLabel(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
  function matches(post){const d=post.date||'',cap=(post.caption||'').toLocaleLowerCase(),q=query.trim().toLocaleLowerCase();let ok=!yearFilter||d.startsWith(yearFilter);if(q){const parts=q.split(/\s+/);ok=ok&&parts.every(part=>cap.includes(part)||d.toLocaleLowerCase().includes(part)||(()=>{if(!d)return false;const dt=new Date(d+'T12:00:00Z');return dt.toLocaleString(undefined,{month:'long',year:'numeric'}).toLocaleLowerCase().includes(part);})());}return ok;}
  function captionNodes(el,text,needle){const lower=text.toLocaleLowerCase(),q=needle.trim().toLocaleLowerCase();if(!q){el.textContent=text||'Untitled photo';return;}let cursor=0;while(cursor<text.length){let found=-1,term='';for(const part of q.split(/\s+/)){const i=lower.indexOf(part,cursor);if(i>=0&&(found<0||i<found)){found=i;term=part;}}if(found<0){el.append(document.createTextNode(text.slice(cursor)));break;}el.append(document.createTextNode(text.slice(cursor,found)));const m=document.createElement('mark');m.textContent=text.slice(found,found+term.length);el.append(m);cursor=found+term.length;}}
  let previewIds=new Set();
  function renderJournal(){const root=$('blogPosts'),more=$('blogMore'),all=[...posts],filtered=all.filter(matches),searching=Boolean(query.trim()||yearFilter);root.replaceChildren();$('journalResultCount').textContent=searching?`${filtered.length} entr${filtered.length===1?'y':'ies'} found`:'';if(searching){root.classList.remove('journal-mosaic');if(more)more.hidden=true;if(!filtered.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='No entries match this search.';root.append(p);}filtered.forEach((p,i)=>root.append(photoCard(p,i,true)));return;}
    if(!previewIds.size)previewIds=new Set([...all].sort(()=>Math.random()-.5).slice(0,Math.min(6,all.length)).map((p,i)=>String(p.id||`${p.image}-${i}`)));
    const preview=all.filter((p,i)=>previewIds.has(String(p.id||`${p.image}-${i}`)));const grid=all.length>6?preview:all.slice(0,6);grid.forEach((p,i)=>root.append(photoCard(p,i,false)));root.classList.toggle('journal-mosaic',grid.length>1);if(more)more.hidden=all.length<=6;const btn=$('blogMoreButton');if(btn){btn.textContent='Load more entries';btn.onclick=()=>{root.classList.remove('journal-mosaic');root.replaceChildren();all.slice(0,9).forEach((p,i)=>root.append(photoCard(p,i,false)));let shown=Math.min(9,all.length);more.hidden=shown>=all.length;btn.textContent=`Load more entries (${all.length-shown} left)`;btn.onclick=()=>{const next=all.slice(shown,shown+9);next.forEach((p,i)=>root.append(photoCard(p,shown+i,false)));shown+=next.length;more.hidden=shown>=all.length;btn.textContent=`Load more entries (${all.length-shown} left)`;};};}}
  function photoCard(p,i,highlight){const article=document.createElement('article');article.className='blog-post'+(i===0?' blog-post-featured':'');article.dataset.postId=String(p.id||'');const figure=document.createElement('figure');figure.className='blog-figure';const button=document.createElement('button');button.type='button';button.className='blog-photo-button';button.dataset.photo=validPhoto(p.image);button.dataset.caption=p.caption||'';button.dataset.alt=p.alt||'';button.setAttribute('aria-label','Open photo: '+(p.caption||'Photo journal image'));const img=document.createElement('img');img.src=validPhoto(p.image);img.alt=p.alt||p.caption||'Photo journal image';img.loading='lazy';img.decoding='async';retryMedia(img);button.append(img);figure.append(button);const copy=document.createElement('div');copy.className='blog-post-copy';const time=document.createElement('time');time.className='blog-post-date';time.textContent=dateLabel(p.date)||'FROM THE ARCHIVE';const cap=document.createElement('h3');captionNodes(cap,p.caption||'Untitled photo',highlight?query:'');copy.append(time,cap);copy.append(keepButton('photos',{image:validPhoto(p.image),caption:p.caption||'',date:p.date||''}));article.append(figure,copy);return article;}
  function updateHash(){const hash=`#moments${query.trim()?`?q=${encodeURIComponent(query.trim())}`:''}`;history.replaceState(null,'',location.pathname+location.search+hash);}
  function setupJournal(){const input=$('journalSearch'),years=$('journalYears');let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{query=input.value;updateHash();renderJournal();},140);});if(location.hash.startsWith('#moments?')){const params=new URLSearchParams(location.hash.split('?')[1]||'');query=params.get('q')||'';input.value=query;}const setYear=y=>{yearFilter=y;years.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.year===y)));renderJournal();};function yearsRender(){years.replaceChildren();const ys=[...new Set(posts.map(p=>(p.date||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse();ys.forEach(y=>{const b=document.createElement('button');b.type='button';b.className='year-chip';b.dataset.year=y;b.textContent=y;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>setYear(yearFilter===y?'':y));years.append(b);});}yearsRender();}
  function renderCounters(){const root=$('archiveCounters');if(!root)return;root.replaceChildren();const counts=[['photos',posts.length],['songs',songs.length],['noises',noises.length],['notes',notes.length]].filter(x=>x[1]>0);if(!counts.length){root.hidden=true;return;}root.hidden=false;counts.forEach(([name,value])=>{const span=document.createElement('span');span.className='counter-item';span.textContent=`${name} `;const strong=document.createElement('strong');strong.textContent=String(value);span.append(strong);root.append(span);});if(reduce())return;if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const el=e.target.querySelector('strong'),end=Number(el.textContent);let start=0;const t0=performance.now();const tick=now=>{const n=Math.min(1,(now-t0)/650);el.textContent=String(Math.round(start+(end-start)*n));if(n<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);io.disconnect();}}));io.observe(root);}}
  function renderNotes(){const root=$('publicThoughts');root.replaceChildren();notes.slice(0,noteShown).forEach((n,i)=>{const card=document.createElement('article');card.className='archive-thought';const idx=document.createElement('span');idx.className='archive-thought-index';idx.textContent='—';const p=document.createElement('p');p.textContent=n.text;card.append(idx,p,keepButton('notes',{text:n.text}));root.append(card);});const more=$('notesMore');more.hidden=!notes.length;more.setAttribute('aria-expanded',String(noteShown>0));more.textContent=noteShown>=notes.length&&noteShown>0?'Show less':noteShown===0?'Read latest note':`See more notes (${notes.length-noteShown} left)`;if(!notes.length){const e=document.createElement('p');e.className='collection-empty';e.textContent='A few observations are waiting to be added.';root.append(e);}}
  function swapNote(){const box=$('noteSwap');box.replaceChildren();if(!notes.length)return;let i;do{i=Math.floor(Math.random()*notes.length);}while(notes.length>1&&i===shuffleUsed);shuffleUsed=i;const p=notes[i],text=document.createElement('p');text.className='note-swap-text';text.textContent=p.text;box.append(text,keepButton('notes',{text:p.text}));}
  $('notesMore').addEventListener('click',()=>{noteShown=noteShown>=notes.length&&noteShown>0?0:Math.min(notes.length,noteShown+(noteShown===0?1:6));renderNotes();});$('noteAnother').addEventListener('click',swapNote);
  const pd=$('polaroidDialog'),stage=$('polaroidStage');let polaroidCount=12,zTop=1,drag=null;
  function renderPolaroids(reset=false){stage.replaceChildren();const list=posts.filter(matches).slice(0,polaroidCount);list.forEach((p,i)=>{const card=document.createElement('article');card.className='polaroid';card.tabIndex=0;card.style.left=`${5+Math.random()*65}%`;card.style.top=`${6+Math.random()*65}%`;card.style.setProperty('--tilt',`${Math.random()*20-10}deg`);card.style.zIndex=String(++zTop);const img=document.createElement('img');img.src=validPhoto(p.image);img.alt=p.alt||p.caption||'Photo journal image';const cap=document.createElement('p');cap.textContent=p.caption||'From the archive';const date=document.createElement('time');date.textContent=dateLabel(p.date);card.append(img,cap,date,keepButton('photos',{image:validPhoto(p.image),caption:p.caption||'',date:p.date||''}));card.addEventListener('pointerdown',e=>{if(e.target.closest('button.keep-button'))return;drag={el:card,x:e.clientX,y:e.clientY,left:card.offsetLeft,top:card.offsetTop,moved:false};card.setPointerCapture(e.pointerId);card.style.zIndex=String(++zTop);});card.addEventListener('pointermove',e=>{if(!drag||drag.el!==card)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;card.style.left=`${Math.max(0,Math.min(stage.clientWidth-card.offsetWidth,drag.left+dx))}px`;card.style.top=`${Math.max(0,Math.min(stage.clientHeight-card.offsetHeight,drag.top+dy))}px`;});card.addEventListener('pointerup',()=>{if(drag?.el===card){if(!drag.moved)openPhoto(p.image,p.caption,p.alt);drag=null;}});card.addEventListener('keydown',e=>{const step=e.shiftKey?24:8;const map={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};if(map[e.key]){e.preventDefault();card.style.left=`${Math.max(0,card.offsetLeft+map[e.key][0])}px`;card.style.top=`${Math.max(0,card.offsetTop+map[e.key][1])}px`;}});stage.append(card);});}
  $('polaroidOpen').addEventListener('click',()=>{polaroidCount=12;renderPolaroids(true);pd.showModal();});$('polaroidClose').addEventListener('click',()=>pd.close());$('polaroidShuffle').addEventListener('click',()=>renderPolaroids(true));$('polaroidTidy').addEventListener('click',()=>{[...stage.children].forEach((c,i)=>{c.style.left=`${8+(i%4)*22}%`;c.style.top=`${8+Math.floor(i/4)*28}%`;c.style.setProperty('--tilt','0deg');});});$('polaroidMore').addEventListener('click',()=>{polaroidCount+=12;renderPolaroids();});
  function update(){posts=window.archivePosts||[];songs=window.archiveSongs||[];notes=window.archiveThoughts||[];noises=window.archiveNoises||[];if(!window._archiveEnhancementsStarted){window._archiveEnhancementsStarted=true;setupJournal();setupAboutPhotoFlash();}renderJournal();renderDeal();renderCounters();renderNotes();swapNote();addKeepControls();renderPocket();}
  window.addEventListener('archive-content-updated',update);window.addEventListener('archive-kiss-updated',renderPocket);if(window.archivePosts||window.archiveSongs)update();
})();

/* Daily kiss: one claim per day per browser, with a streak. */
(() => {
  const $ = id => document.getElementById(id);
  const button = $('kissButton');
  if (!button) return;
  const label = $('kissButtonLabel'), message = $('kissMessage'), stats = $('kissStats'), note = $('kissNote'), burst = $('kissBurst'), awardsRoot=$('kissAwards');
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
  const defaultMilestones=[{type:'streak',target:3,sticker:'🌱',title:'A little beginning'},{type:'streak',target:7,sticker:'🌷',title:'One lovely week'},{type:'streak',target:14,sticker:'💌',title:'Two weeks close'},{type:'streak',target:30,sticker:'💖',title:'A month of kisses'},{type:'total',target:10,sticker:'✨',title:'Ten kisses kept'},{type:'total',target:50,sticker:'🌟',title:'Fifty sweet days'},{type:'total',target:100,sticker:'💎',title:'One hundred kisses'}];
  let milestones=defaultMilestones;
  const KEY = 'archiveKissGame';
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const safeStickerGraphic=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:'';}catch(_){return '';}};
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { last: typeof v.last === 'string' ? v.last : '', streak: Number(v.streak) || 0, total: Number(v.total) || 0, wallet:Number.isFinite(Number(v.wallet))?Math.max(0,Math.floor(Number(v.wallet))):(Number(v.total)||0), awards:Array.isArray(v.awards)?v.awards.filter(a=>a&&['streak','total'].includes(a.type)&&Number(a.target)>0&&(a.sticker||safeStickerGraphic(a.graphic))&&a.title).map(a=>({...a,graphic:safeStickerGraphic(a.graphic),earnedAt:Number(a.earnedAt)||0})).slice(0,100):[], unseen:Array.isArray(v.unseen)?v.unseen.filter(x=>typeof x==='string').slice(0,100):[] }; } catch (_) { return { last: '', streak: 0, total: 0, awards:[], unseen:[] }; } };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (_) { return false; } };
  let state = read();
  function awardReachedTotalMilestones(){
    const unlocked=milestones.filter(item=>item.type==='total'&&state.total>=item.target&&!state.awards.some(award=>award.type==='total'&&Number(award.target)===item.target));
    if(!unlocked.length)return false;
    unlocked.forEach(item=>{const award={type:'total',target:item.target,sticker:item.sticker,title:item.title,graphic:item.graphic||'',earnedAt:Date.now()};state.awards.push(award);state.unseen.push(`total-${award.target}`);});
    write(state);
    return true;
  }
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
    stats.textContent = `${streak} day${streak === 1 ? '' : 's'} in a row · ${state.total} kiss${state.total === 1 ? '' : 'es'} claimed · ${state.wallet} available`;
    renderAwards();window.archiveKissSnapshot={available:!claimed,total:state.total,streak,kissesAvailable:state.wallet,awards:state.awards,unseen:state.unseen};window.dispatchEvent(new CustomEvent('archive-kiss-updated'));
  }
  function renderAwards(){if(!awardsRoot)return;awardsRoot.replaceChildren();awardsRoot.hidden=!state.total&&!state.awards.length;if(awardsRoot.hidden)return;const heading=document.createElement('p');heading.className='kiss-awards-heading';heading.textContent=`Sticker collection · ${state.awards.length} earned`;awardsRoot.append(heading);if(!state.awards.length){const empty=document.createElement('p');empty.className='kiss-awards-empty';empty.textContent='Your first sticker is waiting at a kiss milestone.';awardsRoot.append(empty);return;}state.awards.forEach(award=>{const item=document.createElement('div');item.className='kiss-award';item.setAttribute('aria-label',`${award.title}, ${award.type==='streak'?'streak':'total'} of ${award.target}`);const graphicBox=document.createElement('div');graphicBox.className='kiss-award-graphic';const graphic=safeStickerGraphic(award.graphic);if(graphic){const sticker=document.createElement('img');sticker.className='kiss-award-sticker kiss-award-image';sticker.src=graphic;sticker.alt='';sticker.addEventListener('error',()=>{const fallback=document.createElement('span');fallback.className='kiss-award-sticker';fallback.setAttribute('aria-hidden','true');fallback.textContent=award.sticker||'✦';sticker.replaceWith(fallback);},{once:true});graphicBox.append(sticker);}else{const sticker=document.createElement('span');sticker.className='kiss-award-sticker';sticker.setAttribute('aria-hidden','true');sticker.textContent=award.sticker||'✦';graphicBox.append(sticker);}const copy=document.createElement('div');copy.className='kiss-award-copy';const title=document.createElement('span');title.className='kiss-award-title';title.textContent=award.title;const detail=document.createElement('small');detail.textContent=award.type==='streak'?`${award.target}-day streak`:`${award.target} kisses`;copy.append(title,detail);item.append(graphicBox,copy);awardsRoot.append(item);});}
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
    state = {...state,last:today,streak,total:state.total+1,wallet:(state.wallet||0)+1,awards:state.awards||[],unseen:state.unseen||[]};
    const unlocked=milestones.filter(item=>item.type==='streak'&&streak>=item.target&&!state.awards.some(award=>award.type===item.type&&Number(award.target)===item.target));
    unlocked.forEach(item=>{const award={type:item.type,target:item.target,sticker:item.sticker,title:item.title,graphic:item.graphic||'',earnedAt:Date.now()};state.awards.push(award);state.unseen.push(`${award.type}-${award.target}`);});
    awardReachedTotalMilestones();
    write(state);
    render();
    floatHearts();
    navigator.vibrate?.(25);
  });
  window.archiveAddKisses = amount => {const value=Math.max(0,Math.floor(Number(amount)||0));if(!value)return false;const previous=state;state={...state,total:(state.total||0)+value,wallet:(state.wallet||0)+value,awards:state.awards||[],unseen:state.unseen||[]};awardReachedTotalMilestones();if(!write(state)){state=previous;return false;}render();return true;};
  window.archiveSpendKisses = amount => {const value=Math.max(0,Math.floor(Number(amount)||0));if(!value||(state.wallet||0)<value)return false;const previous=state;state={...state,wallet:state.wallet-value};if(!write(state)){state=previous;return false;}render();return true;};
  window.archiveSetKissMessages = list => { messages = Array.isArray(list) && list.length ? list : defaults; render(); };
  window.archiveSetKissMilestones = list => {milestones=(Array.isArray(list)?list:defaultMilestones).map(item=>({type:item?.type==='total'?'total':'streak',target:Math.floor(Number(item?.target)),sticker:String(item?.sticker||'').trim().slice(0,12),title:String(item?.title||'').trim().slice(0,70),graphic:safeStickerGraphic(item?.graphic)})).filter(item=>item.target>0&&item.target<=10000&&(item.sticker||item.graphic)&&item.title);if(awardReachedTotalMilestones())render();};
  window.archiveClaimKissAward = key => {state.unseen=state.unseen.filter(item=>item!==key);write(state);render();};
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
})();

/* Local archive companion: care state stays in this browser. */
(() => {
  const $=id=>document.getElementById(id),toggle=$('archivePetToggle'),panel=$('archivePetPanel');
  if(!toggle||!panel)return;
  const KEY='archiveCompanionV1';
  const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  const defaults={name:'Peanut',type:'cat',fullness:78,happiness:82,energy:72,lastAt:Date.now(),petKisses:0,petKissAt:{}};
  const pets={cat:['🐈','😿','😸'],dog:['🐕','🐶','🐕‍🦺'],bunny:['🐇','🐰','🐰'],fox:['🦊','🦊','🦊'],hamster:['🐹','🐹','🐹'],mouse:['🐭','🐭','🐭'],rabbit:['🐰','🐰','🐰'],'guinea-pig':['🐹','🐹','🐹'],bird:['🐦','🐦','🐦'],parrot:['🦜','🦜','🦜'],fish:['🐠','🐠','🐠'],turtle:['🐢','🐢','🐢'],frog:['🐸','🐸','🐸'],hedgehog:['🦔','🦔','🦔'],pig:['🐷','🐷','🐷'],duck:['🦆','🦆','🦆'],penguin:['🐧','🐧','🐧'],bear:['🐻','🐻','🐻'],unicorn:['🦄','🦄','🦄'],dragon:['🐉','🐉','🐉'],horse:['🐴','🐴','🐴'],cow:['🐮','🐮','🐮'],sheep:['🐑','🐑','🐑'],deer:['🦌','🦌','🦌'],koala:['🐨','🐨','🐨'],sloth:['🦥','🦥','🦥'],seal:['🦭','🦭','🦭'],whale:['🐳','🐳','🐳'],octopus:['🐙','🐙','🐙']};
  const petNames={cat:'Cat',dog:'Dog',bunny:'Bunny',fox:'Fox',hamster:'Hamster',mouse:'Mouse',rabbit:'Rabbit','guinea-pig':'Guinea pig',bird:'Bird',parrot:'Parrot',fish:'Fish',turtle:'Turtle',frog:'Frog',hedgehog:'Hedgehog',pig:'Pig',duck:'Duck',penguin:'Penguin',bear:'Bear',unicorn:'Unicorn',dragon:'Dragon',horse:'Horse',cow:'Cow',sheep:'Sheep',deer:'Deer',koala:'Koala',sloth:'Sloth',seal:'Seal',whale:'Whale',octopus:'Octopus'};
  function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(!value||typeof value!=='object')return {...defaults};const hours=Math.min(72,Math.max(0,(Date.now()-(Number(value.lastAt)||Date.now()))/3600000)),petKissAt={};['fullness','happiness','energy'].forEach(key=>{petKissAt[key]=Math.max(0,Number(value.petKissAt?.[key])||0);});return{name:typeof value.name==='string'&&value.name.trim()&&value.name!=='Mochi'?value.name.trim().slice(0,20):defaults.name,type:pets[value.type]?value.type:defaults.type,fullness:clamp(value.fullness-hours*1.5),happiness:clamp(value.happiness-hours),energy:clamp(value.energy-hours*.8),lastAt:Date.now(),petKisses:Math.max(0,Math.floor(Number(value.petKisses)||0)),petKissAt};}catch(_){return {...defaults};}}
  let state=read();
  const write=()=>{state.lastAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(_){return false;}};
  function renderPetKissReward(){const name=$('petRewardName'),count=$('petKissCount'),balance=$('petKissBalance'),cooldown=$('petKissCooldown');if(name)name.textContent=state.name;if(count)count.textContent=String(state.petKisses||0);if(balance){const kisses=Number(window.archiveKissSnapshot?.kissesAvailable)||0;balance.textContent=`${kisses} kiss${kisses===1?'':'es'} available`;}if(cooldown){const now=Date.now(),times=['fullness','happiness','energy'].map(key=>Number(state.petKissAt?.[key])||0),ready=times.filter(time=>now-time>=7200000).length,next=Math.min(...times.map(time=>Math.max(0,7200000-(now-time))));if(ready)cooldown.textContent=`${ready} of 3 needs are ready to earn a kiss. A need must be below 70%.`;else{const mins=Math.max(1,Math.ceil(next/60000));cooldown.textContent=`Next care kiss in ${Math.floor(mins/60)?`${Math.floor(mins/60)}h ${mins%60}m`:`${mins}m`}. Each need can reward once every 2 hours.`;}}}
  function render(){ $('archivePetName').textContent=state.name;$('archivePetNameInput').value=state.name;$('petGamePetName').textContent=state.name;$('petToys').setAttribute('aria-label',`Choose a toy for ${state.name}`);[['fullness','petFullness'],['happiness','petHappiness'],['energy','petEnergy']].forEach(([key,id])=>{$(id).value=state[key];$(id+'Value').textContent=state[key]+'%';});const lowest=Math.min(state.fullness,state.happiness,state.energy),faces=pets[state.type];$('archivePetFace').textContent=lowest<20?faces[1]:state.happiness>88?faces[2]:faces[0];$('archivePetFace').setAttribute('aria-label',lowest<20?`${state.name} needs some care`:`${state.name}, your ${petNames[state.type].toLowerCase()}`);$('archivePetChoice').textContent=`${faces[0]} ${petNames[state.type]}`;document.querySelectorAll('[data-pet-type]').forEach(option=>option.setAttribute('aria-selected',String(option.dataset.petType===state.type)));renderPetKissReward();window.archivePetSnapshot={name:state.name,fullness:state.fullness,happiness:state.happiness,energy:state.energy};window.dispatchEvent(new CustomEvent('archive-pet-updated'));}
  window.addEventListener('archive-kiss-updated',renderPetKissReward);
  const rewardNeedKisses=(before,keys)=>{const now=Date.now(),previousAt={...state.petKissAt},previousCount=state.petKisses||0,eligible=[...new Set(keys)].filter(key=>before[key]<70&&state[key]>before[key]);let earned=0,waiting=Infinity;eligible.forEach(key=>{const remaining=7200000-(now-(Number(state.petKissAt[key])||0));if(remaining<=0){state.petKissAt[key]=now;earned++;}else waiting=Math.min(waiting,remaining);});if(!earned)return{earned:0,message:eligible.length?` ${state.name} is saving the next care kiss for ${Math.max(1,Math.ceil(waiting/60000))} more minutes.`:''};state.petKisses=previousCount+earned;if(!write()){state.petKissAt=previousAt;state.petKisses=previousCount;return{earned:0,message:' The care kiss could not be saved in this browser.'};}if(!window.archiveAddKisses?.(earned)){state.petKissAt=previousAt;state.petKisses=previousCount;write();return{earned:0,message:' The kiss balance could not be saved in this browser.'};}return{earned,message:` ${state.name} gives you ${earned===1?'a kiss':`${earned} kisses`}! +${earned} kiss${earned===1?'':'es'}.`};};
  function announce(message){$('archivePetGreeting').textContent=message;}
  function show(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');$('archivePetClose').focus();}
  function hide(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
  toggle.addEventListener('click',()=>{if(panel.hidden&&matchMedia('(max-width: 620px)').matches){$('pocketPanel')?.setAttribute('hidden','');}panel.hidden?show():hide();});$('archivePetClose').addEventListener('click',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)hide();});
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target)){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  document.querySelectorAll('[data-pet-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.petAction,before={...state};let message='',needs=[];if(action==='feed'){state.fullness=clamp(state.fullness+30);state.happiness=clamp(state.happiness+5);needs=['fullness','happiness'];message=`${state.name} enjoyed a little snack.`;}if(action==='cuddle'){state.happiness=clamp(state.happiness+10);needs=['happiness'];message=`${state.name} leans into your cuddle.`;}if(action==='play'){if(state.energy<10){message=`${state.name} is sleepy. A nap would feel nice.`;}else{state.happiness=clamp(state.happiness+18);state.energy=clamp(state.energy-14);state.fullness=clamp(state.fullness-7);needs=['happiness'];message=`${state.name} had fun playing with you.`;}}if(action==='rest'){state.energy=clamp(state.energy+28);needs=['energy'];message=`${state.name} is tucked in for a little nap.`;}const reward=rewardNeedKisses(before,needs),saved=write();render();announce(message+reward.message+(saved?'':' Care progress could not be saved in this browser.'));}));
  $('archivePetNameSave').addEventListener('click',()=>{const value=$('archivePetNameInput').value.trim().replace(/\s+/g,' ').slice(0,20);if(!value){announce('Choose a name first.');return;}state.name=value;const saved=write();render();announce(`${state.name} says hello.`+(saved?'':' Care progress could not be saved in this browser.'));});
  const picker=$('archivePetPicker'),pickerToggle=$('archivePetPickerToggle');
  pickerToggle.addEventListener('click',()=>{const opening=picker.hidden;picker.hidden=!opening;pickerToggle.setAttribute('aria-expanded',String(opening));if(opening)picker.querySelector('[aria-selected="true"]')?.focus();});
  picker.addEventListener('click',event=>{const option=event.target.closest('[data-pet-type]');if(!option)return;state.type=pets[option.dataset.petType]?option.dataset.petType:'cat';write();render();picker.hidden=true;pickerToggle.setAttribute('aria-expanded','false');pickerToggle.focus();announce(`${state.name} is now your ${petNames[state.type].toLowerCase()}.`);});
  picker.addEventListener('keydown',event=>{const options=[...picker.querySelectorAll('[data-pet-type]')],index=options.indexOf(document.activeElement);let next=index;if(event.key==='ArrowDown')next=(index+1)%options.length;else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else if(event.key==='Escape'){picker.hidden=true;pickerToggle.setAttribute('aria-expanded','false');pickerToggle.focus();return;}else return;event.preventDefault();options[next].focus();});
  /* Daily hidden snack: it moves to a different archive section each day. */
  const localDay=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  const dailyKey=(kind)=>`archivePet${kind}Day`,today=localDay();
  const wasDone=(kind)=>{try{return localStorage.getItem(dailyKey(kind))===today;}catch(_){return false;}};
  const markDone=(kind)=>{try{localStorage.setItem(dailyKey(kind),today);}catch(_){/* Keep the reward for this visit if storage is unavailable. */}};
  let snackClaimed=wasDone('Snack'),gamePlayed=wasDone('Game');
  const sections=[...document.querySelectorAll('main section[id]')].filter(section=>section.id!=='kiss');
  if(sections.length){let section=null;try{const savedSpot=JSON.parse(localStorage.getItem('archivePetSnackSpot')||'null');if(savedSpot?.day===today)section=sections.find(item=>item.id===savedSpot.sectionId)||null;}catch(_){}if(!section){section=sections[Math.floor(Math.random()*sections.length)];try{localStorage.setItem('archivePetSnackSpot',JSON.stringify({day:today,sectionId:section.id}));}catch(_){}}const snack=document.createElement('div');snack.className='pet-hidden-snack';const snackButton=document.createElement('button');snackButton.type='button';snackButton.className='pet-snack-button';snackButton.textContent=snackClaimed?'🍓 Today’s treat found':'🍓 A tiny treat';snackButton.setAttribute('aria-label',snackClaimed?'Today’s hidden treat has been found':'Find and give Peanut today’s hidden treat');snackButton.disabled=snackClaimed;const snackStatus=document.createElement('span');snackStatus.className='pet-snack-status';snackStatus.setAttribute('role','status');snackStatus.setAttribute('aria-live','polite');snack.append(snackButton,snackStatus);const heading=section.querySelector('.section-heading');if(heading)heading.after(snack);else section.append(snack);snackButton.addEventListener('click',()=>{if(snackClaimed)return;snackClaimed=true;const before={...state};state.fullness=clamp(state.fullness+18);state.happiness=clamp(state.happiness+4);const reward=rewardNeedKisses(before,['fullness','happiness']),bonusAwarded=window.archiveAddKisses?.(1)===true;if(bonusAwarded){state.petKisses=(state.petKisses||0)+1;write();}const saved=write();markDone('Snack');render();snackButton.disabled=true;snackButton.textContent='🍓 Today’s treat found';snackButton.setAttribute('aria-label',`You found a treat for ${state.name}`);snackStatus.textContent=`A little snack for ${state.name}!${bonusAwarded?` ${state.name} gives you one extra kiss for finding today’s treat (+1).`:' The treat kiss could not be saved in this browser.'}${reward.message}${saved?'':' Care progress could not be saved here.'}`;snack.classList.add('pet-snack-found');});}
  /* Three unique toys are shuffled and saved per local calendar day. */
  const toyPool=[
    {id:'ball',emoji:'⚽',label:'Ball',reaction:'bats the ball around with great determination'},
    {id:'yarn',emoji:'🧶',label:'Yarn',reaction:'discovers that yarn is full of surprises'},
    {id:'feather',emoji:'🪶',label:'Feather',reaction:'gives the feather a very serious little pounce'},
    {id:'mouse',emoji:'🐭',label:'Toy mouse',reaction:'chases the toy mouse across the room'},
    {id:'fish',emoji:'🐟',label:'Fish',reaction:'gives the little fish toy a triumphant toss'},
    {id:'bell',emoji:'🔔',label:'Bell',reaction:'pats the bell and listens to its tiny song'},
    {id:'tunnel',emoji:'🌀',label:'Tunnel',reaction:'dashes through the tunnel and peeks out proudly'},
    {id:'ribbon',emoji:'🎀',label:'Ribbon',reaction:'pounces on the ribbon with perfect timing'},
    {id:'plush',emoji:'🧸',label:'Plush friend',reaction:'cuddles the plush friend after a playful wrestle'},
    {id:'bubbles',emoji:'🫧',label:'Bubbles',reaction:'tries to catch every floating bubble'},
    {id:'leaf',emoji:'🍃',label:'Leaf',reaction:'chases the leaf as it skitters along'},
    {id:'box',emoji:'📦',label:'Little box',reaction:'investigates the little box from every angle'}
  ];
  const dailyToysKey='archivePetToyChoices',gameMessage=$('petGameMessage'),toyRoot=$('petToys');
  function getDailyToys(){
    try{const saved=JSON.parse(localStorage.getItem(dailyToysKey)||'null');if(saved?.day===today&&Array.isArray(saved.ids)){const chosen=saved.ids.map(id=>toyPool.find(toy=>toy.id===id)).filter(Boolean);if(chosen.length===3)return chosen;}}catch(_){}
    const shuffled=[...toyPool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const chosen=shuffled.slice(0,3);
    try{localStorage.setItem(dailyToysKey,JSON.stringify({day:today,ids:chosen.map(toy=>toy.id)}));}catch(_){}
    return chosen;
  }
  const toys=getDailyToys();toyRoot.replaceChildren();
  toys.forEach(toy=>{const button=document.createElement('button');button.type='button';button.dataset.petToy=toy.id;button.setAttribute('aria-label',`Choose ${toy.label.toLowerCase()} for ${state.name}`);button.append(document.createTextNode(toy.emoji));const label=document.createElement('span');label.textContent=toy.label;button.append(label);toyRoot.append(button);button.addEventListener('click',()=>{if(gamePlayed)return;gamePlayed=true;const before={...state};state.happiness=clamp(state.happiness+7);state.energy=clamp(state.energy+4);const reward=rewardNeedKisses(before,['happiness','energy']);markDone('Game');write();render();toys.forEach(option=>{const button=toyRoot.querySelector(`[data-pet-toy="${option.id}"]`);if(button)button.disabled=true;});gameMessage.textContent=`${toy.reaction[0].toUpperCase()+toy.reaction.slice(1)}. A little happiness boost earned.${reward.message} See you tomorrow!`;});});
  if(gamePlayed){toyRoot.querySelectorAll('button').forEach(button=>button.disabled=true);gameMessage.textContent='Today’s toy is picked. Come back tomorrow for another little game.';}
  render();write();
})();

/* Archive notifications: current kiss, pet care, and newly earned stickers. */
(() => {
  const toggle=document.getElementById('archiveNotificationsToggle'),panel=document.getElementById('archiveNotificationsPanel');
  if(!toggle||!panel)return;
  const list=document.getElementById('archiveNotificationList'),badge=document.getElementById('archiveNotificationBadge'),close=document.getElementById('archiveNotificationsClose');
  let customNotifications=[];
  function ageLabel(timestamp){if(!timestamp)return 'Age not recorded';const minutes=Math.max(0,Math.floor((Date.now()-Number(timestamp))/60000));if(minutes<1)return 'Just now';if(minutes<60)return `${minutes} min${minutes===1?'':'s'} ago`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours} hr${hours===1?'':'s'} ago`;const days=Math.floor(hours/24);return `${days} day${days===1?'':'s'} ago`;}
  function readSeenOffers(){try{const refs=JSON.parse(localStorage.getItem('archiveSeenKissOffers')||'[]');return new Set(Array.isArray(refs)?refs:[]);}catch(_){return new Set();}}
  function readSeenCustom(){try{const ids=JSON.parse(localStorage.getItem('archiveSeenCustomNotifications')||'[]');return new Set(Array.isArray(ids)?ids:[]);}catch(_){return new Set();}}
  function collect(){const items=[],kiss=window.archiveKissSnapshot,pet=window.archivePetSnapshot;if(kiss?.available)items.push({text:'Today’s kiss is ready to claim.',target:'kiss'});if(pet){const needs=[];if(pet.fullness<=35)needs.push('a snack');if(pet.energy<=30)needs.push('a nap');if(pet.happiness<=25)needs.push('a cuddle');if(needs.length)items.push({text:`${pet.name} could use ${needs.join(' and ')}.`,target:'pet'});}if(kiss?.awards?.length){const pending=new Set(kiss.unseen||[]);kiss.awards.filter(award=>pending.has(`${award.type}-${award.target}`)).forEach(award=>items.push({text:`Claim sticker: ${award.sticker||'✦'} ${award.title}`,age:ageLabel(award.earnedAt),target:'kissAwards',key:`${award.type}-${award.target}`}));}const seen=readSeenOffers();(window.archiveAcceptedKissOffers||[]).filter(offer=>!seen.has(offer.ref)).forEach(offer=>items.push({text:`Your kiss offer was accepted: ${offer.request||'your requested item'} is now in the market.`,age:ageLabel(Date.parse(offer.createdAt)),target:'marketOffer',ref:offer.ref}));const seenCustom=readSeenCustom();customNotifications.filter(item=>!seenCustom.has(item.id)).forEach(item=>items.push({text:`${item.title}: ${item.message}`,age:ageLabel(item.createdAt),target:'custom',key:item.id}));return items;}
  function renderList(items){list.replaceChildren();if(!items.length){const empty=document.createElement('li');empty.className='notification-empty';empty.textContent='You’re all caught up.';list.append(empty);return;}items.forEach(item=>{const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=item.text;if(item.age){const age=document.createElement('small');age.className='notification-age';age.textContent=item.age;button.append(document.createElement('br'),age);}button.addEventListener('click',()=>{if(item.target==='kissAwards')window.archiveClaimKissAward?.(item.key);if(item.target==='marketOffer'){try{const seen=readSeenOffers();seen.add(item.ref);localStorage.setItem('archiveSeenKissOffers',JSON.stringify([...seen].slice(-100)));}catch(_){}}if(item.target==='custom'){try{const seen=readSeenCustom();seen.add(item.key);localStorage.setItem('archiveSeenCustomNotifications',JSON.stringify([...seen].slice(-100)));}catch(_){}}panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(item.target==='pet'){document.getElementById('archivePetToggle')?.click();return;}if(item.target==='marketOffer'){const marketItem=(window.archiveMarketItems||[]).find(entry=>entry.offerRef===item.ref),card=marketItem?[...document.querySelectorAll('.kiss-market-card')].find(entry=>entry.dataset.marketId===marketItem.id):null;(card||document.getElementById('guestbook'))?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});card?.querySelector('.kiss-market-buy')?.focus({preventScroll:true});refresh();return;}if(item.target==='custom'){refresh();return;}const target=item.target==='kissAwards'?'#kissAwards':'#kiss';document.querySelector(target)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});document.getElementById('kissButton')?.focus({preventScroll:true});});row.append(button);list.append(row);});}
  function refresh(){const items=collect(),count=items.length;badge.textContent=count?String(count):'';badge.hidden=count===0;toggle.setAttribute('aria-label',count?`Notifications, ${count} available`:'Notifications');renderList(items);}
  window.archiveSetCustomNotifications=items=>{customNotifications=(Array.isArray(items)?items:[]).map((item,index)=>({id:String(item?.id||`custom-${index}`),title:String(item?.title||'').trim().slice(0,60),message:String(item?.message||'').trim().slice(0,240),createdAt:Number(item?.createdAt)||0})).filter(item=>item.title&&item.message).slice(0,30);refresh();};
  function open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');refresh();close.focus();}
  function hide(returnFocus=true){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(returnFocus)toggle.focus();}
  toggle.addEventListener('click',()=>panel.hidden?open():hide(false));close.addEventListener('click',()=>hide());document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)hide();});document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))hide(false);});window.addEventListener('archive-kiss-updated',refresh);window.addEventListener('archive-pet-updated',refresh);window.addEventListener('archive-accepted-offers-updated',refresh);setInterval(()=>{window.archiveCheckAcceptedKissOffers?.();refresh();},60000);window.archiveCheckAcceptedKissOffers?.();refresh();
})();

/* Tiny page-wide hide-and-catch visitor game. */
(() => {
  const button=document.getElementById('kamilaRunner'),status=document.getElementById('kamilaRunnerStatus'),progress=document.getElementById('kamilaTapProgress'),closeCall=document.getElementById('kamilaCloseCall'),catchDialog=document.getElementById('kamilaCatchDialog'),catchMessage=document.getElementById('kamilaCatchMessage'),cardArt=document.getElementById('kamilaCardArt'),cardCaption=document.getElementById('kamilaCardCaption'),cardSerial=document.getElementById('kamilaCardSerial'),cardTier=document.getElementById('kamilaCardTier'),cardWorth=document.getElementById('kamilaCardWorth');
  if(!button||!status||!progress||!closeCall)return;
  document.getElementById('kamilaCatchClose')?.addEventListener('click',()=>catchDialog?.close());
  catchDialog?.addEventListener('close',()=>document.getElementById('pocketToggle')?.focus());
  document.getElementById('kamilaCatchPocketButton')?.addEventListener('click',()=>{catchDialog?.close();document.querySelector('[data-pocket-tab="collectibles"]')?.click();const pocketToggle=document.getElementById('pocketToggle'),pocketPanel=document.getElementById('pocketPanel');if(pocketToggle&&pocketPanel?.hidden)pocketToggle.click();else document.getElementById('pocketClose')?.focus();});
  function celebrateCatch(){const photos=(window.archiveKamilaPhotos||[]).filter(photo=>photo?.image);const photo=photos.length?photos[Math.floor(Math.random()*photos.length)]:null;cardArt.replaceChildren();if(photo){const image=document.createElement('img');image.src=photo.image;image.alt=photo.caption||'Kamila collectible photo';cardArt.append(image);cardCaption.textContent=photo.caption||'A little Kamila collectible';const collected=window.archiveCollectKamila?.(photo);if(collected){const tier=collected.tier||'common';cardTier.textContent=tier.toUpperCase();cardTier.className=`kamila-tier-badge ${tier}`;document.getElementById('kamilaTradingCard').className=`kamila-trading-card tier-${tier}`;const value=Number(collected.kissValue)||kamilaCardValues[tier]||1;cardWorth.textContent=`${value} kiss${value===1?'':'es'}`;catchMessage.textContent=`You caught Kamila! Your ${tier.replaceAll('-',' ')} card is worth ${value} kiss${value===1?'':'es'} and has been added to your pocket.`;}else{catchMessage.textContent='You caught Kamila! The card could not be saved; your pocket may be full or unavailable.';}cardSerial.textContent=`NO. ${String(photos.indexOf(photo)+1).padStart(3,'0')}`;}else{const placeholder=document.createElement('p');placeholder.textContent='A Kamila photo card is waiting to be added.';cardArt.append(placeholder);cardCaption.textContent='No card photos have been added yet.';catchMessage.textContent='Congratulations! You caught Kamila. Add photos in the admin to start your card collection.';cardTier.textContent='COMMON';cardTier.className='kamila-tier-badge common';cardWorth.textContent='1 kiss';cardSerial.textContent='NO. —';}catchDialog?.showModal();}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tapsToCatch=5+Math.floor(Math.random()*6),gameToggle=document.getElementById('kamilaGameToggle'),gameSettingStatus=document.getElementById('kamilaGameSettingStatus'),enabledKey='archiveKamilaGameEnabled';let enabled=true;try{enabled=localStorage.getItem(enabledKey)!=='off';}catch(_){}let tapCount=0,caught=false,moveTimer,hideTimer,appearTimer,closeCallTimer,peekTimer,entranceTimer,fastUntil=0,runnerPositioned=false;
  function updateGameControl(message=''){if(gameToggle){gameToggle.textContent=enabled?'Turn Kamila off':'Turn Kamila back on';gameToggle.setAttribute('aria-pressed',String(enabled));}if(gameSettingStatus)gameSettingStatus.textContent=message;}
  function clearGameTimers(){clearTimeout(moveTimer);clearTimeout(hideTimer);clearTimeout(appearTimer);clearTimeout(closeCallTimer);clearTimeout(peekTimer);clearTimeout(entranceTimer);moveTimer=hideTimer=appearTimer=closeCallTimer=peekTimer=entranceTimer=null;button.classList.remove('kamila-hiding','kamila-peeking','kamila-leaving','kamila-entering');button.style.zIndex='';}
  updateGameControl(enabled?'Kamila is playing hide-and-seek.':'Kamila is turned off.');
  gameToggle?.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(enabledKey,enabled?'on':'off');}catch(_){}if(!enabled){clearGameTimers();button.hidden=true;closeCall.hidden=true;updateGameControl('Kamila is turned off.');status.textContent='Kamila is turned off.';return;}if(caught){caught=false;tapCount=0;progress.textContent='';button.setAttribute('aria-label','Catch Kamila');}updateGameControl('Kamila is back to playing hide-and-seek.');status.textContent='Kamila is back! Keep an eye out.';scheduleAppear(1200);});
  function move(){
    const pad=14,width=button.offsetWidth||78,height=button.offsetHeight||78,maxX=Math.max(pad,innerWidth-width-pad),minY=Math.min(90,Math.max(pad,innerHeight*.12)),maxY=Math.max(minY,innerHeight-height-94),chasing=fastChase();
    const objects=[...document.querySelectorAll('.blog-post,.archive-song,.archive-thought,.deal-stack')].filter(el=>{const r=el.getBoundingClientRect();return !el.hidden&&r.width>0&&r.height>0&&r.bottom>90&&r.top<innerHeight-40&&r.right>0&&r.left<innerWidth;});
    const target=objects.length&&Math.random()<(chasing ? .16 : .48)?objects[Math.floor(Math.random()*objects.length)].getBoundingClientRect():null;
    const rect=button.getBoundingClientRect(),startX=Number.isFinite(rect.left)&&rect.width?rect.left:pad+Math.random()*Math.max(0,maxX-pad),startY=Number.isFinite(rect.top)&&rect.height?rect.top:minY+Math.random()*Math.max(0,maxY-minY);
    let x,y;
    if(target){
      const side=Math.floor(Math.random()*4);
      if(side===0){x=target.left-width*.62;y=target.top+Math.random()*Math.max(0,target.height-height);}
      else if(side===1){x=target.right-width*.38;y=target.top+Math.random()*Math.max(0,target.height-height);}
      else if(side===2){x=target.left+Math.random()*Math.max(0,target.width-width);y=target.top-height*.62;}
      else{x=target.left+Math.random()*Math.max(0,target.width-width);y=target.bottom-height*.38;}
      // Approach a hiding place in a short, believable scurry instead of leaping across the page.
      const approach=chasing ? .48 : .3;x=startX+(x-startX)*approach;y=startY+(y-startY)*approach;
    }else{
      const reachX=innerWidth*(chasing ? .42 : .12),reachY=innerHeight*(chasing ? .32 : .095);
      x=startX+(Math.random()*2-1)*reachX;y=startY+(Math.random()*2-1)*reachY;
    }
    x=Math.max(pad,Math.min(maxX,x));y=Math.max(minY,Math.min(maxY,y));
    if(!runnerPositioned){x=pad+Math.random()*Math.max(0,maxX-pad);y=minY+Math.random()*Math.max(0,maxY-minY);button.style.transitionDuration='0s';button.style.left=`${x}px`;button.style.top=`${y}px`;runnerPositioned=true;return;}
    const distance=Math.hypot(x-startX,y-startY),duration=reduced?0:chasing?Math.max(300,Math.min(520,260+distance*.2)):Math.max(2600,Math.min(3900,2300+distance*.45));
    button.style.transitionDuration=reduced?'0s':`${duration}ms`;button.style.left=`${x}px`;button.style.top=`${y}px`;
    clearTimeout(peekTimer);button.classList.remove('kamila-peeking','kamila-hiding');
    if(target&&!reduced){button.classList.add('kamila-hiding');peekTimer=setTimeout(()=>{button.classList.remove('kamila-hiding');button.classList.add('kamila-peeking');peekTimer=setTimeout(()=>button.classList.remove('kamila-peeking'),700+Math.random()*700);},duration*.72);}
  }
  function fastChase(){return Date.now()<fastUntil;}
  function scheduleMove(){if(reduced||!enabled||caught||button.hidden)return;clearTimeout(moveTimer);moveTimer=setTimeout(()=>{if(!enabled||caught||button.hidden)return;move();scheduleMove();},fastChase()?280+Math.random()*170:1900+Math.random()*700);}
  function scheduleAppear(delay){if(!enabled||caught)return;clearTimeout(appearTimer);appearTimer=setTimeout(()=>{appearTimer=null;appear();},delay);}
  function hide(){
    clearTimeout(moveTimer);clearTimeout(peekTimer);clearTimeout(entranceTimer);moveTimer=peekTimer=entranceTimer=null;button.classList.remove('kamila-peeking','kamila-hiding','kamila-entering');
    if(reduced){button.hidden=true;if(enabled&&!caught)scheduleAppear(6500+Math.random()*6500);return;}
    const current=button.getBoundingClientRect(),width=button.offsetWidth||78,height=button.offsetHeight||78;
    const distances=[current.left,innerWidth-current.right,current.top,innerHeight-current.bottom],edge=distances.indexOf(Math.min(...distances));
    let x=current.left,y=current.top;
    if(edge===0)x=-width-12;else if(edge===1)x=innerWidth+12;else if(edge===2)y=-height-12;else y=innerHeight+12;
    button.style.transitionDuration='1450ms';button.classList.add('kamila-leaving');button.style.left=`${x}px`;button.style.top=`${y}px`;
    hideTimer=setTimeout(()=>{button.hidden=true;button.classList.remove('kamila-leaving');button.style.transitionDuration='';runnerPositioned=false;if(enabled&&!caught)scheduleAppear(6500+Math.random()*6500);},1500);
  }
  function appear(){
    if(!enabled||caught||document.hidden)return;
    button.classList.remove('kamila-leaving');button.style.zIndex='';button.hidden=false;
    if(reduced){button.style.transitionDuration='';runnerPositioned=false;move();scheduleMove();hideTimer=setTimeout(hide,12000);return;}
    const width=button.offsetWidth||78,height=button.offsetHeight||78,minY=Math.min(90,Math.max(14,innerHeight*.12)),maxY=Math.max(minY,innerHeight-height-94),fromLeft=Math.random()<.5,y=minY+Math.random()*Math.max(0,maxY-minY);
    const offscreenX=fromLeft?-width-12:innerWidth+12,peekX=fromLeft?-width+24:innerWidth-24,settledX=fromLeft?14:Math.max(14,innerWidth-width-14);
    button.style.transitionDuration='0s';button.style.left=`${offscreenX}px`;button.style.top=`${y}px`;button.classList.add('kamila-entering');runnerPositioned=true;
    requestAnimationFrame(()=>{if(!enabled||caught||button.hidden)return;button.style.transitionDuration='3200ms';button.style.left=`${peekX}px`;entranceTimer=setTimeout(()=>{if(!enabled||caught||button.hidden)return;button.style.transitionDuration='2100ms';button.style.left=`${settledX}px`;entranceTimer=setTimeout(()=>{button.classList.remove('kamila-entering');button.style.transitionDuration='';move();scheduleMove();entranceTimer=null;},2150);},3250);});
    hideTimer=setTimeout(hide,10500+Math.random()*1500);
  }
  button.addEventListener('click',()=>{if(!enabled||caught)return;const old=button.getBoundingClientRect();clearTimeout(entranceTimer);entranceTimer=null;button.classList.remove('kamila-entering');button.style.transitionDuration='';fastUntil=Date.now()+10000;tapCount++;if(tapCount>=tapsToCatch){caught=true;clearTimeout(moveTimer);clearTimeout(hideTimer);clearTimeout(appearTimer);clearTimeout(closeCallTimer);clearTimeout(peekTimer);clearTimeout(entranceTimer);closeCall.hidden=true;button.hidden=true;status.textContent=`You caught Kamila after ${tapCount} quick taps!`;celebrateCatch();return;}progress.textContent=`${tapCount}/${tapsToCatch}`;button.setAttribute('aria-label',`Tap Kamila, ${tapCount} of ${tapsToCatch}`);move();scheduleMove();const remaining=tapsToCatch-tapCount;if(remaining<=2){closeCall.textContent=remaining===1?'Almost!':'So close!';closeCall.style.left=`${Math.min(innerWidth-100,Math.max(10,old.left))}px`;closeCall.style.top=`${Math.max(10,old.top-40)}px`;closeCall.hidden=false;clearTimeout(closeCallTimer);closeCallTimer=setTimeout(()=>{closeCall.hidden=true;},950);}status.textContent=`Kamila dodged you! ${tapCount} of ${tapsToCatch} taps. Keep going.`;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(moveTimer);moveTimer=null;clearTimeout(hideTimer);hideTimer=null;clearTimeout(appearTimer);appearTimer=null;clearTimeout(closeCallTimer);clearTimeout(peekTimer);clearTimeout(entranceTimer);peekTimer=entranceTimer=null;button.classList.remove('kamila-peeking','kamila-hiding','kamila-entering');closeCall.hidden=true;button.hidden=true;}else if(enabled&&!caught)scheduleAppear(1800);});
  if(enabled)scheduleAppear(3200);else button.hidden=true;
})();
