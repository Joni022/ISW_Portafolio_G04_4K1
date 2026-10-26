import { generarQr } from './generarQr.js';
import { EmisorCorreoSimulado } from './emisorCorreoSimulado.js';
import { relojSistema } from './relojSistema.js';
import { precargarInscripcionesTurno } from './precargaInscripciones.js';
import { RepositorioParqueEnMemoria } from './repositorioParqueEnMemoria.js';
import { atenderResumenInscripcion } from './servidorResumenInscripcion.js';
import { ServicioInscripcion } from './servicioInscripcion.js';
import { CONFIGURACION_PARQUE } from '../prototipo/configuracionParque.js';

const LIMITE_CUERPO_BYTES = 32 * 1024;
const RUTA_QR =
  /^\/inscripciones\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/qr\.png$/u;
const MINUTOS_POR_HORA = 60;

/**
 * Crea el adaptador HTTP de la inscripción y de sus recursos públicos.
 * @param {object} [opciones] Dependencias reemplazables para servidor y pruebas.
 * @param {RepositorioParqueEnMemoria} [opciones.repositorio] Almacenamiento de la sesión.
 * @param {EmisorCorreoSimulado} [opciones.emisorCorreo] Emisor de confirmaciones.
 * @param {{ahora: function(): Date}} [opciones.reloj] Fuente del instante actual.
 * @param {boolean} [opciones.precargarInscripciones] Carga inicial ficticia para la presentación.
 * @param {string|function(): string} opciones.urlPublica Base pública para enlaces QR.
 * @returns {{atender: function(import('node:http').IncomingMessage, import('node:http').ServerResponse): Promise<boolean>}}
 */
export function crearApiInscripciones({
  repositorio = new RepositorioParqueEnMemoria(),
  emisorCorreo = new EmisorCorreoSimulado(),
  reloj = relojSistema,
  precargarInscripciones = false,
  urlPublica,
} = {}) {
  if (typeof urlPublica !== 'string' && typeof urlPublica !== 'function') {
    throw new TypeError('La API de inscripciones requiere una URL pública.');
  }
  const obtenerUrlResumen = (codigoResumen) =>
    `${obtenerUrlPublica(urlPublica)}/inscripciones/${codigoResumen}`;
  const servicio = new ServicioInscripcion(repositorio, emisorCorreo, {
    reloj,
    urlResumen: obtenerUrlResumen,
  });

  return {
    async atender(solicitud, respuesta) {
      const url = new URL(solicitud.url, `http://${solicitud.headers.host ?? 'localhost'}`);
      if (await atenderQr(solicitud, respuesta, repositorio, obtenerUrlResumen, url.pathname)) {
        return true;
      }
      if (atenderResumenInscripcion(solicitud, respuesta, repositorio)) {
        return true;
      }
      if (url.pathname === '/api/turnos') {
        if (solicitud.method !== 'GET') {
          respuesta.writeHead(405, { Allow: 'GET' }).end();
          return true;
        }
        const actividad = url.searchParams.get('actividad');
        const fecha = url.searchParams.get('fecha');
        if (
          !Object.hasOwn(CONFIGURACION_PARQUE.actividades, actividad) ||
          !/^\d{4}-\d{2}-\d{2}$/u.test(fecha ?? '')
        ) {
          responderJson(respuesta, 400, { mensaje: 'La consulta de turnos no es válida.' });
          return true;
        }
        registrarTurnosVigentes(repositorio, reloj.ahora(), precargarInscripciones);
        responderJson(respuesta, 200, {
          turnos: obtenerTurnosDisponibles(repositorio, actividad, fecha),
        });
        return true;
      }
      if (url.pathname !== '/api/inscripciones') {
        return false;
      }
      if (solicitud.method !== 'POST') {
        respuesta.writeHead(405, { Allow: 'POST' }).end();
        return true;
      }

      let datos;
      try {
        datos = await leerJson(solicitud);
      } catch (error) {
        responderJson(respuesta, 400, { mensaje: error.message });
        return true;
      }

      registrarTurnosVigentes(repositorio, reloj.ahora(), precargarInscripciones);
      try {
        const resultado = await servicio.inscribir(datos);
        const codigoResumen = repositorio.obtenerCodigoResumen(resultado.idInscripcion);
        const resumenUrl = obtenerUrlResumen(codigoResumen);
        responderJson(respuesta, 201, {
          idInscripcion: resultado.idInscripcion,
          qrUrl: `${resumenUrl}/qr.png`,
          correoEnviado: resultado.correoEnviado,
          resumenUrl,
        });
      } catch (error) {
        if (error.name === 'ErrorValidacion') {
          responderJson(respuesta, 422, {
            campo: error.campo,
            mensaje: error.message,
            ...(error.participante === undefined ? {} : { participante: error.participante }),
          });
          return true;
        }
        responderJson(respuesta, 500, { mensaje: 'No se pudo procesar la inscripción.' });
      }
      return true;
    },
  };
}

async function atenderQr(solicitud, respuesta, repositorio, obtenerUrlResumen, pathname) {
  const coincidencia = RUTA_QR.exec(pathname);
  if (coincidencia === null) {
    return false;
  }
  if (solicitud.method !== 'GET') {
    respuesta.writeHead(404).end();
    return true;
  }
  const inscripcion = repositorio.obtenerInscripcionPorCodigoResumen(coincidencia[1]);
  if (inscripcion === null) {
    respuesta.writeHead(404).end();
    return true;
  }
  const imagen = await generarQr(obtenerUrlResumen(coincidencia[1]));
  respuesta.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'image/png',
    'X-Content-Type-Options': 'nosniff',
  });
  respuesta.end(imagen);
  return true;
}

async function leerJson(solicitud) {
  const partes = [];
  let bytesRecibidos = 0;
  for await (const parte of solicitud) {
    bytesRecibidos += parte.length;
    if (bytesRecibidos > LIMITE_CUERPO_BYTES) {
      throw new Error('La solicitud supera el tamaño permitido.');
    }
    partes.push(parte);
  }
  if (bytesRecibidos === 0) {
    throw new Error('La solicitud debe contener datos JSON.');
  }
  try {
    const datos = JSON.parse(Buffer.concat(partes).toString('utf8'));
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error('La solicitud debe ser un objeto JSON.');
    }
    return datos;
  } catch (error) {
    if (error.message === 'La solicitud debe ser un objeto JSON.') {
      throw error;
    }
    throw new Error('La solicitud debe contener JSON válido.', { cause: error });
  }
}

function responderJson(respuesta, estado, contenido) {
  respuesta.writeHead(estado, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  respuesta.end(JSON.stringify(contenido));
}

function obtenerUrlPublica(urlPublica) {
  const valor = typeof urlPublica === 'function' ? urlPublica() : urlPublica;
  return valor.replace(/\/$/u, '');
}

function registrarTurnosVigentes(repositorio, ahora, precargarInscripciones) {
  const fechas = [fechaEnParque(ahora), fechaSiguienteEnParque(ahora)];
  for (const fecha of fechas) {
    if (parqueCerrado(fecha)) {
      continue;
    }
    for (
      let hora = CONFIGURACION_PARQUE.horaPrimerTurno;
      hora <= CONFIGURACION_PARQUE.horaUltimoTurno;
      hora += 1
    ) {
      const inicioTurno = `${fecha}T${String(hora).padStart(2, '0')}:00:00-03:00`;
      if (!estaEnVentana(inicioTurno, ahora)) {
        continue;
      }
      for (const [actividad, configuracion] of Object.entries(CONFIGURACION_PARQUE.actividades)) {
        if (repositorio.obtenerTurno(actividad, inicioTurno) === null) {
          const turno = {
            actividad,
            capacidad: configuracion.capacidad,
            habilitado: true,
            inicioTurno,
          };
          repositorio.agregarTurno(turno);
          if (precargarInscripciones) {
            precargarInscripcionesTurno(repositorio, turno, hora);
          }
        }
      }
    }
  }
}

function fechaEnParque(instante) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIGURACION_PARQUE.zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(instante)
    .reduce((resultado, parte) => ({ ...resultado, [parte.type]: parte.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function fechaSiguienteEnParque(instante) {
  const [anio, mes, dia] = fechaEnParque(instante).split('-').map(Number);
  return fechaEnParque(new Date(Date.UTC(anio, mes - 1, dia + 1, 15)));
}

function parqueCerrado(fecha) {
  const mediodia = new Date(`${fecha}T12:00:00-03:00`);
  return (
    mediodia.getUTCDay() === 1 ||
    (mediodia.getUTCMonth() === 11 && mediodia.getUTCDate() === 25) ||
    (mediodia.getUTCMonth() === 0 && mediodia.getUTCDate() === 1)
  );
}

function estaEnVentana(inicioTurno, ahora) {
  const minutos = (Date.parse(inicioTurno) - ahora.getTime()) / 60000;
  return (
    minutos >= CONFIGURACION_PARQUE.minutosCierreInscripcion &&
    minutos <= CONFIGURACION_PARQUE.horasAperturaInscripcion * MINUTOS_POR_HORA
  );
}

function obtenerTurnosDisponibles(repositorio, actividad, fecha) {
  const turnos = [];
  for (
    let hora = CONFIGURACION_PARQUE.horaPrimerTurno;
    hora <= CONFIGURACION_PARQUE.horaUltimoTurno;
    hora += 1
  ) {
    const horaTexto = `${String(hora).padStart(2, '0')}:00`;
    const inicioTurno = `${fecha}T${horaTexto}:00-03:00`;
    const turno = repositorio.obtenerTurno(actividad, inicioTurno);
    if (turno?.habilitado === true) {
      turnos.push({
        hora: horaTexto,
        cuposDisponibles: repositorio.cuposDisponibles(actividad, inicioTurno),
      });
    }
  }
  return turnos;
}
