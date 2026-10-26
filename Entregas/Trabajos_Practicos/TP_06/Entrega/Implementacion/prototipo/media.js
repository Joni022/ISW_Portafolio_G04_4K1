'use strict';

// Una única instancia coordina portada y actividad seleccionada, sin servicios de red.
/**
 * Controla la reproducción exclusiva de los videos del prototipo.
 * @type {{sync: function(object): void, pauseAll: function(): void, retry: function(): void}}
 */
export const mediosParque = (() => {
  let settings = { paused: true, reduced: false, home: false, activity: null };
  let active = null;
  let request = 0;
  const visible = new WeakMap();
  const observed = new Set();

  /** Detiene todos los medios administrados. @returns {void} */
  function pausarTodos() {
    request++;
    for (const video of document.querySelectorAll('video[data-media]')) {
      video.pause();
    }
    active = null;
  }

  function mediosDisponibles() {
    return [...document.querySelectorAll('video[data-media]')].filter(
      (video) =>
        video.dataset.media === (settings.home ? 'cover' : settings.activity) &&
        !video.closest('[hidden]') &&
        visible.get(video) !== false &&
        !video.dataset.failed &&
        !video.dataset.blocked,
    );
  }

  function mostrarBloqueo(video) {
    video.classList.remove('video-ready');
    video.dataset.blocked = 'true';
    video.closest('.activity-media, .welcome-media')?.classList.add('video-fallback');
  }

  async function reproducirVideo(video, solicitudReproduccion) {
    try {
      await video.play();
      // El render puede reemplazar el nodo mientras se inicia el video.
      if (active !== video || settings.paused || settings.reduced) {
        video.pause();
      }
    } catch (error) {
      if (solicitudReproduccion !== request || error.name === 'AbortError') {
        return;
      }
      mostrarBloqueo(video);
      active = null;
    }
  }

  function conciliarReproduccion() {
    for (const video of document.querySelectorAll('video[data-media]')) {
      if (settings.reduced) {
        video.classList.remove('video-ready');
      }
    }
    const next = settings.paused || settings.reduced ? null : (mediosDisponibles()[0] ?? null);
    if (next === active) {
      return;
    }
    pausarTodos();
    if (!next) {
      return;
    }
    active = next;
    const pase = ++request;
    if (!next.getAttribute('src') && next.dataset.src) {
      next.src = next.dataset.src;
    }
    next.muted = true;
    void reproducirVideo(next, pase);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        visible.set(entry.target, entry.isIntersecting);
      }
      conciliarReproduccion();
    },
    { threshold: 0.15 },
  );

  function detectarMedios() {
    for (const video of observed) {
      if (!video.isConnected) {
        video.pause();
        observer.unobserve(video);
        observed.delete(video);
      }
    }
    for (const video of document.querySelectorAll('video[data-media]')) {
      if (observed.has(video)) {
        continue;
      }
      observed.add(video);
      observer.observe(video);
      video.muted = true;
      video.addEventListener('playing', () => {
        if (video !== active || settings.paused || settings.reduced) {
          video.pause();
          return;
        }
        video.classList.add('video-ready');
        video.closest('.activity-media, .welcome-media')?.classList.remove('video-fallback');
      });
      video.addEventListener('waiting', () => video.classList.remove('video-ready'));
      video.addEventListener('error', () => {
        if (!video.getAttribute('src')) {
          return;
        }
        video.dataset.failed = 'true';
        mostrarBloqueo(video);
        if (active === video) {
          active = null;
          request++;
        }
      });
    }
  }

  return {
    sync(nextSettings) {
      settings = nextSettings;
      detectarMedios();
      conciliarReproduccion();
    },
    pauseAll: pausarTodos,
    retry() {
      for (const video of document.querySelectorAll('video[data-media]')) {
        delete video.dataset.blocked;
        delete video.dataset.failed;
      }
      pausarTodos();
    },
  };
})();
