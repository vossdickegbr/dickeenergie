(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const intro = $('[data-welcome-intro]');
  if (intro) {
    const introDelay = prefersReducedMotion ? 250 : 2250;
    const removeDelay = prefersReducedMotion ? 20 : 720;
    window.setTimeout(() => {
      intro.classList.add('is-leaving');
      document.documentElement.classList.remove('intro-running');
      window.setTimeout(() => intro.remove(), removeDelay);
    }, introDelay);
  } else {
    document.documentElement.classList.remove('intro-running');
  }

  const header = $('[data-header]');
  const navToggle = $('.nav-toggle');
  const navigation = $('.site-nav');
  const progress = $('[data-scroll-progress]');

  const updateScrollUI = () => {
    const y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 18);
    if (progress) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.width = `${Math.min(100, Math.max(0, (y / max) * 100))}%`;
    }
  };

  const closeNavigation = () => {
    if (!navToggle || !navigation) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Menü öffnen');
    navigation.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  navToggle?.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Menü öffnen' : 'Menü schließen');
    navigation?.classList.toggle('is-open', !isOpen);
    document.body.classList.toggle('nav-open', !isOpen);
  });

  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNavigation));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNavigation();
  });

  window.addEventListener('scroll', updateScrollUI, { passive: true });
  window.addEventListener('resize', updateScrollUI, { passive: true });
  updateScrollUI();

  const revealItems = $$('.reveal:not(.is-visible)');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.13, rootMargin: '0px 0px -45px' });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const viewTargets = [
    $('.task-transfer'),
    $('[data-humor-moment]'),
    $('[data-savings-scene]')
  ].filter(Boolean);

  if (viewTargets.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      viewTargets.forEach((item) => item.classList.add('in-view'));
    } else {
      const viewObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      }, { threshold: 0.35 });
      viewTargets.forEach((item) => viewObserver.observe(item));
    }
  }

  $$('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  // Gentle perspective tilt: pointer enhancement only, never required for use.
  if (!prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-tilt]').forEach((element) => {
      const strength = Number(element.dataset.tiltStrength || 2.5);
      const reset = () => { element.style.transform = ''; };
      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        element.style.transform = `perspective(1000px) rotateX(${(-y * strength).toFixed(2)}deg) rotateY(${(x * strength).toFixed(2)}deg)`;
      });
      element.addEventListener('pointerleave', reset);
      element.addEventListener('blur', reset, true);
    });

    $$('.magnetic').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        element.style.transform = `translate(${(dx * 0.08).toFixed(1)}px, ${(dy * 0.08).toFixed(1)}px)`;
      });
      element.addEventListener('pointerleave', () => { element.style.transform = ''; });
    });
  }

  // 3D particle orb without external libraries.
  const canvas = $('[data-energy-orb]');
  if (canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (ctx) {
      const points = [];
      const rings = [];
      const count = 92;
      const ringCount = 3;
      let frame = 0;
      let running = true;
      let pointerX = 0;
      let pointerY = 0;
      let targetPointerX = 0;
      let targetPointerY = 0;
      let width = canvas.clientWidth;
      let height = canvas.clientHeight;
      let dpr = Math.min(2, window.devicePixelRatio || 1);

      const makeSphere = () => {
        points.length = 0;
        const phi = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < count; i += 1) {
          const y = 1 - (i / (count - 1)) * 2;
          const radius = Math.sqrt(1 - y * y);
          const theta = phi * i;
          points.push({
            x: Math.cos(theta) * radius,
            y,
            z: Math.sin(theta) * radius,
            phase: Math.random() * Math.PI * 2,
            size: 0.65 + Math.random() * 1.2
          });
        }
        rings.length = 0;
        for (let r = 0; r < ringCount; r += 1) {
          rings.push({ tilt: (r - 1) * 0.58, phase: r * 1.73 });
        }
      };

      const resize = () => {
        width = Math.max(1, canvas.clientWidth);
        height = Math.max(1, canvas.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const rotate = (point, ax, ay) => {
        let { x, y, z } = point;
        const cy = Math.cos(ay); const sy = Math.sin(ay);
        const x1 = x * cy - z * sy;
        const z1 = x * sy + z * cy;
        x = x1; z = z1;
        const cx = Math.cos(ax); const sx = Math.sin(ax);
        const y1 = y * cx - z * sx;
        const z2 = y * sx + z * cx;
        return { x, y: y1, z: z2 };
      };

      const project = (p, radius) => {
        const depth = 3.2 + p.z;
        const scale = 2.9 / depth;
        return {
          x: width / 2 + p.x * radius * scale,
          y: height / 2 + p.y * radius * scale,
          z: p.z,
          scale
        };
      };

      const drawRing = (time, ring, radius, ax, ay) => {
        const segments = 86;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= segments; i += 1) {
          const a = (i / segments) * Math.PI * 2 + time * 0.00008 + ring.phase;
          let point = { x: Math.cos(a), y: Math.sin(a) * 0.34, z: Math.sin(a) * 0.94 };
          point = rotate(point, ax + ring.tilt, ay + ring.phase * 0.12);
          const p = project(point, radius * 1.05);
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else ctx.lineTo(p.x, p.y);
        }
        const grad = ctx.createLinearGradient(width * .25, height * .25, width * .75, height * .75);
        grad.addColorStop(0, 'rgba(216,175,74,.04)');
        grad.addColorStop(.5, 'rgba(184,224,77,.16)');
        grad.addColorStop(1, 'rgba(216,175,74,.03)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };

      const draw = (time = 0) => {
        if (!running) return;
        frame = requestAnimationFrame(draw);
        ctx.clearRect(0, 0, width, height);

        pointerX += (targetPointerX - pointerX) * 0.035;
        pointerY += (targetPointerY - pointerY) * 0.035;

        const radius = Math.min(width, height) * 0.27;
        const ay = time * 0.00016 + pointerX * 0.26;
        const ax = -0.12 + Math.sin(time * 0.00021) * 0.07 + pointerY * 0.18;

        rings.forEach((ring) => drawRing(time, ring, radius, ax, ay));

        const projected = points.map((point) => {
          const rotated = rotate(point, ax + Math.sin(time * 0.0001 + point.phase) * 0.012, ay);
          return { source: point, p: project(rotated, radius), rotated };
        }).sort((a, b) => a.p.z - b.p.z);

        // Sparse nearest-neighbour connections on the front half.
        ctx.lineWidth = 0.55;
        for (let i = 0; i < projected.length; i += 1) {
          const a = projected[i];
          if (a.p.z < -0.1) continue;
          for (let j = i + 1; j < Math.min(projected.length, i + 9); j += 1) {
            const b = projected[j];
            const dx = a.p.x - b.p.x;
            const dy = a.p.y - b.p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius * 0.39) {
              const alpha = Math.max(0, .09 * (1 - dist / (radius * .39)) * (a.p.z + 1));
              ctx.strokeStyle = `rgba(189,220,91,${alpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(a.p.x, a.p.y);
              ctx.lineTo(b.p.x, b.p.y);
              ctx.stroke();
            }
          }
        }

        projected.forEach(({ source, p }) => {
          const front = (p.z + 1) / 2;
          const pulse = .82 + Math.sin(time * 0.0013 + source.phase) * .18;
          const size = source.size * (0.65 + front * 1.7) * pulse;
          const glow = size * 3.8;
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
          const goldMix = Math.max(0, Math.min(1, (source.x + 1) / 2));
          gradient.addColorStop(0, goldMix > .55 ? `rgba(236,207,121,${(.78 * front + .15).toFixed(2)})` : `rgba(196,234,91,${(.78 * front + .15).toFixed(2)})`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = front > .55 ? '#eef6bd' : 'rgba(216,186,100,.72)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(.55, size), 0, Math.PI * 2);
          ctx.fill();
        });
      };

      const shell = canvas.closest('.hero-experience');
      if (shell && window.matchMedia('(pointer: fine)').matches) {
        shell.addEventListener('pointermove', (event) => {
          const rect = shell.getBoundingClientRect();
          targetPointerX = ((event.clientX - rect.left) / rect.width - .5) * 2;
          targetPointerY = ((event.clientY - rect.top) / rect.height - .5) * 2;
        });
        shell.addEventListener('pointerleave', () => {
          targetPointerX = 0;
          targetPointerY = 0;
        });
      }

      makeSphere();
      resize();
      window.addEventListener('resize', resize, { passive: true });

      if (prefersReducedMotion) {
        running = true;
        draw(0);
        cancelAnimationFrame(frame);
        running = false;
      } else {
        draw();
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            running = false;
            cancelAnimationFrame(frame);
          } else if (!running) {
            running = true;
            draw();
          }
        });
      }
    }
  }

  // Contact micro-builder: intentionally no private/business split.
  const builder = $('[data-contact-builder]');
  if (builder) {
    const state = { energy: 'Strom', intent: 'prüfen' };
    const preview = $('[data-message-preview]', builder);
    const copyButton = $('[data-copy-request]', builder);
    const copyStatus = $('[data-copy-status]', builder);

    const buildMessage = () => {
      const contract = state.energy === 'Strom und Gas' ? 'meine Strom- und Gasverträge' : `meinen ${state.energy}vertrag`;
      if (state.intent === 'Arbeit abgeben') return `Hallo Björn, ich möchte ${contract} künftig nicht mehr selbst managen und die Arbeit gerne abgeben.`;
      if (state.intent === 'kurz sprechen') return `Hallo Björn, ich würde gerne kurz über ${contract} sprechen.`;
      return `Hallo Björn, ich möchte ${contract} einfach prüfen lassen.`;
    };

    const updateLinks = () => {
      const message = buildMessage();
      if (preview) preview.textContent = message;
    };

    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const message = buildMessage();
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(message);
            copied = true;
          } catch (_) {
            copied = false;
          }
        }
        if (!copied) {
          const helper = document.createElement('textarea');
          helper.value = message;
          helper.setAttribute('readonly', '');
          helper.style.position = 'absolute';
          helper.style.left = '-9999px';
          document.body.appendChild(helper);
          helper.select();
          try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
          helper.remove();
        }
        if (copyStatus) {
          copyStatus.textContent = copied
            ? 'Anfragetext kopiert. Wenn Sie möchten, rufen Sie uns direkt unter 0179 2675002 an.'
            : 'Ihre Anfrage ist vorbereitet. Sie erreichen uns direkt unter 0179 2675002.';
        }
      });
    }

    $$('.choice', builder).forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.dataset.group;
        const value = button.dataset.value;
        if (!group || !value || !(group in state)) return;
        state[group] = value;
        $$(`.choice[data-group="${group}"]`, builder).forEach((choice) => {
          choice.classList.toggle('is-active', choice === button);
        });
        updateLinks();
      });
    });
    updateLinks();
  }
})();
