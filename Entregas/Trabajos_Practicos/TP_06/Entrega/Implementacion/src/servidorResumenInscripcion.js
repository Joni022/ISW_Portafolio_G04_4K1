import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { CONFIGURACION_PARQUE } from '../prototipo/configuracionParque.js';

const PRESENTACION_ACTIVIDADES = {
  safari: {
    nombre: 'Safari',
    foto: 'safari.jpg',
    posicion: '50% 45%',
    frase: 'Un encuentro con lo extraordinario.',
  },
  tirolesa: {
    nombre: 'Tirolesa',
    foto: 'tirolesa-video.jpg',
    posicion: '50% 60%',
    frase: 'Entre los árboles, la aventura toma vuelo.',
  },
  palestra: {
    nombre: 'Palestra',
    foto: 'palestra.jpg',
    posicion: '50% 72%',
    frase: 'Una nueva perspectiva te espera.',
  },
  jardineria: {
    nombre: 'Jardinería',
    foto: 'jardineria.jpg',
    posicion: '50% 45%',
    frase: 'Las grandes cosas empiezan pequeñas.',
  },
};

const RUTA_RESUMEN =
  /^\/inscripciones\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/u;
const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'long',
  year: 'numeric',
});

/**
 * Crea el servidor que muestra un resumen de una inscripción al escanear su QR.
 * @param {{obtenerInscripcionPorCodigoResumen: function(string): object|null}} repositorio Fuente de inscripciones.
 * @returns {import('node:http').Server} Servidor HTTP sin escuchar un puerto todavía.
 */
export function crearServidorResumenInscripcion(repositorio) {
  if (
    repositorio === null ||
    typeof repositorio?.obtenerInscripcionPorCodigoResumen !== 'function'
  ) {
    throw new TypeError('El servidor de resumen requiere un repositorio de inscripciones.');
  }

  return createServer(async (solicitud, respuesta) => {
    if (atenderResumenInscripcion(solicitud, respuesta, repositorio)) {
      return;
    }
    if (!(await atenderRecursoResumen(solicitud, respuesta))) {
      responderNoEncontrado(respuesta);
    }
  });
}

// El servidor independiente solo entrega los recursos visuales explícitos de esta vista.
async function atenderRecursoResumen(solicitud, respuesta) {
  const pathname = new URL(solicitud.url, 'http://localhost').pathname;
  const recursos = new Map([
    ['/resumen.css', 'text/css; charset=utf-8'],
    ['/assets/lato-regular.ttf', 'font/ttf'],
    ['/assets/lato-bold.ttf', 'font/ttf'],
    ['/assets/photos/portada.jpg', 'image/jpeg'],
    ...Object.values(PRESENTACION_ACTIVIDADES).map((actividad) => [
      `/assets/photos/${actividad.foto}`,
      'image/jpeg',
    ]),
  ]);
  if (solicitud.method !== 'GET' || !recursos.has(pathname)) {
    return false;
  }
  try {
    const contenido = await readFile(new URL(`../prototipo${pathname}`, import.meta.url));
    respuesta.writeHead(200, {
      'Content-Type': recursos.get(pathname),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    respuesta.end(contenido);
  } catch {
    responderNoEncontrado(respuesta);
  }
  return true;
}

/**
 * Atiende la ruta pública de un resumen cuando está presente en la solicitud.
 * @param {import('node:http').IncomingMessage} solicitud Solicitud HTTP recibida.
 * @param {import('node:http').ServerResponse} respuesta Respuesta HTTP a completar.
 * @param {{obtenerInscripcionPorCodigoResumen: function(string): object|null}} repositorio Fuente de inscripciones.
 * @returns {boolean} Indica si la solicitud correspondía a la ruta de resumen.
 */
export function atenderResumenInscripcion(solicitud, respuesta, repositorio) {
  const url = new URL(solicitud.url, `http://${solicitud.headers.host ?? 'localhost'}`);
  const coincidencia = RUTA_RESUMEN.exec(url.pathname);
  if (coincidencia === null) {
    return false;
  }
  if (solicitud.method !== 'GET') {
    responderNoEncontrado(respuesta);
    return true;
  }

  const inscripcion = repositorio.obtenerInscripcionPorCodigoResumen(coincidencia[1]);
  if (inscripcion === null) {
    responderNoEncontrado(respuesta);
    return true;
  }

  respuesta.writeHead(200, encabezadosHtml());
  respuesta.end(crearResumenHtml(inscripcion));
  return true;
}

function responderNoEncontrado(respuesta) {
  respuesta.writeHead(404, encabezadosHtml());
  respuesta.end(
    documentoHtml(
      'Inscripción no encontrada',
      `<main class="unavailable"><span class="park-symbol">${icono('leaf')}</span><h1>Inscripción no encontrada</h1><p>No encontramos el pase asociado a este enlace. Revisá el enlace del correo de confirmación.</p></main>`,
    ),
  );
}

function encabezadosHtml() {
  return {
    'Content-Security-Policy':
      "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function crearResumenHtml(inscripcion) {
  const actividad = Object.hasOwn(PRESENTACION_ACTIVIDADES, inscripcion.actividad)
    ? PRESENTACION_ACTIVIDADES[inscripcion.actividad]
    : {
        nombre: 'Actividad',
        foto: 'portada.jpg',
        posicion: '50% 50%',
        frase: 'Viví la naturaleza de cerca.',
      };
  const cantidad = inscripcion.participantes.length;
  const textoCantidad = `${cantidad} ${cantidad === 1 ? 'persona' : 'personas'}`;
  const inicio = new Date(inscripcion.inicioTurno);
  const fin = new Date(inicio.getTime() + CONFIGURACION_PARQUE.duracionMinutos * 60000);
  const hora = (instante) =>
    new Intl.DateTimeFormat('es-AR', {
      timeZone: CONFIGURACION_PARQUE.zonaHoraria,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(instante);
  const participantes = inscripcion.participantes
    .map(
      (participante) =>
        `<li><span class="person-symbol" aria-hidden="true">${icono('person')}</span><span>${escaparHtml(participante.nombre)}</span></li>`,
    )
    .join('');
  return documentoHtml(
    'Tu inscripción',
    `
    <main class="summary-page">
      <header class="page-heading">
        <h1>Resumen de tu inscripción</h1>
        <p>Tu próxima aventura, en un solo lugar.</p>
      </header>
      <article class="park-pass" aria-labelledby="activity-title">
        <div class="pass-photo">
          <img src="/assets/photos/${actividad.foto}" alt="${escaparHtml(actividad.nombre)}" style="object-position:${actividad.posicion}" width="1280" height="720" fetchpriority="high">
        </div>
        <div class="pass-content">
          <div class="activity-heading">
            <div><p class="activity-intro">Tu experiencia en el parque</p><h2 id="activity-title">${actividad.nombre}</h2></div>
            <span class="duration">${icono('clock')}${CONFIGURACION_PARQUE.duracionMinutos} min</span>
          </div>
          <p class="activity-story">${actividad.frase}</p>
          <dl class="pass-details">
            <div class="pass-date"><dt>${icono('calendar')}Fecha</dt><dd>${escaparHtml(FORMATO_FECHA.format(inicio))}</dd></div>
            <div><dt>${icono('clock')}Horario</dt><dd>${hora(inicio)}–${hora(fin)}</dd><dd class="detail-note">Hora del parque · Argentina</dd></div>
            <div><dt>${icono('people')}Participantes</dt><dd>${textoCantidad}</dd></div>
          </dl>
        </div>
        <section class="pass-people" aria-labelledby="people-title">
          <div class="people-heading"><h3 id="people-title">Quienes te acompañan</h3><span>${textoCantidad}</span></div>
          <ul>${participantes}</ul>
        </section>
        <footer class="pass-footer">${icono('leaf')}<p>Nos vemos en el parque.<span>Tené a mano el pase de tu correo al llegar a la actividad.</span></p></footer>
      </article>
      <p class="page-footer">EcoHarmony Park · Viví la naturaleza de cerca.</p>
    </main>`,
  );
}

function documentoHtml(titulo, contenido) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escaparHtml(titulo)} | EcoHarmony Park</title>
    <link rel="stylesheet" href="/resumen.css">
  </head>
  <body>
    <header class="site-header"><div class="site-brand"><span class="park-symbol">${icono('leaf')}</span>EcoHarmony Park</div></header>
    ${contenido}
  </body>
</html>`;
}

function icono(nombre) {
  const trazos = {
    leaf: '<path d="M20 3C9 2 3 7 4 14c1 6 8 7 12 3 4-4 4-10 4-14Z"/><path d="M3 22 16 8"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16"/>',
    person: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
    people:
      '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a3 3 0 0 1 0 6m3 4a6 6 0 0 1 3 5v2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos[nombre]}</svg>`;
}

function escaparHtml(valor) {
  return String(valor).replace(
    /[&<>'"]/gu,
    (caracter) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[caracter],
  );
}
