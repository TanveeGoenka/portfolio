// Tanvee Goenka: portfolio
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero: cycles the three phrases every 3s (Figma "after delay 3s, dissolve 100ms")
  const rotator = document.querySelector('[data-rotator]');
  if (rotator) {
    const phrases = [...rotator.children];
    let i = 0;
    setInterval(() => {
      phrases[i].classList.remove('is-active');
      phrases[i].setAttribute('aria-hidden', 'true');
      i = (i + 1) % phrases.length;
      phrases[i].classList.add('is-active');
      phrases[i].removeAttribute('aria-hidden');
    }, 3000);
  }

  // Case studies: scale the 1440px Figma canvas to the viewport width
  const canvas = document.querySelector('.canvas');
  if (canvas) {
    const width = Number(canvas.dataset.width) || 1440;
    const fit = () => canvas.style.setProperty('--canvas-zoom', document.documentElement.clientWidth / width);
    fit();
    window.addEventListener('resize', fit, { passive: true });
  }

  // Mobile case studies: scale each Figma figure to the width of its column
  const figs = document.querySelectorAll('.m-fig__canvas[data-fit]');
  if (figs.length) {
    const fitFigs = () => figs.forEach(f => {
      const w = f.parentElement.clientWidth;
      if (w) f.style.setProperty('--fig-zoom', Math.min(1, w / Number(f.dataset.fit)));
    });
    fitFigs();
    window.addEventListener('resize', fitFigs, { passive: true });
  }
  document.querySelectorAll('.m-scroll[data-start="center"]').forEach(s => { s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2; });

  // Videos load only when they come near the viewport, and pause when off-screen
  const videos = document.querySelectorAll('video[data-src]');
  if (videos.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const { target: v, isIntersecting } of entries) {
        if (isIntersecting) {
          if (!v.src) v.src = v.dataset.src;
          if (reduceMotion) v.controls = true;
          else v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
    }, { rootMargin: '300px 0px' });
    videos.forEach(v => io.observe(v));
  } else {
    videos.forEach(v => { v.src = v.dataset.src; v.controls = true; });
  }
})();
