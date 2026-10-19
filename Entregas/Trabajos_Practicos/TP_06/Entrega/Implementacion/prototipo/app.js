import { ACTIVITY_TERMS } from './terms.js';
import { ParkMedia } from './media.js';

'use strict';

// Prototipo visual: datos en memoria; no registra inscripciones.
const ICON_PATHS = {
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>', back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  plus: '<path d="M5 12h14M12 5v14"/>', minus: '<path d="M5 12h14"/>',
  left: '<path d="m14 5-7 7 7 7"/>', right: '<path d="m10 5 7 7-7 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 18c10 4 16-4 15-15ZM3 21 16 8"/>',
};
const ACTIVITIES = [
  { id: 'safari', name: 'Safari', capacity: 8, age: 'Todas las edades', clothing: false,
    story: 'Un encuentro con lo extraordinario.', description: 'Dejá que la curiosidad marque el camino.',
    terms: ACTIVITY_TERMS.safari },
  { id: 'tirolesa', name: 'Tirolesa', capacity: 10, age: 'Desde 8 años', clothing: true,
    story: 'Otra forma de ver el mundo.', description: 'Entre los árboles, la aventura toma vuelo.',
    terms: ACTIVITY_TERMS.tirolesa },
  { id: 'palestra', name: 'Palestra', capacity: 12, age: 'Desde 12 años', clothing: true,
    story: 'Un poquito más alto, un poco más lejos.', description: 'Encontrá tu próximo desafío, paso a paso.',
    terms: ACTIVITY_TERMS.palestra },
  { id: 'jardineria', name: 'Jardinería', capacity: 12, age: 'Todas las edades', clothing: false,
    story: 'Las grandes cosas empiezan pequeñas.', description: 'Conectá con la tierra y descubrí lo que crece.',
    terms: ACTIVITY_TERMS.jardineria },
];
const STEP_LABELS = ['Actividad', 'Fecha y horario', 'Participantes', 'Confirmación'];
const PARK_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const SLOT_TIMES = Array.from({ length: 9 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`);
const SLOT_WINDOW_MINUTES = { opens: 15, closes: 24 * 60 };
const state = { view: 'home', step: 0, activity: 'safari', date: null, time: null, count: 1,
  participants: [{}], email: '', accepted: false, confirmed: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const transitionAnimations = new Set();
let fieldFocused = false;
let toastTimer;
let modalTrigger = null;
let bannerKey = '';
let mailCleanup = null;
let scheduleRefreshTimer = null;
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
const activity = () => ACTIVITIES.find(item => item.id === state.activity);
const countText = () => `${state.count} ${state.count === 1 ? 'persona' : 'personas'}`;
const dateText = () => state.date
  ? new Intl.DateTimeFormat('es-AR', { timeZone: PARK_TIME_ZONE, day: 'numeric', month: 'long' }).format(slotDate(state.date, '12:00'))
  : 'Por elegir';
const primary = (label, action) => `<button class="primary" data-action="${action}">${label}${icon('arrow')}</button>`;

function parkParts(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(reference).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { ...parts, date: `${parts.year}-${parts.month}-${parts.day}` };
}

function slotDate(date, time) {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: PARK_TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${date}T${time}:00Z`))
    .find(part => part.type === 'timeZoneName')?.value?.replace('GMT', '') || '+00:00';
  return new Date(`${date}T${time}:00${offset}`);
}

function nextParkDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', { timeZone: PARK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.UTC(year, month - 1, day + 1, 15)))
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function nextParkDateKey(date) {
  const next = nextParkDate(date);
  return `${next.year}-${next.month}-${next.day}`;
}

function isParkClosed(date) {
  const midday = slotDate(date, '12:00');
  return midday.getUTCDay() === 1 || (midday.getUTCMonth() === 11 && midday.getUTCDate() === 25) || (midday.getUTCMonth() === 0 && midday.getUTCDate() === 1);
}

function isAvailableSlot(date, time, now = new Date()) {
  if (isParkClosed(date) || !SLOT_TIMES.includes(time)) return false;
  const minutesUntilStart = (slotDate(date, time).getTime() - now.getTime()) / 60000;
  return minutesUntilStart >= SLOT_WINDOW_MINUTES.opens && minutesUntilStart <= SLOT_WINDOW_MINUTES.closes;
}

function availableSchedule(now = new Date()) {
  const parkNow = parkParts(now);
  const dates = [
    { key: parkNow.date, label: 'Hoy' },
    { key: nextParkDateKey(parkNow.date), label: 'Mañana' },
  ];
  return dates.map(day => ({ ...day, slots: SLOT_TIMES.filter(time => isAvailableSlot(day.key, time, now)) }));
}

function parkTimeLabel(now = new Date()) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: PARK_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

function parkDayLabel(date) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: PARK_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' })
    .format(slotDate(date, '12:00'));
}

function selectionKey(date, time) {
  return `${date}-${time}`;
}

function clearExpiredSlot(now = new Date()) {
  if (!state.date || !state.time || isAvailableSlot(state.date, state.time, now)) return false;
  state.date = null;
  state.time = null;
  state.confirmed = false;
  return true;
}

const ACTIVITY_MEDIA = {
  safari: { photo: 'assets/photos/safari.jpg', poster: 'assets/photos/safari.jpg', video: 'assets/videos/safari.mp4', position: '50% 45%' },
  tirolesa: { photo: 'assets/photos/tirolesa-video.jpg', poster: 'assets/photos/tirolesa-video.jpg', video: 'assets/videos/tirolesa-590f8c2d8334.mp4', position: '50% 45%', ticketPosition: '50% 60%' },
  palestra: { photo: 'assets/photos/palestra.jpg', poster: 'assets/photos/palestra.jpg', video: 'assets/videos/palestra.mp4?v=0b7c52cdf7b2', position: '50% 50%', ticketPosition: '50% 72%' },
  jardineria: { photo: 'assets/photos/jardineria.jpg', poster: 'assets/photos/jardineria.jpg', video: 'assets/videos/jardineria.mp4', position: '50% 45%' },
};

function activityMedia(item, extra = '', preview = false, position = null) {
  const media = ACTIVITY_MEDIA[item.id];
  return `<div class="activity-media ${extra}" style="--media-position:${position || media.position}" aria-hidden="true">
    <img src="${media.photo}" alt="" decoding="async" draggable="false">
    ${preview && media.video ? `<video class="media-video" data-media="${item.id}" data-src="${media.video}" poster="${media.poster}" muted loop playsinline preload="none" tabindex="-1"></video><span class="motion-status">En movimiento</span>` : ''}
  </div>`;
}

function renderBanner() {
  const item = activity();
  const banner = byId('park-banner');
  banner.hidden = state.step === 0;
  const key = `compact-${item.id}`;
  if (key === bannerKey) return;
  bannerKey = key;
  banner.className = 'park-banner compact-banner';
  banner.innerHTML = `${activityMedia(item, 'banner-art')}<div class="compact-copy"><span>Tu próxima experiencia</span><h2>${item.name}</h2><p>${item.story}</p></div><button class="change-activity" data-action="activities">Cambiar actividad ${icon('back')}</button>`;
}

function updateScreen() {
  const home = state.view === 'home';
  const mail = document.body.classList.contains('mail-view');
  document.body.classList.toggle('home-view', home && !mail);
  byId('welcome').hidden = !home || mail;
  byId('main').hidden = home || mail;
  byId('action-dock').hidden = home || mail;
  document.querySelector('.site-footer').hidden = home;
  document.querySelector('.skip-link').href = mail ? '#mail-preview' : home ? '#welcome-title' : '#stage';
}

function itinerary() {
  return `<dl class="itinerary"><div><dt>${icon('calendar')}Fecha</dt><dd>${dateText()}</dd></div><div><dt>${icon('clock')}Horario</dt><dd>${state.time || 'Por elegir'}</dd></div><div><dt>${icon('people')}Participantes</dt><dd>${countText()}</dd></div></dl>`;
}

function nextAction() {
  return [['Elegir horario', 'next'], ['Agregar participantes', 'next'],
    ['Ver resumen', 'next'], state.confirmed ? ['Elegir otra actividad', 'activities'] : ['Confirmar inscripción', 'confirm']][state.step];
}

function renderChrome() {
  const item = activity();
  const [label, action] = nextAction();
  document.body.dataset.step = String(state.step);
  byId('stepper').innerHTML = `<div class="journey-track" aria-hidden="true"><span style="--progress:${state.step / 3}"></span></div>`
    + STEP_LABELS.map((name, index) => `<button class="journey-step ${index === state.step ? 'active' : ''} ${index < state.step ? 'completed' : ''}" data-step="${index}" ${index === state.step ? 'aria-current="step"' : ''}><span class="step-marker">${index < state.step ? icon('check') : index + 1}</span><span>${name}</span></button>`).join('');
  byId('experience').innerHTML = `<div class="summary-title">${icon('leaf')}Tu experiencia</div>${activityMedia(item, 'summary-art')}<div class="summary-name"><h2>${item.name}</h2><span>1 hora</span></div>${itinerary()}${primary(label, action)}`;
  byId('action-dock').innerHTML = `<div class="dock-content"><button class="dock-summary" data-action="itinerary" aria-label="Ver resumen de tu experiencia"><span class="dock-leaf">${icon('leaf')}</span><span><strong>${item.name}</strong><small>${state.step > 1 ? countText() : '1 hora de conexión'}</small></span></button>${primary(state.step === 0 ? 'Elegir horario' : state.step === 1 ? 'Participantes' : state.step === 2 ? 'Ver resumen' : state.confirmed ? 'Otra actividad' : 'Confirmar inscripción', action)}</div>`;
}

function heading(title, subtitle) {
  return `<div class="stage-heading">${state.step ? `<button class="back-link" data-action="previous">${icon('back')}Volver</button>` : `<button class="back-link" data-action="home">${icon('back')}Volver al inicio</button>`}<h1 id="stage-title">${title}</h1><p>${subtitle}</p></div>`;
}

function activityStage() {
  return `<section class="activity-selection">${heading('Elegí tu próxima experiencia.', 'Cada aventura empieza con una elección.')}<div class="activity-grid">${ACTIVITIES.map(item => `<button class="activity-card ${item.id === state.activity ? 'selected' : ''}" data-activity="${item.id}" aria-pressed="${item.id === state.activity}"><div class="activity-visual">${activityMedia(item, '', item.id === state.activity)}<span class="activity-duration">${icon('clock')}1 hora</span><span class="selection-mark">${icon('check')}</span></div><div class="activity-info"><div class="activity-name"><h3>${item.name}</h3><span class="activity-arrow">${icon('arrow')}</span></div><p>${item.description}</p><div class="activity-meta"><span>${icon('people')}${item.capacity} lugares por turno</span><span>${item.age}</span></div></div></button>`).join('')}</div><div class="activity-bottom"><p>${icon('leaf')}Un momento en la naturaleza puede cambiar tu día.</p></div></section>`;
}

function scheduleStage() {
  const now = new Date();
  const groups = availableSchedule(now);
  const slotGroup = day => {
    const closed = isParkClosed(day.key);
    const headingId = `schedule-${day.label.toLowerCase()}`;
    const content = closed
      ? `<p class="schedule-empty">El parque permanece cerrado ${day.label.toLowerCase()}.</p>`
      : day.slots.length
        ? `<div class="slot-grid">${day.slots.map(time => {
          const selected = state.date === day.key && state.time === time;
          const end = `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`;
          const key = selectionKey(day.key, time);
          return `<button class="slot-card ${selected ? 'selected' : ''}" data-slot-date="${day.key}" data-slot-time="${time}" data-slot-key="${key}" aria-pressed="${selected}" aria-label="${day.label}, ${parkDayLabel(day.key)}, de ${time} a ${end}, ${activity().capacity} lugares disponibles"><span class="slot-time">${time}<small>–${end}</small></span><span class="slot-capacity">${icon('people')}${activity().capacity} lugares disponibles</span><span class="slot-choice-mark">${icon('check')}</span></button>`;
        }).join('')}</div>`
        : `<p class="schedule-empty">No hay turnos dentro de la ventana de inscripción para ${day.label.toLowerCase()}.</p>`;
    return `<section class="schedule-day surface" aria-labelledby="${headingId}"><div class="schedule-day-head"><div><span>${day.label}</span><h2 id="${headingId}">${parkDayLabel(day.key)}</h2></div>${icon('calendar')}</div>${content}</section>`;
  };
  return `${heading('Elegí tu momento.', 'Podés inscribirte desde 24 horas hasta 15 minutos antes del inicio.')}<div class="park-clock">${icon('clock')}Hora del parque: <strong>${parkTimeLabel(now)}</strong></div><div class="schedule-groups">${groups.map(slotGroup).join('')}</div>`;
}

function participantsStage() {
  const item = activity();
  return `${heading('La aventura se comparte.', 'Sumá a quienes van a vivir este momento con vos.')}<div class="quantity-row"><div><h2>¿Cuántas personas participan?</h2><p>Completá los datos de cada una.</p></div><div class="counter"><button data-action="less" aria-label="Quitar participante" ${state.count === 1 ? 'disabled' : ''}>${icon('minus')}</button><span aria-live="polite">${state.count}</span><button data-action="more" aria-label="Agregar participante">${icon('plus')}</button></div></div><div class="participants-list">${Array.from({ length: state.count }, (_, index) => {
    const person = state.participants[index] || {};
    return `<section class="participant-card" aria-labelledby="person-title-${index}"><div class="person-title"><span>${String(index + 1).padStart(2, '0')}</span><h2 id="person-title-${index}">Participante ${index + 1}</h2>${icon('person')}</div><div class="fields"><label class="field field-name">Nombre y apellido<input data-person="${index}" data-field="name" autocomplete="off" placeholder="Por ejemplo, Sofía Martínez" value="${escapeHtml(person.name)}"></label><label class="field">DNI<input data-person="${index}" data-field="dni" inputmode="numeric" autocomplete="off" placeholder="Sin puntos" value="${escapeHtml(person.dni)}"></label><label class="field">Edad<input data-person="${index}" data-field="age" inputmode="numeric" autocomplete="off" placeholder="En años" value="${escapeHtml(person.age)}"></label>${item.clothing ? `<label class="field field-size">Talle de vestimenta<select aria-label="Talle de vestimenta" data-person="${index}" data-field="size"><option value="">Elegir talle</option>${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => `<option ${person.size === size ? 'selected' : ''}>${size}</option>`).join('')}</select></label>` : ''}</div></section>`;
  }).join('')}</div><section class="contact-section"><div class="contact-heading">${icon('mail')}<div><h2>Tu experiencia, también en tu correo.</h2><p>Ingresá el email en el que querés recibir tu confirmación.</p></div></div><label class="field">Email de contacto<input type="email" data-field="email" autocomplete="email" placeholder="nombre@ejemplo.com" value="${escapeHtml(state.email)}"></label></section><div class="terms-row"><input id="accept-terms" type="checkbox" ${state.accepted ? 'checked' : ''} aria-label="Aceptar términos y condiciones de ${item.name}"><div><label for="accept-terms">Acepto los términos de esta actividad.</label><button class="text-button" data-action="terms">Leer términos de ${item.name} ${icon('arrow')}</button></div></div>`;
}

function qr() {
  let rectangles = '';
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (left, top) => x >= left && x < left + 7 && y >= top && y < top + 7;
      let black;
      if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
        const dx = x - (x >= 14 ? 14 : 0);
        const dy = y - (y >= 14 ? 14 : 0);
        black = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      } else black = ((x * 17 + y * 23 + x * y) % 7) < 3;
      if (black) rectangles += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  return `<div class="qr" role="img" aria-label="Código QR de tu inscripción"><svg viewBox="-2 -2 25 25" aria-hidden="true">${rectangles}</svg></div>`;
}

function ticket(confirmed = state.confirmed) {
  const item = activity();
  return `<article class="ticket"><div class="ticket-visual ticket-visual-${item.id}">${activityMedia(item, 'ticket-art', false, ACTIVITY_MEDIA[item.id].ticketPosition)}<span class="ticket-overline">EcoHarmony Park · ${confirmed ? 'Tu pase' : 'Tu experiencia'}</span>${confirmed ? `<span class="ticket-stamp" aria-label="Inscripción confirmada">${icon('leaf')}<span>Inscripción<br>confirmada</span></span>` : ''}</div><div class="ticket-body"><div class="ticket-heading"><div><span>Tu encuentro con la naturaleza</span><h2>${item.name}</h2></div><span class="duration-pill">${icon('clock')}1 hora</span></div>${itinerary()}${confirmed ? `<div class="ticket-perforation"></div><div class="qr-row">${qr()}<div><h3>Tu pase para la actividad.</h3><p>Presentá este QR al llegar a tu actividad.</p></div></div>` : ''}</div></article>`;
}

function confirmationStage() {
  const title = state.confirmed ? '¡Tu próxima aventura está confirmada!' : 'Revisá tu inscripción.';
  const subtitle = state.confirmed ? 'Tené tu pase a mano al llegar a la actividad.' : 'Comprobá los datos de tu experiencia antes de confirmar.';
  const actions = state.confirmed
    ? `<button class="secondary" data-action="mail">${icon('mail')}Ver confirmación por correo${icon('arrow')}</button>`
    : primary('Confirmar inscripción', 'confirm');
  return `${heading(title, subtitle)}<div class="confirmation-layout">${ticket()}<section class="review-participants"><h2>Quienes te acompañan</h2>${state.participants.slice(0, state.count).map((person, index) => `<div class="review-person">${icon('person')}<div><strong>${escapeHtml(person.name || `Participante ${index + 1}`)}</strong><small>${person.age !== undefined && person.age !== '' ? `${escapeHtml(person.age)} años` : 'Edad por completar'}${activity().clothing ? ` · Talle ${escapeHtml(person.size || 'por elegir')}` : ''}</small></div></div>`).join('')}${state.confirmed ? '' : `<button class="text-button" data-action="edit">Editar participantes ${icon('arrow')}</button>`}</section></div><div class="summary-actions">${actions}</div>`;
}

function canAnimate(keyboard = false) {
  return !keyboard && !reducedMotion.matches;
}

function animateElement(element, frames, options, collection = transitionAnimations) {
  if (!element || !element.animate) return null;
  const animation = element.animate(frames, options);
  collection.add(animation);
  animation.finished.catch(() => {}).finally(() => collection.delete(animation));
  return animation;
}

function syncMotion() {
  const paused = reducedMotion.matches || fieldFocused || document.hidden || byId('modal').open;
  document.body.classList.toggle('motion-paused', paused);
  document.body.classList.toggle('motion-reduced', reducedMotion.matches);
  if (reducedMotion.matches) {
    for (const animation of transitionAnimations) {
      try { animation.finish(); } catch { animation.cancel(); }
    }
  }
  ParkMedia.sync({ paused, reduced: reducedMotion.matches,
    home: state.view === 'home' && !document.body.classList.contains('mail-view'),
    activity: state.view === 'booking' && state.step === 0 && !document.body.classList.contains('mail-view') ? state.activity : null });
}

function render({ navigate = false, keyboard = false, focus = null } = {}) {
  ParkMedia.pauseAll();
  updateScreen();
  if (state.view === 'home') {
    syncScheduleRefresh();
    syncMotion();
    if (navigate) {
      byId('welcome-title').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    return;
  }
  renderBanner();
  renderChrome();
  byId('stage').innerHTML = [activityStage, scheduleStage, participantsStage, confirmationStage][state.step]();
  syncScheduleRefresh();
  syncMotion();
  if (navigate) {
    byId('stage').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (canAnimate(keyboard)) {
      animateElement(byId('stage'), [{ opacity: .5, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
      if (state.step === 3) animateElement(document.querySelector('.ticket-stamp'), [{ transform: 'rotate(-18deg) scale(1.18)', opacity: 0 }, { transform: 'rotate(-9deg) scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
  }
  if (focus) document.querySelector(focus)?.focus({ preventScroll: true });
}

function refreshScheduleForClock() {
  if (state.view !== 'booking' || state.step !== 1 || document.hidden) return;
  const activeSlot = document.activeElement?.dataset?.slotKey;
  const expired = clearExpiredSlot();
  render({ focus: activeSlot ? `[data-slot-key="${activeSlot}"]` : null });
  if (expired) toast('El horario elegido ya no admite inscripción. Elegí otro.');
}

function syncScheduleRefresh() {
  clearInterval(scheduleRefreshTimer);
  scheduleRefreshTimer = null;
  if (state.view === 'booking' && state.step === 1) scheduleRefreshTimer = setInterval(refreshScheduleForClock, 60000);
}

function openModal(content, keyboard = false) {
  modalTrigger = document.activeElement;
  byId('modal-content').innerHTML = content;
  const dialog = byId('modal');
  if (!dialog.open) dialog.showModal();
  if (canAnimate(keyboard)) animateElement(dialog, [{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
}

function toast(message) {
  clearTimeout(toastTimer);
  byId('toast').textContent = message;
  byId('toast').classList.add('visible');
  toastTimer = setTimeout(() => byId('toast').classList.remove('visible'), 3000);
}

function allowedOrigin(event) {
  return event.origin === location.origin;
}

function mailWindow(keyboard = false) {
  mailCleanup?.();
  const snapshot = { activity: state.activity, date: state.date, time: state.time,
    participants: state.participants.slice(0, state.count).map(person => ({ ...person })), email: state.email };
  const opened = window.open(`?vista=correo&preview=${Date.now()}`, 'ecoharmony-correo', 'width=720,height=900');
  const fallback = () => openModal(`<h2 id="modal-title">Tu correo, a un paso.</h2><p>No pudimos abrir la confirmación en otra ventana. Podés volver a intentar o ver el correo aquí, conservando los datos del recorrido.</p><div class="modal-actions">${primary('Ver la confirmación aquí', 'mail-inline')}<button class="text-button" data-action="mail">Volver a intentar en otra ventana ${icon('arrow')}</button></div>`, keyboard);
  if (!opened) { fallback(); return; }
  let delivered = false;
  const listener = event => {
    if (event.source !== opened || !allowedOrigin(event)) return;
    if (event.data === 'eco-mail-ready') {
      opened.postMessage({ type: 'eco-preview', snapshot }, location.origin === 'null' ? '*' : location.origin);
    } else if (event.data === 'eco-mail-rendered') {
      delivered = true; cleanup(); toast('Confirmación abierta en otra ventana.');
    }
  };
  const timeout = setTimeout(() => {
    cleanup();
    if (!delivered) { try { opened.close(); } catch {} fallback(); }
  }, 5000);
  function cleanup() { clearTimeout(timeout); window.removeEventListener('message', listener); mailCleanup = null; }
  mailCleanup = cleanup;
  window.addEventListener('message', listener);
}

function receiveSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !ACTIVITIES.some(item => item.id === raw.activity)) return false;
  if (!Array.isArray(raw.participants) || raw.participants.length === 0) return false;
  const people = raw.participants.map(person => {
    const cleaned = {};
    for (const key of ['name', 'dni', 'age', 'size']) {
      if (person && typeof person[key] === 'string') cleaned[key] = person[key];
    }
    return cleaned;
  });
  state.activity = raw.activity; state.participants = people; state.count = people.length;
  state.email = typeof raw.email === 'string' ? raw.email : '';
  state.date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && !Number.isNaN(Date.parse(raw.date)) ? raw.date : null;
  state.time = typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : null;
  return true;
}

function renderMail() {
  document.title = 'EcoHarmony Park · Confirmación de inscripción';
  document.body.classList.add('mail-view');
  clearInterval(scheduleRefreshTimer);
  scheduleRefreshTimer = null;
  ParkMedia.pauseAll();
  state.view = 'booking'; updateScreen();
  byId('main').hidden = true; byId('action-dock').hidden = true;
  let shell = document.querySelector('.mail-shell');
  if (!shell) {
    shell = document.createElement('main'); shell.className = 'mail-shell'; shell.id = 'mail-preview'; shell.tabIndex = -1;
    document.body.insertBefore(shell, document.querySelector('.site-footer'));
  }
  document.querySelector('.skip-link').href = '#mail-preview';
  shell.innerHTML = `${document.body.classList.contains('mail-inline') ? `<button class="back-link mail-back" data-action="mail-back">${icon('back')}Volver al resumen</button>` : ''}<div class="mail-toolbar">${icon('mail')}Confirmación de inscripción<span>EcoHarmony Park</span></div><div class="mail-meta"><h1>Tu próxima aventura te espera.</h1><dl><div><dt>De</dt><dd>EcoHarmony Park</dd></div><div><dt>Para</dt><dd>${escapeHtml(state.email || 'nombre@ejemplo.com')}</dd></div><div><dt>Asunto</dt><dd>Tu experiencia en EcoHarmony Park</dd></div></dl></div><div class="mail-content"><div class="mail-intro">${icon('leaf')}<h2>La naturaleza te espera.</h2><p>Estos son los detalles de tu inscripción.</p></div>${ticket(true)}<section class="mail-people"><h2>Participantes</h2>${state.participants.map((person, index) => `<p>${escapeHtml(person.name || `Participante ${index + 1}`)}${person.age !== undefined && person.age !== '' ? ` · ${escapeHtml(person.age)} años` : ''}${activity().clothing ? ` · Talle ${escapeHtml(person.size || 'por elegir')}` : ''}</p>`).join('')}</section><div class="mail-attachment">${icon('mail')}<div><strong>Pase para la actividad</strong><p>Presentá el QR al llegar a tu actividad.</p></div></div></div>`;
  syncMotion();
}

function handleButton(button, keyboard) {
  if (button.dataset.step !== undefined) {
    state.step = Number(button.dataset.step);
    const expired = state.step === 1 && clearExpiredSlot();
    render({ navigate: true, keyboard });
    if (expired) toast('El horario elegido ya no admite inscripción. Elegí otro.');
    return;
  }
  if (button.dataset.activity) {
    state.confirmed = false;
    state.activity = button.dataset.activity; state.accepted = false;
    render({ keyboard, focus: `[data-activity="${state.activity}"]` });
    return;
  }
  if (button.dataset.slotDate && button.dataset.slotTime) {
    const date = button.dataset.slotDate;
    const time = button.dataset.slotTime;
    if (!isAvailableSlot(date, time)) {
      state.date = null;
      state.time = null;
      render();
      toast('El horario elegido ya no admite inscripción. Elegí otro.');
      return;
    }
    state.date = date;
    state.time = time;
    state.confirmed = false;
    render({ keyboard, focus: `[data-slot-key="${selectionKey(date, time)}"]` });
    return;
  }
  const action = button.dataset.action;
  if (action === 'mail-back' || (action === 'home' && document.body.classList.contains('mail-inline'))) {
    document.body.classList.remove('mail-view', 'mail-inline');
    document.querySelector('.mail-shell')?.remove();
    byId('main').hidden = false; byId('action-dock').hidden = false;
    document.querySelector('.skip-link').href = '#stage';
    document.title = 'EcoHarmony Park · Un parque vivo';
    state.view = action === 'home' ? 'home' : 'booking';
    render({ navigate: true, keyboard }); return;
  }
  if (action === 'home') {
    if (document.body.classList.contains('mail-view')) { location.href = './index.html'; return; }
    state.view = 'home'; render({ navigate: true, keyboard });
  } else if (action === 'enter' || action === 'activities') {
    state.confirmed = false;
    state.view = 'booking'; state.step = 0; render({ navigate: true, keyboard });
  } else if (action === 'confirm') {
    state.confirmed = true;
    render({ navigate: true, keyboard });
  } else if (action === 'next') {
    state.step = Math.min(3, state.step + 1);
    const expired = state.step === 1 && clearExpiredSlot();
    render({ navigate: true, keyboard });
    if (expired) toast('El horario elegido ya no admite inscripción. Elegí otro.');
  } else if (action === 'previous') {
    state.step = Math.max(0, state.step - 1);
    const expired = state.step === 1 && clearExpiredSlot();
    render({ navigate: true, keyboard });
    if (expired) toast('El horario elegido ya no admite inscripción. Elegí otro.');
  } else if (action === 'edit') {
    state.confirmed = false;
    state.step = 2; render({ navigate: true, keyboard });
  } else if (action === 'more') {
    state.confirmed = false;
    state.count++; state.participants.push({}); render({ keyboard, focus: '[data-action="more"]' });
    if (canAnimate(keyboard)) animateElement(document.querySelector('.participant-card:last-child'), [{ opacity: .4, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
  } else if (action === 'less' && state.count > 1) {
    state.confirmed = false;
    state.count--; state.participants.pop(); render({ keyboard, focus: state.count === 1 ? '[data-action="more"]' : '[data-action="less"]' });
  } else if (action === 'terms') {
    openModal(`<span class="dialog-leaf">${icon('leaf')}</span><h2 id="modal-title">Términos y condiciones de ${activity().name}</h2><p>Leé las condiciones de participación para esta actividad.</p><ul class="terms-list">${activity().terms.map(term => `<li>${escapeHtml(term)}</li>`).join('')}</ul><div class="modal-actions">${primary('Aceptar términos y condiciones', 'accept-terms')}</div>`, keyboard);
  } else if (action === 'accept-terms') {
    state.accepted = true; byId('modal').close(); render({ keyboard, focus: '[data-action="terms"]' }); toast('Términos y condiciones aceptados');
  } else if (action === 'close-dialog') {
    byId('modal').close();
  } else if (action === 'help') {
    openModal(`<span class="dialog-leaf">${icon('leaf')}</span><h2 id="modal-title">Explorá a tu manera.</h2><p>Elegí una actividad y un turno disponible para hoy o mañana. Después, completá los datos de quienes participan, ingresá tu email y aceptá los términos de la actividad.</p><p>Revisá el resumen antes de confirmar tu inscripción. Al finalizar, tendrás los detalles y el pase con QR para presentar al llegar.</p><div class="modal-actions">${primary('Seguir explorando', 'close-dialog')}</div>`, keyboard);
  } else if (action === 'itinerary') {
    openModal(`<h2 id="modal-title">Tu experiencia</h2>${activityMedia(activity(), 'modal-art')}<h3>${activity().name}</h3>${itinerary()}`, keyboard);
  } else if (action === 'mail') {
    if (byId('modal').open) byId('modal').close(); mailWindow(keyboard);
  } else if (action === 'mail-inline') {
    byId('modal').close(); document.body.classList.add('mail-inline'); renderMail();
    const title = document.querySelector('.mail-meta h1'); title.tabIndex = -1; title.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button && !button.disabled) handleButton(button, event.detail === 0);
});
document.addEventListener('input', event => {
  const element = event.target;
  if (element.dataset.person !== undefined) {
    state.confirmed = false;
    const index = Number(element.dataset.person);
    if (!Number.isInteger(index) || !state.participants[index] || !['name', 'dni', 'age', 'size'].includes(element.dataset.field)) return;
    state.participants[index][element.dataset.field] = element.value;
  } else if (element.dataset.field === 'email') { state.email = element.value; state.confirmed = false; }
  else if (element.id === 'accept-terms') { state.accepted = element.checked; state.confirmed = false; }
});
document.addEventListener('focusin', event => {
  fieldFocused = event.target.matches('input, select, textarea'); syncMotion();
});
document.addEventListener('focusout', () => queueMicrotask(() => {
  fieldFocused = document.activeElement?.matches('input, select, textarea') || false; syncMotion();
}));
document.addEventListener('visibilitychange', () => {
  syncMotion();
  if (!document.hidden) refreshScheduleForClock();
});
reducedMotion.addEventListener('change', syncMotion);
byId('modal').addEventListener('close', () => {
  if (modalTrigger?.isConnected) modalTrigger.focus({ preventScroll: true });
  modalTrigger = null; syncMotion();
});
byId('modal').addEventListener('click', event => {
  if (event.target !== byId('modal')) return;
  const rect = byId('modal').getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) byId('modal').close();
});
window.addEventListener('pagehide', () => { mailCleanup?.(); clearInterval(scheduleRefreshTimer); ParkMedia.pauseAll(); });

if (new URLSearchParams(location.search).get('vista') === 'correo') {
  renderMail();
  window.addEventListener('message', event => {
    if (event.source === window.opener && allowedOrigin(event) && event.data?.type === 'eco-preview' && receiveSnapshot(event.data.snapshot)) {
      renderMail();
      window.opener.postMessage('eco-mail-rendered', location.origin === 'null' ? '*' : location.origin);
    }
  });
  window.opener?.postMessage('eco-mail-ready', location.origin === 'null' ? '*' : location.origin);
} else render();
