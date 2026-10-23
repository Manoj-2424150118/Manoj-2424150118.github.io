(function(){
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
  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
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
  var rm=window.matchMedia('(prefers-reduced-motion: reduce)');
  var els=document.querySelectorAll('.reveal');
  if(rm.matches||!('IntersectionObserver' in window)){ els.forEach(function(e){e.classList.add('in')}); }
  else{
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(x){ if(x.isIntersecting){ x.target.classList.add('in'); io.unobserve(x.target); }});
    },{threshold:0.08});
    els.forEach(function(e){io.observe(e)});
  }
})();
