'use strict';

// One playback owner for the cover and the selected activity. No network services.
/** Controla la reproducción exclusiva de los videos del prototipo. */
export const ParkMedia = (() => {
  let settings = { paused: true, reduced: false, home: false, activity: null };
  let active = null;
  let request = 0;
  const visible = new WeakMap();
  const observed = new Set();

  function pauseAll() {
    request++;
    for (const video of document.querySelectorAll('video[data-media]')) video.pause();
    active = null;
  }

  function candidates() {
    return [...document.querySelectorAll('video[data-media]')].filter(video =>
      video.dataset.media === (settings.home ? 'cover' : settings.activity)
      && !video.closest('[hidden]') && visible.get(video) !== false
      && !video.dataset.failed && !video.dataset.blocked);
  }

  function showBlocked(video) {
    video.classList.remove('video-ready');
    video.dataset.blocked = 'true';
    video.closest('.activity-media, .welcome-media')?.classList.add('video-fallback');
  }

  function reconcile() {
    for (const video of document.querySelectorAll('video[data-media]')) {
      if (settings.reduced) video.classList.remove('video-ready');
    }
    const next = settings.paused || settings.reduced ? null : candidates()[0] || null;
    if (next === active) return;
    pauseAll();
    if (!next) return;
    active = next;
    const ticket = ++request;
    if (!next.getAttribute('src') && next.dataset.src) next.src = next.dataset.src;
    next.muted = true;
    const promise = next.play();
    promise?.then(() => {
      // A render can replace the same video while its first play promise is pending.
      // Only pause when this node no longer owns playback or playback was disabled.
      if (active !== next || settings.paused || settings.reduced) next.pause();
    }).catch(error => {
      if (ticket !== request || error.name === 'AbortError') return;
      showBlocked(next); active = null;
    });
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
    reconcile();
  }, { threshold: .15 });

  function discover() {
    for (const video of observed) {
      if (!video.isConnected) { video.pause(); observer.unobserve(video); observed.delete(video); }
    }
    for (const video of document.querySelectorAll('video[data-media]')) {
      if (observed.has(video)) continue;
      observed.add(video); observer.observe(video);
      video.muted = true;
      video.addEventListener('playing', () => {
        if (video !== active || settings.paused || settings.reduced) { video.pause(); return; }
        video.classList.add('video-ready');
        video.closest('.activity-media, .welcome-media')?.classList.remove('video-fallback');
      });
      video.addEventListener('waiting', () => video.classList.remove('video-ready'));
      video.addEventListener('error', () => {
        if (!video.getAttribute('src')) return;
        video.dataset.failed = 'true'; showBlocked(video);
        if (active === video) { active = null; request++; }
      });
    }
  }

  return {
    sync(nextSettings) { settings = nextSettings; discover(); reconcile(); },
    pauseAll,
    retry() {
      for (const video of document.querySelectorAll('video[data-media]')) {
        delete video.dataset.blocked; delete video.dataset.failed;
      }
      pauseAll();
    },
  };
})();
