(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  // Year
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // Header + progress
  const header = $('[data-header]');
  const progress = $('[data-page-progress]');
  const updateChrome = () => {
    const y = window.scrollY || 0;
    header?.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      progress.style.width = `${clamp(y / max, 0, 1) * 100}%`;
    }
  };
  updateChrome();
  addEventListener('scroll', updateChrome, { passive: true });

  // Mobile menu
  const menuBtn = $('[data-menu-button]');
  const nav = $('[data-nav]');
  const closeMenu = () => {
    nav?.classList.remove('is-open');
    menuBtn?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };
  menuBtn?.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });
  $$('a', nav || document).forEach(a => a.addEventListener('click', closeMenu));

  // iOS/Safari can keep transformed fixed navigation layers composited after closing.
  // Always reset the mobile menu when the page/navigation state changes.
  addEventListener('pageshow', closeMenu);
  addEventListener('hashchange', closeMenu);
  addEventListener('orientationchange', closeMenu);
  addEventListener('resize', () => {
    if (innerWidth > 760) closeMenu();
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  // Reveal observer
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Pointer parallax hero
  const hero = $('[data-hero]');
  const city = $('[data-city-parallax]');
  if (hero && city && !reduceMotion && matchMedia('(pointer:fine)').matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 10;
      ty = ((e.clientY - r.top) / r.height - .5) * 5;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
    function tick() {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      city.style.transform = `translate3d(${cx}px,${cy}px,0) scale(1.012)`;
      if (Math.abs(tx-cx) > .02 || Math.abs(ty-cy) > .02) raf = requestAnimationFrame(tick); else raf = 0;
    }
  }

  // Hero Rhine canvas: flowing luminous current through the skyline
  const rhine = $('[data-rhine-canvas]');
  if (rhine && !reduceMotion) createCurrentCanvas(rhine, 'hero');
  const finalCurrent = $('[data-final-current]');
  if (finalCurrent && !reduceMotion) createCurrentCanvas(finalCurrent, 'final');

  function createCurrentCanvas(canvas, mode) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const state = { w: 0, h: 0, dpr: 1, particles: [], visible: true, frame: 0, mx: 0, my: 0 };
    const baseCount = mode === 'hero' ? 92 : 54;

    const pathPoint = (t, time) => {
      if (mode === 'hero') {
        const yBase = state.h * (.74 + .018 * Math.sin(time * .00018));
        const x = state.w * (-.05 + 1.1 * t);
        const y = yBase + Math.sin(t * Math.PI * 2.1 + .5) * state.h * .055 + Math.sin(t * 10 + time * .00025) * 3;
        return { x: x + state.mx * 10 * (1-t), y: y + state.my * 4 };
      }
      const x = state.w * (-.1 + 1.2 * t);
      const y = state.h * (.58 + Math.sin(t * 7.2 + .6) * .085);
      return { x, y };
    };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      state.dpr = Math.min(devicePixelRatio || 1, 1.75);
      state.w = Math.max(1, rect.width); state.h = Math.max(1, rect.height);
      canvas.width = Math.round(state.w * state.dpr); canvas.height = Math.round(state.h * state.dpr);
      ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
      state.particles = Array.from({ length: innerWidth < 700 ? Math.round(baseCount * .55) : baseCount }, (_,i) => ({
        t: (i / baseCount + Math.random() * .1) % 1,
        speed: .000055 + Math.random() * .000075,
        size: .55 + Math.random() * 1.7,
        alpha: .15 + Math.random() * .55,
        phase: Math.random() * 10
      }));
    }
    resize(); addEventListener('resize', resize, { passive: true });

    if (mode === 'hero' && matchMedia('(pointer:fine)').matches) {
      canvas.parentElement?.addEventListener('pointermove', e => {
        state.mx = (e.clientX / innerWidth - .5); state.my = (e.clientY / innerHeight - .5);
      }, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; if (state.visible && !state.frame) state.frame = requestAnimationFrame(draw); }, { threshold: 0 });
      obs.observe(canvas);
    }

    function draw(time=0) {
      state.frame = 0;
      if (!state.visible || document.hidden) return;
      ctx.clearRect(0,0,state.w,state.h);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // multiple river bands for depth
      for (let layer=0; layer<4; layer++) {
        ctx.beginPath();
        const points = 110;
        for (let i=0;i<=points;i++) {
          const t=i/points, p=pathPoint(t,time);
          const offset=(layer-1.5)*(mode==='hero'?5:8);
          const yy=p.y+offset;
          if(i===0) ctx.moveTo(p.x,yy); else ctx.lineTo(p.x,yy);
        }
        const grad=ctx.createLinearGradient(0,0,state.w,0);
        grad.addColorStop(0,'rgba(126,158,63,0)'); grad.addColorStop(.18,`rgba(151,187,73,${.11-layer*.012})`); grad.addColorStop(.5,`rgba(235,208,109,${.16-layer*.018})`); grad.addColorStop(.82,`rgba(169,206,79,${.12-layer*.012})`); grad.addColorStop(1,'rgba(126,158,63,0)');
        ctx.strokeStyle=grad; ctx.lineWidth=(mode==='hero'?15:22)-layer*3; ctx.shadowBlur=18; ctx.shadowColor='rgba(219,193,91,.25)'; ctx.stroke();
      }

      state.particles.forEach(p => {
        p.t += p.speed * 16.67; if (p.t > 1) p.t -= 1;
        const pos=pathPoint(p.t,time); const pulse=.6+.4*Math.sin(time*.003+p.phase);
        ctx.beginPath(); ctx.arc(pos.x,pos.y,p.size*(.7+pulse*.5),0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.t>.55?'205,229,104':'240,208,109'},${p.alpha*pulse})`;
        ctx.shadowBlur=12; ctx.shadowColor=p.t>.55?'rgba(190,224,91,.6)':'rgba(236,197,88,.55)'; ctx.fill();
      });
      ctx.restore();
      state.frame=requestAnimationFrame(draw);
    }
    state.frame=requestAnimationFrame(draw);
  }

  // Scroll-drawn handover path
  const flowPath = $('[data-flow-path]');
  if (flowPath) {
    const len = flowPath.getTotalLength?.() || 1;
    flowPath.style.strokeDasharray = String(len);
    flowPath.style.strokeDashoffset = String(len);
    const stage = $('[data-handover]');
    const updateFlow = () => {
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const p = clamp((innerHeight * .77 - r.top) / (r.height * .9), 0, 1);
      flowPath.style.strokeDashoffset = String(len * (1-p));
    };
    updateFlow(); addEventListener('scroll', updateFlow, { passive: true });
  }

  // 3D tilt – restrained and only on focal objects
  if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
    $$('[data-tilt]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r=el.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width-.5; const y=(e.clientY-r.top)/r.height-.5;
        const base=el.classList.contains('bill-3d') ? 'perspective(1200px) rotateY(-8deg) rotateX(5deg)' : 'perspective(1000px)';
        el.style.transform=`${base} rotateX(${-y*5}deg) rotateY(${x*6}deg) translateY(-2px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform=''; });
    });
  }

  // One restrained humor moment: a side-note slides out from behind the bill once.
  const savingsVisual = $('[data-savings-visual]');
  const humorReceipt = $('[data-humor-receipt]');
  if (savingsVisual && humorReceipt) {
    const revealHumor = () => humorReceipt.classList.add('is-revealed');
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > .34) {
          setTimeout(revealHumor, reduceMotion ? 0 : 520);
          obs.disconnect();
        }
      }, { threshold: [.34] });
      obs.observe(savingsVisual);
    } else revealHumor();
  }

  // Zero cost words – staggered only once
  const zeroSection = $('[data-zero-cost]');
  if (zeroSection) {
    const words = $$('[data-zero-word]', zeroSection);
    const activate = () => words.forEach((w,i)=>setTimeout(()=>w.classList.add('is-active'), reduceMotion?0:i*210));
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(([e])=>{ if(e.isIntersecting && e.intersectionRatio>.22){activate();obs.disconnect();} },{threshold:[.22]});
      obs.observe(zeroSection);
    } else activate();
  }

  // Magnetic CTA, subtle
  if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
    $$('.magnet').forEach(el => {
      el.addEventListener('pointermove', e => { const r=el.getBoundingClientRect(); el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.07}px,${(e.clientY-r.top-r.height/2)*.1}px)`; });
      el.addEventListener('pointerleave',()=>el.style.transform='');
    });
  }

  // WhatsApp conversion builder: two low-friction choices + optional name.
  const waBuilder = $('[data-whatsapp-builder]');
  if (waBuilder) {
    const waPreview = $('[data-wa-preview]', waBuilder);
    const waLink = $('[data-wa-link]', waBuilder);
    const nameInput = $('input[name="name"]', waBuilder);
    const selections = { energy: '', customer: '' };

    const energyText = {
      strom: 'Stromtarife',
      gas: 'Gastarife',
      beides: 'Strom- und Gastarife'
    };

    function buildWaMessage() {
      const { energy, customer } = selections;
      const name = String(nameInput?.value || '').trim();
      if (!energy || !customer) {
        waPreview.textContent = 'Wählen Sie oben kurz Strom, Gas oder beides und ob es um Sie privat oder Ihr Unternehmen geht.';
        waLink.classList.add('is-disabled');
        waLink.setAttribute('aria-disabled', 'true');
        waLink.href = '#';
        return;
      }

      const subject = energyText[energy];
      const context = customer === 'unternehmen'
        ? `die ${subject} für mein Unternehmen`
        : `meine ${subject}`;
      const signoff = name ? `\n\nLG\n${name}` : '\n\nLG';
      const text = `Hey Björn, ich würde gerne ${context} bei euch checken lassen.${signoff}`;

      waPreview.textContent = text;
      waLink.href = `https://wa.me/491792675002?text=${encodeURIComponent(text)}`;
      waLink.classList.remove('is-disabled');
      waLink.setAttribute('aria-disabled', 'false');
    }

    $$('.choice-block', waBuilder).forEach(block => {
      const key = block.dataset.choice;
      $$('.choice-pill', block).forEach(button => {
        button.addEventListener('click', () => {
          $$('.choice-pill', block).forEach(other => {
            const active = other === button;
            other.classList.toggle('is-selected', active);
            other.setAttribute('aria-pressed', String(active));
          });
          selections[key] = button.dataset.value || '';
          buildWaMessage();
        });
      });
    });

    nameInput?.addEventListener('input', buildWaMessage);
    waLink.addEventListener('click', e => {
      if (waLink.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        const firstMissing = !selections.energy
          ? $('[data-choice="energy"]', waBuilder)
          : $('[data-choice="customer"]', waBuilder);
        firstMissing?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        firstMissing?.classList.add('needs-choice');
        setTimeout(() => firstMissing?.classList.remove('needs-choice'), 700);
      }
    });
    buildWaMessage();
  }
})();
