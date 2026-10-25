import { createServer } from 'node:http';

const RUTA_RESUMEN =
  /^\/inscripciones\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/u;
const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
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

  return createServer((solicitud, respuesta) => {
    if (!atenderResumenInscripcion(solicitud, respuesta, repositorio)) {
      responderNoEncontrado(respuesta);
    }
  });
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
    '<!doctype html><title>Inscripción no encontrada</title><h1>Inscripción no encontrada</h1>',
  );
}

function encabezadosHtml() {
  return {
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

function crearResumenHtml(inscripcion) {
  const participantes = inscripcion.participantes
    .map((participante) => `<li>${escaparHtml(participante.nombre)}</li>`)
    .join('');
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tu inscripción | EcoHarmony Park</title>
    <style>
      body { background: #f2e8cf; color: #386641; font-family: Lato, Arial, sans-serif; margin: 0; }
      main { margin: 0 auto; max-width: 40rem; padding: 2rem 1.25rem; }
      article { background: #f2e8cf; border: .125rem solid #6a994e; border-radius: 1rem; padding: 1.5rem; }
      h1 { margin-top: 0; } dt { font-weight: 700; margin-top: 1rem; } dd { margin: .25rem 0; }
    </style>
  </head>
  <body>
    <main>
      <article>
        <p>EcoHarmony Park</p>
        <h1>Resumen de tu inscripción</h1>
        <dl>
          <dt>Actividad</dt><dd>${escaparHtml(inscripcion.actividad)}</dd>
          <dt>Fecha y horario</dt><dd>${escaparHtml(FORMATO_FECHA.format(new Date(inscripcion.inicioTurno)))}</dd>
          <dt>Participantes</dt><dd>${inscripcion.participantes.length}</dd>
        </dl>
        <ul>${participantes}</ul>
      </article>
    </main>
  </body>
</html>`;
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
