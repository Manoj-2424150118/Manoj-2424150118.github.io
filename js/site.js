(function(){
  var rm=window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Mobile menu */
  var toggle=document.getElementById('menuToggle'), links=document.getElementById('navlinks');
  if(toggle&&links){
    toggle.addEventListener('click',function(){
      var open=links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open?'true':'false');
    });
    links.addEventListener('click',function(e){ if(e.target.tagName==='A'){ links.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); }});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&links.classList.contains('open')){ links.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.focus(); }
    });
  }

  /* Footer year */
  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();

  /* Copy email */
  var copyBtn=document.getElementById('copyEmail'), toast=document.getElementById('toast');
  if(copyBtn){
    copyBtn.addEventListener('click',function(){
      var email='sharmamanojkumar697@gmail.com';
      function show(msg){ if(toast){ toast.textContent=msg; toast.classList.add('show'); setTimeout(function(){toast.classList.remove('show')},2200);} }
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(email).then(function(){show('Email copied: '+email)},function(){show(email)});
      } else { show(email); }
    });
  }

  /* Scroll progress bar, nav shadow, back-to-top visibility */
  var nav=document.querySelector('nav');
  var bar=document.getElementById('scrollProgress');
  var toTop=document.getElementById('toTop');
  var ticking=false;
  function onScroll(){
    var st=window.scrollY||document.documentElement.scrollTop;
    var h=document.documentElement.scrollHeight-window.innerHeight;
    if(bar){ bar.style.transform='scaleX('+(h>0?(st/h):0)+')'; }
    if(nav){ nav.classList.toggle('scrolled', st>8); }
    if(toTop){ toTop.classList.toggle('show', st>600); }
    ticking=false;
  }
  window.addEventListener('scroll',function(){
    if(!ticking){ ticking=true; window.requestAnimationFrame(onScroll); }
  },{passive:true});
  onScroll();
  if(toTop){
    toTop.addEventListener('click',function(){
      window.scrollTo({top:0,behavior:rm.matches?'auto':'smooth'});
    });
  }

  /* Scrollspy: mark the nav link for the section in view */
  var spyLinks=document.querySelectorAll('.navlinks a[href^="#"]');
  if(spyLinks.length&&'IntersectionObserver' in window){
    var byId={};
    spyLinks.forEach(function(a){ byId[a.getAttribute('href').slice(1)]=a; });
    var spy=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          spyLinks.forEach(function(a){ a.classList.remove('active'); a.removeAttribute('aria-current'); });
          var link=byId[en.target.id];
          if(link){ link.classList.add('active'); link.setAttribute('aria-current','location'); }
        }
      });
    },{rootMargin:'-40% 0px -55% 0px'});
    Object.keys(byId).forEach(function(id){
      var s=document.getElementById(id);
      if(s) spy.observe(s);
    });
  }

  /* Rotating focus line in the hero (static text remains without JS) */
  var rot=document.getElementById('roleRotator');
  if(rot&&!rm.matches){
    var phrases=['SOC Analysis','Vulnerability Assessment','Threat Intelligence','DevSecOps','AI Security','Secure Software Development'];
    var pi=0, ci=phrases[0].length-1, deleting=false; /* ci=len-1: first tick completes the word, then deletes (ci=len never satisfies ci===word.length after ci++) */
    function tick(){
      var word=phrases[pi];
      if(!deleting){
        ci++;
        rot.textContent=word.slice(0,ci);
        if(ci===word.length){ deleting=true; setTimeout(tick,1700); return; }
        setTimeout(tick,55);
      } else {
        ci--;
        rot.textContent=word.slice(0,ci);
        if(ci===0){ deleting=false; pi=(pi+1)%phrases.length; setTimeout(tick,350); return; }
        setTimeout(tick,28);
      }
    }
    setTimeout(tick,1900);
  }

  /* Project filters */
  var filterBtns=document.querySelectorAll('.filter-btn');
  var cards=document.querySelectorAll('#projects [data-category]');
  var count=document.getElementById('filterCount');
  if(filterBtns.length&&cards.length){
    function applyFilter(f){
      var shown=0;
      cards.forEach(function(c){
        var cats=' '+c.getAttribute('data-category')+' ';
        var show=(f==='all')||(cats.indexOf(' '+f+' ')!==-1);
        c.classList.toggle('hide',!show);
        if(show) shown++;
      });
      if(count) count.textContent='Showing '+shown+' of '+cards.length;
    }
    filterBtns.forEach(function(b){
      b.addEventListener('click',function(){
        filterBtns.forEach(function(x){ x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
        b.classList.add('active'); b.setAttribute('aria-pressed','true');
        applyFilter(b.getAttribute('data-filter'));
      });
    });
    applyFilter('all');
  }

  /* Reveal on scroll */
  var els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(function(e){e.classList.add('in')}); }
  else{
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(x){ if(x.isIntersecting){ x.target.classList.add('in'); io.unobserve(x.target); }});
    },{threshold:0.08});
    els.forEach(function(e){io.observe(e)});
  }
})();

// Hero portrait: eyes follow the visitor's cursor (decorative, motion-safe)
(function(){
  var card = document.querySelector('.portrait-card');
  if(!card) return;
  var irises = card.querySelectorAll('.gaze-iris');
  if(!irises.length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var tx=0, ty=0, cx=0, cy=0, raf=null;
  function loop(){
    cx += (tx-cx)*0.085; cy += (ty-cy)*0.085;
    var s = card.clientWidth/1152;
    var dx = (cx*13*s).toFixed(2), dy = (cy*6*s).toFixed(2);
    for(var i=0;i<irises.length;i++){
      irises[i].style.transform = 'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
    }
    card.style.transform = 'rotateY('+(cx*3.2).toFixed(3)+'deg) rotateX('+(-cy*2.4).toFixed(3)+'deg)';
    if(Math.abs(tx-cx)>0.0005 || Math.abs(ty-cy)>0.0005){ raf = requestAnimationFrame(loop); }
    else { raf = null; }
  }
  function kick(){ if(!raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('pointermove', function(e){
    if(e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    var r = card.getBoundingClientRect();
    if(r.bottom < 0 || r.top > window.innerHeight) return;
    var ex = r.left + r.width*0.5, ey = r.top + r.height*0.37;
    var vx = e.clientX-ex, vy = e.clientY-ey;
    var d = Math.hypot(vx,vy) || 1;
    var m = Math.min(1, d/240);
    tx = (vx/d)*m; ty = (vy/d)*m;
    kick();
  }, {passive:true});
  document.addEventListener('pointerleave', function(){ tx=0; ty=0; kick(); });
})();
