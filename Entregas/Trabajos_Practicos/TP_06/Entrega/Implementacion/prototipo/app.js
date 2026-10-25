import { TERMINOS_ACTIVIDADES } from './terms.js';
import { mediosParque } from './media.js';
import { CONFIGURACION_PARQUE } from './configuracionParque.js';
import {
  validarAvanceFormulario,
  validarNavegacionFormulario,
} from './validacionAvanceFormulario.js';

('use strict');

// Prototipo visual: datos en memoria; no registra inscripciones.
const TRAZOS_ICONOS = {
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16"/>',
  people:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="m14 5-7 7 7 7"/>',
  right: '<path d="m10 5 7 7-7 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 18c10 4 16-4 15-15ZM3 21 16 8"/>',
};
function crearActividad(id, story, description) {
  const configuracion = CONFIGURACION_PARQUE.actividades[id];
  return {
    id,
    name: configuracion.nombre,
    capacity: configuracion.capacidad,
    age:
      configuracion.edadMinima === 0
        ? 'Todas las edades'
        : `Desde ${configuracion.edadMinima} años`,
    clothing: configuracion.requiereTalle,
    story,
    description,
    terms: TERMINOS_ACTIVIDADES[id],
  };
}
const ACTIVIDADES = [
  crearActividad(
    'safari',
    'Un encuentro con lo extraordinario.',
    'Dejá que la curiosidad marque el camino.',
  ),
  crearActividad(
    'tirolesa',
    'Otra forma de ver el mundo.',
    'Entre los árboles, la aventura toma vuelo.',
  ),
  crearActividad(
    'palestra',
    'Un poquito más alto, un poco más lejos.',
    'Encontrá tu próximo desafío, paso a paso.',
  ),
  crearActividad(
    'jardineria',
    'Las grandes cosas empiezan pequeñas.',
    'Conectá con la tierra y descubrí lo que crece.',
  ),
];
const ETIQUETAS_PASOS = ['Actividad', 'Fecha y horario', 'Participantes', 'Confirmación'];
const ZONA_PARQUE = CONFIGURACION_PARQUE.zonaHoraria;
const HORARIOS_TURNOS = Array.from(
  {
    length: CONFIGURACION_PARQUE.horaUltimoTurno - CONFIGURACION_PARQUE.horaPrimerTurno + 1,
  },
  (_, index) => `${String(index + CONFIGURACION_PARQUE.horaPrimerTurno).padStart(2, '0')}:00`,
);
const MINUTOS_POR_HORA = 60;
const VENTANA_INSCRIPCION_MINUTOS = {
  opens: CONFIGURACION_PARQUE.minutosCierreInscripcion,
  closes: CONFIGURACION_PARQUE.horasAperturaInscripcion * MINUTOS_POR_HORA,
};
const estado = {
  view: 'home',
  step: 0,
  activity: 'safari',
  date: null,
  time: null,
  count: 1,
  participants: [{}],
  email: '',
  accepted: false,
  confirmed: false,
  qrUrl: null,
  errorFormulario: '',
  enviando: false,
  cuposPorTurno: {},
  claveConsultaCupos: '',
};
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const animacionesTransicion = new Set();
let campoEnFoco = false;
let temporizadorAviso;
let origenModal = null;
let claveCabecera = '';
let limpiarCorreo = null;
let temporizadorHorarios = null;
function byId(id) {
  return document.getElementById(id);
}
function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}
function icono(name) {
  return /* HTML */ `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${TRAZOS_ICONOS[name] ?? TRAZOS_ICONOS.info}
  </svg>`;
}
function actividadActual() {
  return ACTIVIDADES.find((actividad) => actividad.id === estado.activity);
}
function textoConAlternativa(valor, alternativa) {
  if (valor === undefined || valor === null || valor === '') {
    return alternativa;
  }
  return valor;
}

function textoDuracion() {
  const minutos = CONFIGURACION_PARQUE.duracionMinutos;
  return minutos === MINUTOS_POR_HORA ? '1 hora' : `${minutos} minutos`;
}

function horaFinTurno(hora) {
  const minutosIniciales = Number(hora.slice(0, 2)) * MINUTOS_POR_HORA + Number(hora.slice(3));
  const minutosFinales = minutosIniciales + CONFIGURACION_PARQUE.duracionMinutos;
  const horas = Math.floor(minutosFinales / MINUTOS_POR_HORA);
  const minutos = minutosFinales % MINUTOS_POR_HORA;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function textoCantidad() {
  return `${estado.count} ${estado.count === 1 ? 'persona' : 'personas'}`;
}
function textoFecha() {
  return estado.date
    ? new Intl.DateTimeFormat('es-AR', {
        timeZone: ZONA_PARQUE,
        day: 'numeric',
        month: 'long',
      }).format(fechaTurno(estado.date, '12:00'))
    : 'Por elegir';
}
function botonPrincipal(label, action) {
  return /* HTML */ `<button
    class="primary"
    data-action="${action}"
    ${action === 'confirm' && estado.enviando ? 'disabled' : ''}
  >
    ${label}${icono('arrow')}
  </button>`;
}

function partesFechaParque(referencia = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_PARQUE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(referencia)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { ...parts, date: `${parts.year}-${parts.month}-${parts.day}` };
}

function fechaTurno(fecha, hora) {
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_PARQUE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${fecha}T${hora}:00Z`))
    .find((part) => part.type === 'timeZoneName')
    ?.value?.replace('GMT', '');
  const offsetCompleto = textoConAlternativa(offset, '+00:00');
  return new Date(`${fecha}T${hora}:00${offsetCompleto}`);
}

function fechaSiguienteParque(fecha) {
  const [year, month, dia] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_PARQUE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date(Date.UTC(year, month - 1, dia + 1, 15)))
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function claveFechaSiguiente(fecha) {
  const next = fechaSiguienteParque(fecha);
  return `${next.year}-${next.month}-${next.day}`;
}

function parqueCerrado(fecha) {
  const midday = fechaTurno(fecha, '12:00');
  return (
    midday.getUTCDay() === 1 ||
    (midday.getUTCMonth() === 11 && midday.getUTCDate() === 25) ||
    (midday.getUTCMonth() === 0 && midday.getUTCDate() === 1)
  );
}

function esTurnoDisponible(fecha, hora, ahora = new Date()) {
  if (parqueCerrado(fecha) || !HORARIOS_TURNOS.includes(hora)) {
    return false;
  }
  const minutesUntilStart = (fechaTurno(fecha, hora).getTime() - ahora.getTime()) / 60000;
  return (
    minutesUntilStart >= VENTANA_INSCRIPCION_MINUTOS.opens &&
    minutesUntilStart <= VENTANA_INSCRIPCION_MINUTOS.closes
  );
}

function horariosDisponibles(ahora = new Date()) {
  const parkNow = partesFechaParque(ahora);
  const dates = [
    { key: parkNow.date, label: 'Hoy' },
    { key: claveFechaSiguiente(parkNow.date), label: 'Mañana' },
  ];
  return dates.map((dia) => ({
    ...dia,
    slots: HORARIOS_TURNOS.filter((hora) => esTurnoDisponible(dia.key, hora, ahora)),
  }));
}

function horaParque(ahora = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_PARQUE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ahora);
}

function diaParque(fecha) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_PARQUE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fechaTurno(fecha, '12:00'));
}

function claveSeleccion(fecha, hora) {
  return `${fecha}-${hora}`;
}

function cuposDisponibles(fecha, hora) {
  return estado.cuposPorTurno[claveSeleccion(fecha, hora)] ?? actividadActual().capacity;
}

function actualizarCuposVisibles() {
  if (estado.view !== 'booking' || estado.step !== 1) {
    return;
  }
  const fechas = horariosDisponibles().map((grupo) => grupo.key);
  const clave = `${estado.activity}|${fechas.join(',')}`;
  if (estado.claveConsultaCupos === clave) {
    return;
  }
  estado.claveConsultaCupos = clave;
  void Promise.all(
    fechas.map(async (fecha) => {
      const respuesta = await fetch(
        `/api/turnos?actividad=${encodeURIComponent(estado.activity)}&fecha=${encodeURIComponent(fecha)}`,
      );
      if (!respuesta.ok) {
        throw new Error('No se pudieron consultar los cupos.');
      }
      return { fecha, datos: await respuesta.json() };
    }),
  )
    .then((resultados) => {
      if (estado.claveConsultaCupos !== clave) {
        return;
      }
      const cupos = {};
      for (const resultado of resultados) {
        for (const turno of resultado.datos.turnos) {
          cupos[claveSeleccion(resultado.fecha, turno.hora)] = turno.cuposDisponibles;
        }
      }
      estado.cuposPorTurno = cupos;
      if (estado.date && estado.time && cupos[claveSeleccion(estado.date, estado.time)] === 0) {
        estado.date = null;
        estado.time = null;
        estado.confirmed = false;
        mostrarAviso('El horario elegido ya no tiene cupos disponibles. Elegí otro.');
      }
      renderizar();
    })
    .catch(() => {
      if (estado.claveConsultaCupos === clave) {
        estado.claveConsultaCupos = '';
        mostrarAviso('No pudimos actualizar los cupos. Intentá nuevamente.');
      }
    });
}

function reiniciarConsultaCupos() {
  estado.cuposPorTurno = {};
  estado.claveConsultaCupos = '';
}

function limpiarTurnoVencido(ahora = new Date()) {
  if (!estado.date || !estado.time || esTurnoDisponible(estado.date, estado.time, ahora)) {
    return false;
  }
  estado.date = null;
  estado.time = null;
  estado.confirmed = false;
  return true;
}

const MEDIOS_ACTIVIDADES = {
  safari: {
    photo: 'assets/photos/safari.jpg',
    poster: 'assets/photos/safari.jpg',
    video: 'assets/videos/safari.mp4',
    position: '50% 45%',
  },
  tirolesa: {
    photo: 'assets/photos/tirolesa-video.jpg',
    poster: 'assets/photos/tirolesa-video.jpg',
    video: 'assets/videos/tirolesa-590f8c2d8334.mp4',
    position: '50% 45%',
    ticketPosition: '50% 60%',
  },
  palestra: {
    photo: 'assets/photos/palestra.jpg',
    poster: 'assets/photos/palestra.jpg',
    video: 'assets/videos/palestra.mp4?v=0b7c52cdf7b2',
    position: '50% 50%',
    ticketPosition: '50% 72%',
  },
  jardineria: {
    photo: 'assets/photos/jardineria.jpg',
    poster: 'assets/photos/jardineria.jpg',
    video: 'assets/videos/jardineria.mp4',
    position: '50% 45%',
  },
};

function medioActividad(actividad, extra = '', preview = false, position = null) {
  const media = MEDIOS_ACTIVIDADES[actividad.id];
  return /* HTML */ `<div
    class="activity-media ${extra}"
    style="--media-position:${position ?? media.position}"
    aria-hidden="true"
  >
    <img src="${media.photo}" alt="" decoding="async" draggable="false" />
    ${preview && media.video ? /* HTML */ `<video class="media-video" data-media="${actividad.id}" data-src="${media.video}" poster="${media.poster}" muted loop playsinline preload="none" tabindex="-1"></video><span class="motion-status">En movimiento</span>` : ''}
  </div>`;
}

function renderizarCabecera() {
  const actividad = actividadActual();
  const banner = byId('park-banner');
  banner.hidden = estado.step === 0;
  const key = `compact-${actividad.id}`;
  if (key === claveCabecera) {
    return;
  }
  claveCabecera = key;
  banner.className = 'park-banner compact-banner';
  banner.innerHTML = /* HTML */ `${medioActividad(actividad, 'banner-art')}
    <div class="compact-copy">
      <span>Tu próxima experiencia</span>
      <h2>${actividad.name}</h2>
      <p>${actividad.story}</p>
    </div>
    <button class="change-activity" data-action="activities">
      Cambiar actividad ${icono('back')}
    </button>`;
}

function actualizarPantalla() {
  const home = estado.view === 'home';
  const mail = document.body.classList.contains('mail-view');
  document.body.classList.toggle('home-view', home && !mail);
  byId('welcome').hidden = !home || mail;
  byId('main').hidden = home || mail;
  byId('action-dock').hidden = home || mail;
  document.querySelector('.site-footer').hidden = home;
  let destino = '#stage';
  if (mail) {
    destino = '#mail-preview';
  } else if (home) {
    destino = '#welcome-title';
  }
  document.querySelector('.skip-link').href = destino;
}

function itinerario() {
  return /* HTML */ `<dl class="itinerary">
    <div>
      <dt>${icono('calendar')}Fecha</dt>
      <dd>${textoFecha()}</dd>
    </div>
    <div>
      <dt>${icono('clock')}Horario</dt>
      <dd>${textoConAlternativa(estado.time, 'Por elegir')}</dd>
    </div>
    <div>
      <dt>${icono('people')}Participantes</dt>
      <dd>${textoCantidad()}</dd>
    </div>
  </dl>`;
}

function accionSiguiente() {
  return [
    ['Elegir horario', 'next'],
    ['Agregar participantes', 'next'],
    ['Ver resumen', 'next'],
    estado.confirmed
      ? ['Elegir otra actividad', 'activities']
      : ['Confirmar inscripción', 'confirm'],
  ][estado.step];
}

function etiquetaAccionMovil() {
  const etiquetas = ['Elegir horario', 'Participantes', 'Ver resumen'];
  if (estado.step < etiquetas.length) {
    return etiquetas[estado.step];
  }
  return estado.confirmed ? 'Otra actividad' : 'Confirmar inscripción';
}

function renderizarNavegacion() {
  const actividad = actividadActual();
  const [label, action] = accionSiguiente();
  document.body.dataset.step = String(estado.step);
  byId('stepper').innerHTML =
    /* HTML */ `<div class="journey-track" aria-hidden="true"><span style="--progress:${estado.step / 3}"></span></div>` +
    ETIQUETAS_PASOS.map(
      (name, index) =>
        /* HTML */ `<button
          class="journey-step ${index === estado.step ? 'active' : ''} ${index < estado.step ? 'completed' : ''}"
          data-step="${index}"
          ${index === estado.step ? 'aria-current="step"' : ''}
        >
          <span class="step-marker">${index < estado.step ? icono('check') : index + 1}</span
          ><span>${name}</span>
        </button>`,
    ).join('');
  byId('experience').innerHTML = /* HTML */ `<div class="summary-title">
      ${icono('leaf')}Tu experiencia
    </div>
    ${medioActividad(actividad, 'summary-art')}
    <div class="summary-name">
      <h2>${actividad.name}</h2>
      <span>${textoDuracion()}</span>
    </div>
    ${itinerario()}${botonPrincipal(label, action)}`;
  byId('action-dock').innerHTML = /* HTML */ `<div class="dock-content">
    <button class="dock-summary" data-action="itinerary" aria-label="Ver resumen de tu experiencia">
      <span class="dock-leaf">${icono('leaf')}</span
      ><span
        ><strong>${actividad.name}</strong
        ><small
          >${estado.step > 1 ? textoCantidad() : `${textoDuracion()} de conexión`}</small
        ></span
      ></button
    >${botonPrincipal(etiquetaAccionMovil(), action)}
  </div>`;
}

function encabezado(title, subtitle) {
  return /* HTML */ `<div class="stage-heading">
    ${estado.step ? /* HTML */ `<button class="back-link" data-action="previous">${icono('back')}Volver</button>` : /* HTML */ `<button class="back-link" data-action="home">${icono('back')}Volver al inicio</button>`}
    <h1 id="stage-title">${title}</h1>
    <p>${subtitle}</p>
  </div>`;
}

function etapaActividad() {
  return /* HTML */ `<section class="activity-selection">
    ${encabezado('Elegí tu próxima experiencia.', 'Cada aventura empieza con una elección.')}
    <div class="activity-grid">
      ${ACTIVIDADES.map(
        (actividad) =>
          /* HTML */ `<button
            class="activity-card ${actividad.id === estado.activity ? 'selected' : ''}"
            data-activity="${actividad.id}"
            aria-pressed="${actividad.id === estado.activity}"
          >
            <div class="activity-visual">
              ${medioActividad(actividad, '', actividad.id === estado.activity)}<span
                class="activity-duration"
                >${icono('clock')}${textoDuracion()}</span
              ><span class="selection-mark">${icono('check')}</span>
            </div>
            <div class="activity-info">
              <div class="activity-name">
                <h3>${actividad.name}</h3>
                <span class="activity-arrow">${icono('arrow')}</span>
              </div>
              <p>${actividad.description}</p>
              <div class="activity-meta">
                <span>${icono('people')}${actividad.capacity} lugares por turno</span
                ><span>${actividad.age}</span>
              </div>
            </div>
          </button>`,
      ).join('')}
    </div>
    <div class="activity-bottom">
      <p>${icono('leaf')}Un momento en la naturaleza puede cambiar tu día.</p>
    </div>
  </section>`;
}

function etapaHorarios() {
  const ahora = new Date();
  const grupos = horariosDisponibles(ahora);
  const grupoDeTurnos = (dia) => {
    const cerrado = parqueCerrado(dia.key);
    const headingId = `schedule-${dia.label.toLowerCase()}`;
    let content;
    if (cerrado) {
      content = /* HTML */ `<p class="schedule-empty">
        El parque permanece cerrado ${dia.label.toLowerCase()}.
      </p>`;
    } else if (dia.slots.length) {
      content = /* HTML */ `<div class="slot-grid">
        ${dia.slots
          .map((hora) => {
            const selected = estado.date === dia.key && estado.time === hora;
            const end = horaFinTurno(hora);
            const key = claveSeleccion(dia.key, hora);
            const cupos = cuposDisponibles(dia.key, hora);
            const agotado = cupos === 0;
            return /* HTML */ `<button
              class="slot-card ${selected ? 'selected' : ''} ${agotado ? 'sold-out' : ''}"
              data-slot-date="${dia.key}"
              data-slot-time="${hora}"
              data-slot-key="${key}"
              aria-pressed="${selected}"
              aria-label="${dia.label}, ${diaParque(dia.key)}, de ${hora} a ${end}, ${cupos} lugares disponibles"
              ${agotado ? 'disabled' : ''}
            >
              <span class="slot-time">${hora}<small>–${end}</small></span
              ><span class="slot-capacity"
                >${icono('people')}${cupos}
                ${cupos === 1 ? 'lugar disponible' : 'lugares disponibles'}</span
              ><span class="slot-choice-mark">${icono('check')}</span>
            </button>`;
          })
          .join('')}
      </div>`;
    } else {
      content = /* HTML */ `<p class="schedule-empty">
        No hay turnos dentro de la ventana de inscripción para ${dia.label.toLowerCase()}.
      </p>`;
    }
    return /* HTML */ `<section class="schedule-day surface" aria-labelledby="${headingId}">
      <div class="schedule-day-head">
        <div>
          <span>${dia.label}</span>
          <h2 id="${headingId}">${diaParque(dia.key)}</h2>
        </div>
        ${icono('calendar')}
      </div>
      ${content}
    </section>`;
  };
  return /* HTML */ `${encabezado('Elegí tu momento.', 'Podés inscribirte desde 24 horas hasta 15 minutos antes del inicio.')}
    ${estado.errorFormulario ? /* HTML */ `<p class="form-error" role="alert">${escapeHtml(estado.errorFormulario)}</p>` : ''}
    <div class="park-clock">
      ${icono('clock')}Hora del parque: <strong>${horaParque(ahora)}</strong>
    </div>
    <div class="schedule-groups">${grupos.map(grupoDeTurnos).join('')}</div>`;
}

function etapaParticipantes() {
  const actividad = actividadActual();
  return /* HTML */ `${encabezado('La aventura se comparte.', 'Sumá a quienes van a vivir este momento con vos.')}
    ${estado.errorFormulario ? /* HTML */ `<p class="form-error" role="alert">${escapeHtml(estado.errorFormulario)}</p>` : ''}
    <div class="quantity-row">
      <div>
        <h2>¿Cuántas personas participan?</h2>
        <p>Completá los datos de cada una.</p>
      </div>
      <div class="counter">
        <button
          data-action="less"
          aria-label="Quitar participante"
          ${estado.count === 1 ? 'disabled' : ''}
        >
          ${icono('minus')}</button
        ><span aria-live="polite">${estado.count}</span
        ><button data-action="more" aria-label="Agregar participante">${icono('plus')}</button>
      </div>
    </div>
    <div class="participants-list">
      ${Array.from({ length: estado.count }, (_, index) => {
        const participante = estado.participants[index] ?? {};
        return /* HTML */ `<section
          class="participant-card"
          aria-labelledby="person-title-${index}"
        >
          <div class="person-title">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <h2 id="person-title-${index}">Participante ${index + 1}</h2>
            ${icono('person')}
          </div>
          <div class="fields">
            <label class="field field-name"
              >Nombre y apellido<input
                data-person="${index}"
                data-field="name"
                autocomplete="off"
                placeholder="Por ejemplo, Sofía Martínez"
                value="${escapeHtml(participante.name)}" /></label
            ><label class="field"
              >DNI<input
                data-person="${index}"
                data-field="dni"
                inputmode="numeric"
                autocomplete="off"
                placeholder="Sin puntos"
                value="${escapeHtml(participante.dni)}" /></label
            ><label class="field"
              >Edad<input
                data-person="${index}"
                data-field="age"
                inputmode="numeric"
                autocomplete="off"
                placeholder="En años"
                value="${escapeHtml(participante.age)}" /></label
            >${
              actividad.clothing
                ? /* HTML */ `<label class="field field-size"
                    >Talle de vestimenta<select
                      aria-label="Talle de vestimenta"
                      data-person="${index}"
                      data-field="size"
                    >
                      <option value="">Elegir talle</option>
                      ${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => `<option ${participante.size === size ? 'selected' : ''}>${size}</option>`).join('')}
                    </select></label
                  >`
                : ''
            }
          </div>
        </section>`;
      }).join('')}
    </div>
    <section class="contact-section">
      <div class="contact-heading">
        ${icono('mail')}
        <div>
          <h2>Tu experiencia, también en tu correo.</h2>
          <p>Ingresá el email en el que querés recibir tu confirmación.</p>
        </div>
      </div>
      <label class="field"
        >Email de contacto<input
          type="email"
          data-field="email"
          autocomplete="email"
          placeholder="nombre@ejemplo.com"
          value="${escapeHtml(estado.email)}"
      /></label>
    </section>
    <div class="terms-row">
      <input
        id="accept-terms"
        type="checkbox"
        ${estado.accepted ? 'checked' : ''}
        aria-label="Aceptar términos y condiciones de ${actividad.name}"
      />
      <div>
        <label for="accept-terms">Acepto los términos de esta actividad.</label
        ><button class="text-button" data-action="terms">
          Leer términos de ${actividad.name} ${icono('arrow')}
        </button>
      </div>
    </div>`;
}

function qr() {
  if (estado.qrUrl) {
    return /* HTML */ `<div class="qr" role="img" aria-label="Código QR de tu inscripción">
      <img src="${escapeHtml(estado.qrUrl)}" alt="Código QR para consultar tu inscripción" />
    </div>`;
  }
  let rectangles = '';
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (left, top) => x >= left && x < left + 7 && y >= top && y < top + 7;
      let black;
      if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
        const dx = x - (x >= 14 ? 14 : 0);
        const dy = y - (y >= 14 ? 14 : 0);
        black =
          dx === 0 ||
          dx === 6 ||
          dy === 0 ||
          dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      } else {
        black = (x * 17 + y * 23 + x * y) % 7 < 3;
      }
      if (black) {
        rectangles += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  return /* HTML */ `<div class="qr" role="img" aria-label="Código QR de tu inscripción">
    <svg viewBox="-2 -2 25 25" aria-hidden="true">${rectangles}</svg>
  </div>`;
}

function pase(confirmado = estado.confirmed) {
  const actividad = actividadActual();
  return /* HTML */ `<article class="ticket">
    <div class="ticket-visual ticket-visual-${actividad.id}">
      ${medioActividad(actividad, 'ticket-art', false, MEDIOS_ACTIVIDADES[actividad.id].ticketPosition)}<span
        class="ticket-overline"
        >EcoHarmony Park · ${confirmado ? 'Tu pase' : 'Tu experiencia'}</span
      >${
        confirmado
          ? /* HTML */ `<span class="ticket-stamp" aria-label="Inscripción confirmada"
              >${icono('leaf')}<span>Inscripción<br />confirmada</span></span
            >`
          : ''
      }
    </div>
    <div class="ticket-body">
      <div class="ticket-heading">
        <div>
          <span>Tu encuentro con la naturaleza</span>
          <h2>${actividad.name}</h2>
        </div>
        <span class="duration-pill">${icono('clock')}${textoDuracion()}</span>
      </div>
      ${itinerario()}${
        confirmado
          ? /* HTML */ `<div class="ticket-perforation"></div>
              <div class="qr-row">
                ${qr()}
                <div>
                  <h3>Tu pase para la actividad.</h3>
                  <p>Presentá este QR al llegar a tu actividad.</p>
                </div>
              </div>`
          : ''
      }
    </div>
  </article>`;
}

function etapaConfirmacion() {
  const title = estado.confirmed
    ? '¡Tu próxima aventura está confirmada!'
    : 'Revisá tu inscripción.';
  const subtitle = estado.confirmed
    ? 'Tené tu pase a mano al llegar a la actividad.'
    : 'Comprobá los datos de tu experiencia antes de confirmar.';
  const actions = estado.confirmed
    ? ''
    : botonPrincipal(
        estado.enviando ? 'Confirmando inscripción...' : 'Confirmar inscripción',
        'confirm',
      );
  return /* HTML */ `${encabezado(title, subtitle)}
    ${estado.errorFormulario ? /* HTML */ `<p class="form-error" role="alert">${escapeHtml(estado.errorFormulario)}</p>` : ''}
    <div class="confirmation-layout">
      ${pase()}
      <section class="review-participants">
        <h2>Quienes te acompañan</h2>
        ${estado.participants
          .slice(0, estado.count)
          .map(
            (participante, index) =>
              /* HTML */ `<div class="review-person">
                ${icono('person')}
                <div>
                  <strong
                    >${escapeHtml(textoConAlternativa(participante.name, `Participante ${index + 1}`))}</strong
                  ><small
                    >${participante.age !== undefined && participante.age !== '' ? `${escapeHtml(participante.age)} años` : 'Edad por completar'}${actividadActual().clothing ? ` · Talle ${escapeHtml(textoConAlternativa(participante.size, 'por elegir'))}` : ''}</small
                  >
                </div>
              </div>`,
          )
          .join(
            '',
          )}${estado.confirmed ? '' : /* HTML */ `<button class="text-button" data-action="edit">Editar participantes ${icono('arrow')}</button>`}
      </section>
    </div>
    ${
      estado.confirmed
        ? /* HTML */ `<section class="confirmation-contact">
            ${icono('mail')}
            <div>
              <span>Correo de contacto</span>
              <strong>${escapeHtml(estado.email)}</strong>
              <p>La confirmación de tu inscripción será enviada a esta dirección.</p>
            </div>
          </section>`
        : ''
    }
    <div class="summary-actions">${actions}</div>`;
}

function puedeAnimar(keyboard = false) {
  return !keyboard && !movimientoReducido.matches;
}

async function completarAnimacion(animation, collection) {
  try {
    await animation.finished;
  } catch (error) {
    // Cancelar una animación es normal al navegar o activar movimiento reducido.
    if (error.name !== 'AbortError') {
      console.error('No se pudo completar la animación:', error.message);
    }
  } finally {
    collection.delete(animation);
  }
}

function animarElemento(element, frames, options, collection = animacionesTransicion) {
  if (!element || !element.animate) {
    return null;
  }
  const animation = element.animate(frames, options);
  collection.add(animation);
  void completarAnimacion(animation, collection);
  return animation;
}

function sincronizarMovimiento() {
  const paused = movimientoReducido.matches || campoEnFoco || document.hidden || byId('modal').open;
  document.body.classList.toggle('motion-paused', paused);
  document.body.classList.toggle('motion-reduced', movimientoReducido.matches);
  if (movimientoReducido.matches) {
    for (const animation of animacionesTransicion) {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    }
  }
  mediosParque.sync({
    paused,
    reduced: movimientoReducido.matches,
    home: estado.view === 'home' && !document.body.classList.contains('mail-view'),
    activity:
      estado.view === 'booking' &&
      estado.step === 0 &&
      !document.body.classList.contains('mail-view')
        ? estado.activity
        : null,
  });
}

function renderizar({ navigate = false, keyboard = false, focus = null } = {}) {
  mediosParque.pauseAll();
  actualizarPantalla();
  if (estado.view === 'home') {
    sincronizarActualizacionHorarios();
    sincronizarMovimiento();
    if (navigate) {
      byId('welcome-title').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    return;
  }
  renderizarCabecera();
  renderizarNavegacion();
  byId('stage').innerHTML = [etapaActividad, etapaHorarios, etapaParticipantes, etapaConfirmacion][
    estado.step
  ]();
  actualizarCuposVisibles();
  sincronizarActualizacionHorarios();
  sincronizarMovimiento();
  if (navigate) {
    byId('stage').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (puedeAnimar(keyboard)) {
      animarElemento(
        byId('stage'),
        [
          { opacity: 0.5, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
      );
      if (estado.step === 3) {
        animarElemento(
          document.querySelector('.ticket-stamp'),
          [
            { transform: 'rotate(-18deg) scale(1.18)', opacity: 0 },
            { transform: 'rotate(-9deg) scale(1)', opacity: 1 },
          ],
          { duration: 260, easing: 'ease-out' },
        );
      }
    }
  }
  if (focus) {
    document.querySelector(focus)?.focus({ preventScroll: true });
  }
}

function actualizarHorariosPorReloj() {
  if (estado.view !== 'booking' || estado.step !== 1 || document.hidden) {
    return;
  }
  const activeSlot = document.activeElement?.dataset?.slotKey;
  const expired = limpiarTurnoVencido();
  renderizar({ focus: activeSlot ? `[data-slot-key="${activeSlot}"]` : null });
  if (expired) {
    mostrarAviso('El horario elegido ya no admite inscripción. Elegí otro.');
  }
}

function sincronizarActualizacionHorarios() {
  clearInterval(temporizadorHorarios);
  temporizadorHorarios = null;
  if (estado.view === 'booking' && estado.step === 1) {
    temporizadorHorarios = setInterval(actualizarHorariosPorReloj, 60000);
  }
}

function abrirModal(content, keyboard = false) {
  origenModal = document.activeElement;
  byId('modal-content').innerHTML = content;
  const dialog = byId('modal');
  if (!dialog.open) {
    dialog.showModal();
  }
  if (puedeAnimar(keyboard)) {
    animarElemento(
      dialog,
      [
        { opacity: 0, transform: 'translateY(10px) scale(.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }
}

function mostrarAviso(message) {
  clearTimeout(temporizadorAviso);
  byId('toast').textContent = message;
  byId('toast').classList.add('visible');
  temporizadorAviso = setTimeout(() => byId('toast').classList.remove('visible'), 3000);
}

function origenPermitido(event) {
  return event.origin === location.origin;
}

function ventanaCorreo(keyboard = false) {
  limpiarCorreo?.();
  const snapshot = {
    activity: estado.activity,
    date: estado.date,
    time: estado.time,
    participants: estado.participants
      .slice(0, estado.count)
      .map((participante) => ({ ...participante })),
    email: estado.email,
    qrUrl: estado.qrUrl,
  };
  const opened = window.open(
    `?vista=correo&preview=${Date.now()}`,
    'ecoharmony-correo',
    'width=720,height=900',
  );
  const fallback = () =>
    abrirModal(
      /* HTML */ `<h2 id="modal-title">Tu correo, a un paso.</h2>
        <p>
          No pudimos abrir la confirmación en otra ventana. Podés volver a intentar o ver el correo
          aquí, conservando los datos del recorrido.
        </p>
        <div class="modal-actions">
          ${botonPrincipal('Ver la confirmación aquí', 'mail-inline')}<button
            class="text-button"
            data-action="mail"
          >
            Volver a intentar en otra ventana ${icono('arrow')}
          </button>
        </div>`,
      keyboard,
    );
  if (!opened) {
    fallback();
    return;
  }
  let delivered = false;
  const listener = (event) => {
    if (event.source !== opened || !origenPermitido(event)) {
      return;
    }
    if (event.data === 'eco-mail-ready') {
      opened.postMessage(
        { type: 'eco-preview', snapshot },
        location.origin === 'null' ? '*' : location.origin,
      );
    } else if (event.data === 'eco-mail-rendered') {
      delivered = true;
      cleanup();
      mostrarAviso('Confirmación abierta en otra ventana.');
    }
  };
  const timeout = setTimeout(() => {
    cleanup();
    if (!delivered) {
      try {
        opened.close();
      } catch {
        // La ventana puede haberse cerrado; la alternativa conserva el recorrido.
      }
      fallback();
    }
  }, 5000);
  function cleanup() {
    clearTimeout(timeout);
    window.removeEventListener('message', listener);
    limpiarCorreo = null;
  }
  limpiarCorreo = cleanup;
  window.addEventListener('message', listener);
}

function recibirDatosCorreo(raw) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !ACTIVIDADES.some((actividad) => actividad.id === raw.activity)
  ) {
    return false;
  }
  if (!Array.isArray(raw.participants) || raw.participants.length === 0) {
    return false;
  }
  const participantes = raw.participants.map((participante) => {
    const cleaned = {};
    for (const key of ['name', 'dni', 'age', 'size']) {
      if (participante && typeof participante[key] === 'string') {
        cleaned[key] = participante[key];
      }
    }
    return cleaned;
  });
  estado.activity = raw.activity;
  estado.participants = participantes;
  estado.count = participantes.length;
  estado.email = typeof raw.email === 'string' ? raw.email : '';
  estado.qrUrl = typeof raw.qrUrl === 'string' ? raw.qrUrl : null;
  estado.date =
    typeof raw.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.date) &&
    !Number.isNaN(Date.parse(raw.date))
      ? raw.date
      : null;
  estado.time = typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : null;
  return true;
}

function crearSolicitudInscripcion() {
  const inicioTurno =
    estado.date && estado.time ? fechaTurno(estado.date, estado.time).toISOString() : null;
  return {
    actividad: estado.activity,
    contacto: estado.email,
    inicioTurno,
    participantes: estado.participants.slice(0, estado.count).map((participante) => ({
      nombre: participante.name,
      dni: participante.dni,
      edad: participante.age === '' ? null : Number(participante.age),
      ...(actividadActual().clothing ? { talle: participante.size } : {}),
    })),
    terminos: { actividadId: estado.activity, aceptados: estado.accepted },
  };
}

async function confirmarInscripcion(keyboard) {
  if (estado.enviando) {
    return;
  }
  estado.enviando = true;
  estado.errorFormulario = '';
  renderizar({ keyboard });
  try {
    const respuesta = await fetch('/api/inscripciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crearSolicitudInscripcion()),
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok) {
      estado.errorFormulario = resultado.mensaje ?? 'No pudimos validar la inscripción.';
      if (
        resultado.participante !== undefined ||
        ['contacto', 'terminos'].includes(resultado.campo)
      ) {
        estado.step = 2;
      } else if (resultado.campo === 'inicioTurno') {
        estado.step = 1;
      }
      return;
    }
    estado.qrUrl = resultado.qrUrl;
    estado.confirmed = true;
    mostrarAviso('Tu inscripción fue confirmada.');
  } catch {
    estado.errorFormulario =
      'No pudimos conectar con el servicio de inscripciones. Intentá nuevamente.';
  } finally {
    estado.enviando = false;
    renderizar({ navigate: estado.confirmed, keyboard });
  }
}

function renderizarCorreo() {
  document.title = 'EcoHarmony Park · Confirmación de inscripción';
  document.body.classList.add('mail-view');
  clearInterval(temporizadorHorarios);
  temporizadorHorarios = null;
  mediosParque.pauseAll();
  estado.view = 'booking';
  actualizarPantalla();
  byId('main').hidden = true;
  byId('action-dock').hidden = true;
  let shell = document.querySelector('.mail-shell');
  if (!shell) {
    shell = document.createElement('main');
    shell.className = 'mail-shell';
    shell.id = 'mail-preview';
    shell.tabIndex = -1;
    document.body.insertBefore(shell, document.querySelector('.site-footer'));
  }
  document.querySelector('.skip-link').href = '#mail-preview';
  shell.innerHTML = /* HTML */ `${document.body.classList.contains('mail-inline') ? /* HTML */ `<button class="back-link mail-back" data-action="mail-back">${icono('back')}Volver al resumen</button>` : ''}
    <div class="mail-toolbar">
      ${icono('mail')}Confirmación de inscripción<span>EcoHarmony Park</span>
    </div>
    <div class="mail-meta">
      <h1>Tu próxima aventura te espera.</h1>
      <dl>
        <div>
          <dt>De</dt>
          <dd>EcoHarmony Park</dd>
        </div>
        <div>
          <dt>Para</dt>
          <dd>${escapeHtml(textoConAlternativa(estado.email, 'nombre@ejemplo.com'))}</dd>
        </div>
        <div>
          <dt>Asunto</dt>
          <dd>Tu experiencia en EcoHarmony Park</dd>
        </div>
      </dl>
    </div>
    <div class="mail-content">
      <div class="mail-intro">
        ${icono('leaf')}
        <h2>La naturaleza te espera.</h2>
        <p>Estos son los detalles de tu inscripción.</p>
      </div>
      ${pase(true)}
      <section class="mail-people">
        <h2>Participantes</h2>
        ${estado.participants.map((participante, index) => /* HTML */ `<p>${escapeHtml(textoConAlternativa(participante.name, `Participante ${index + 1}`))}${participante.age !== undefined && participante.age !== '' ? ` · ${escapeHtml(participante.age)} años` : ''}${actividadActual().clothing ? ` · Talle ${escapeHtml(textoConAlternativa(participante.size, 'por elegir'))}` : ''}</p>`).join('')}
      </section>
      <div class="mail-attachment">
        ${icono('mail')}
        <div>
          <strong>Pase para la actividad</strong>
          <p>Presentá el QR al llegar a tu actividad.</p>
        </div>
      </div>
    </div>`;
  sincronizarMovimiento();
}

function atenderBoton(button, keyboard) {
  if (button.dataset.step !== undefined) {
    const siguientePaso = Number(button.dataset.step);
    const mensaje = validarNavegacionFormulario(
      estado,
      estado.step,
      siguientePaso,
      actividadActual().clothing,
    );
    if (mensaje) {
      estado.errorFormulario = mensaje;
      renderizar({ keyboard });
      mostrarAviso(mensaje);
      return;
    }
    estado.errorFormulario = '';
    estado.step = siguientePaso;
    if (estado.step === 1) {
      reiniciarConsultaCupos();
    }
    const expired = estado.step === 1 && limpiarTurnoVencido();
    renderizar({ navigate: true, keyboard });
    if (expired) {
      mostrarAviso('El horario elegido ya no admite inscripción. Elegí otro.');
    }
    return;
  }
  if (button.dataset.activity) {
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
    reiniciarConsultaCupos();
    estado.activity = button.dataset.activity;
    estado.accepted = false;
    renderizar({ keyboard, focus: `[data-activity="${estado.activity}"]` });
    return;
  }
  if (button.dataset.slotDate && button.dataset.slotTime) {
    const fecha = button.dataset.slotDate;
    const hora = button.dataset.slotTime;
    if (!esTurnoDisponible(fecha, hora) || cuposDisponibles(fecha, hora) === 0) {
      estado.date = null;
      estado.time = null;
      renderizar();
      mostrarAviso('El horario elegido ya no está disponible. Elegí otro.');
      return;
    }
    estado.date = fecha;
    estado.time = hora;
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
    renderizar({ keyboard, focus: `[data-slot-key="${claveSeleccion(fecha, hora)}"]` });
    return;
  }
  const action = button.dataset.action;
  if (
    action === 'mail-back' ||
    (action === 'home' && document.body.classList.contains('mail-inline'))
  ) {
    document.body.classList.remove('mail-view', 'mail-inline');
    document.querySelector('.mail-shell')?.remove();
    byId('main').hidden = false;
    byId('action-dock').hidden = false;
    document.querySelector('.skip-link').href = '#stage';
    document.title = 'EcoHarmony Park · Un parque vivo';
    estado.view = action === 'home' ? 'home' : 'booking';
    renderizar({ navigate: true, keyboard });
    return;
  }
  if (action === 'home') {
    if (document.body.classList.contains('mail-view')) {
      location.href = './index.html';
      return;
    }
    estado.view = 'home';
    renderizar({ navigate: true, keyboard });
  } else if (action === 'enter' || action === 'activities') {
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
    estado.view = 'booking';
    estado.step = 0;
    reiniciarConsultaCupos();
    renderizar({ navigate: true, keyboard });
  } else if (action === 'confirm') {
    void confirmarInscripcion(keyboard);
  } else if (action === 'next') {
    const mensaje = validarAvanceFormulario(estado, estado.step, actividadActual().clothing);
    if (mensaje) {
      estado.errorFormulario = mensaje;
      renderizar({ keyboard });
      mostrarAviso(mensaje);
      return;
    }
    estado.errorFormulario = '';
    estado.step = Math.min(3, estado.step + 1);
    if (estado.step === 1) {
      reiniciarConsultaCupos();
    }
    const expired = estado.step === 1 && limpiarTurnoVencido();
    renderizar({ navigate: true, keyboard });
    if (expired) {
      mostrarAviso('El horario elegido ya no admite inscripción. Elegí otro.');
    }
  } else if (action === 'previous') {
    estado.step = Math.max(0, estado.step - 1);
    if (estado.step === 1) {
      reiniciarConsultaCupos();
    }
    const expired = estado.step === 1 && limpiarTurnoVencido();
    renderizar({ navigate: true, keyboard });
    if (expired) {
      mostrarAviso('El horario elegido ya no admite inscripción. Elegí otro.');
    }
  } else if (action === 'edit') {
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
    estado.step = 2;
    renderizar({ navigate: true, keyboard });
  } else if (action === 'more') {
    estado.confirmed = false;
    estado.count++;
    estado.participants.push({});
    renderizar({ keyboard, focus: '[data-action="more"]' });
    if (puedeAnimar(keyboard)) {
      animarElemento(
        document.querySelector('.participant-card:last-child'),
        [
          { opacity: 0.4, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    }
  } else if (action === 'less' && estado.count > 1) {
    estado.confirmed = false;
    estado.count--;
    estado.participants.pop();
    renderizar({
      keyboard,
      focus: estado.count === 1 ? '[data-action="more"]' : '[data-action="less"]',
    });
  } else if (action === 'terms') {
    abrirModal(
      /* HTML */ `<span class="dialog-leaf">${icono('leaf')}</span>
        <h2 id="modal-title">Términos y condiciones de ${actividadActual().name}</h2>
        <p>Leé las condiciones de participación para esta actividad.</p>
        <ul class="terms-list">
          ${actividadActual()
            .terms.map((term) => `<li>${escapeHtml(term)}</li>`)
            .join('')}
        </ul>
        <div class="modal-actions">
          ${botonPrincipal('Aceptar términos y condiciones', 'accept-terms')}
        </div>`,
      keyboard,
    );
  } else if (action === 'accept-terms') {
    estado.accepted = true;
    byId('modal').close();
    renderizar({ keyboard, focus: '[data-action="terms"]' });
    mostrarAviso('Términos y condiciones aceptados');
  } else if (action === 'close-dialog') {
    byId('modal').close();
  } else if (action === 'help') {
    abrirModal(
      /* HTML */ `<span class="dialog-leaf">${icono('leaf')}</span>
        <h2 id="modal-title">Explorá a tu manera.</h2>
        <p>
          Elegí una actividad y un turno disponible para hoy o mañana. Después, completá los datos
          de quienes participan, ingresá tu email y aceptá los términos de la actividad.
        </p>
        <p>
          Revisá el resumen antes de confirmar tu inscripción. Al finalizar, tendrás los detalles y
          el pase con QR para presentar al llegar.
        </p>
        <div class="modal-actions">${botonPrincipal('Seguir explorando', 'close-dialog')}</div>`,
      keyboard,
    );
  } else if (action === 'itinerary') {
    abrirModal(
      /* HTML */ `<h2 id="modal-title">Tu experiencia</h2>
        ${medioActividad(actividadActual(), 'modal-art')}
        <h3>${actividadActual().name}</h3>
        ${itinerario()}`,
      keyboard,
    );
  } else if (action === 'mail') {
    if (byId('modal').open) {
      byId('modal').close();
    }
    ventanaCorreo(keyboard);
  } else if (action === 'mail-inline') {
    byId('modal').close();
    document.body.classList.add('mail-inline');
    renderizarCorreo();
    const title = document.querySelector('.mail-meta h1');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button && !button.disabled) {
    atenderBoton(button, event.detail === 0);
  }
});
document.addEventListener('input', (event) => {
  const element = event.target;
  if (element.dataset.person !== undefined) {
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
    const index = Number(element.dataset.person);
    if (
      !Number.isInteger(index) ||
      !estado.participants[index] ||
      !['name', 'dni', 'age', 'size'].includes(element.dataset.field)
    ) {
      return;
    }
    estado.participants[index][element.dataset.field] = element.value;
  } else if (element.dataset.field === 'email') {
    estado.email = element.value;
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
  } else if (element.id === 'accept-terms') {
    estado.accepted = element.checked;
    estado.confirmed = false;
    estado.qrUrl = null;
    estado.errorFormulario = '';
  }
});
document.addEventListener('focusin', (event) => {
  campoEnFoco = event.target.matches('input, select, textarea');
  sincronizarMovimiento();
});
document.addEventListener('focusout', () =>
  queueMicrotask(() => {
    campoEnFoco = document.activeElement?.matches('input, select, textarea') ?? false;
    sincronizarMovimiento();
  }),
);
document.addEventListener('visibilitychange', () => {
  sincronizarMovimiento();
  if (!document.hidden) {
    actualizarHorariosPorReloj();
  }
});
movimientoReducido.addEventListener('change', sincronizarMovimiento);
byId('modal').addEventListener('close', () => {
  if (origenModal?.isConnected) {
    origenModal.focus({ preventScroll: true });
  }
  origenModal = null;
  sincronizarMovimiento();
});
byId('modal').addEventListener('click', (event) => {
  if (event.target !== byId('modal')) {
    return;
  }
  const rect = byId('modal').getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    byId('modal').close();
  }
});
window.addEventListener('pagehide', () => {
  limpiarCorreo?.();
  clearInterval(temporizadorHorarios);
  mediosParque.pauseAll();
});

if (new URLSearchParams(location.search).get('vista') === 'correo') {
  renderizarCorreo();
  window.addEventListener('message', (event) => {
    if (
      event.source === window.opener &&
      origenPermitido(event) &&
      event.data?.type === 'eco-preview' &&
      recibirDatosCorreo(event.data.snapshot)
    ) {
      renderizarCorreo();
      window.opener.postMessage(
        'eco-mail-rendered',
        location.origin === 'null' ? '*' : location.origin,
      );
    }
  });
  window.opener?.postMessage('eco-mail-ready', location.origin === 'null' ? '*' : location.origin);
} else {
  renderizar();
}
