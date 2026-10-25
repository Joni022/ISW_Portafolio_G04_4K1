import { generarQr } from './generarQr.js';
import { relojSistema } from './relojSistema.js';
import { CONFIGURACION_PARQUE } from '../prototipo/configuracionParque.js';

const MINUTOS_CIERRE_INSCRIPCION = CONFIGURACION_PARQUE.minutosCierreInscripcion;
const HORAS_APERTURA_INSCRIPCION = CONFIGURACION_PARQUE.horasAperturaInscripcion;
const MILISEGUNDOS_POR_MINUTO = 60000;
const MINUTOS_POR_HORA = 60;
const HORA_PRIMER_TURNO = CONFIGURACION_PARQUE.horaPrimerTurno;
const HORA_ULTIMO_TURNO = CONFIGURACION_PARQUE.horaUltimoTurno;
// Zona técnica adoptada para esta entrega; no depende de la zona del dispositivo.
const ZONA_PARQUE = CONFIGURACION_PARQUE.zonaHoraria;
const FECHA_PARQUE = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_PARQUE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const ACTIVIDADES = new Map(Object.entries(CONFIGURACION_PARQUE.actividades));
const CARACTERES_INVALIDOS_NOMBRE = /[^\p{L} ]/u;
const TALLES_ADMITIDOS = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
const EDAD_MINIMA = 0;
const EDAD_MAXIMA = 120;
const DNI_MINIMO = 1000000;
const DNI_MAXIMO = 99999999;
const CARACTERES_NO_NUMERICOS_DNI = /[^0-9]/u;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** Coordina el caso de uso de inscripción. */
export class ServicioInscripcion {
  /**
   * @param {object} repositorio Almacenamiento de inscripciones.
   * @param {object} emisorCorreo Bandeja de confirmaciones.
   * @param {object} [opciones] Reloj y generador de QR reemplazables.
   * @param {{ahora: function(): Date}} [opciones.reloj] Fuente del instante actual.
   * @param {function(string): Promise<Buffer>} [opciones.generadorQr] Codificador PNG.
   * @param {function(string): string} opciones.urlResumen Enlace público del resumen por código QR.
   */
  constructor(
    repositorio,
    emisorCorreo,
    { reloj = relojSistema, generadorQr = generarQr, urlResumen } = {},
  ) {
    this.repositorio = repositorio;
    this.emisorCorreo = emisorCorreo;
    this.reloj = reloj;
    this.generadorQr = generadorQr;
    if (typeof urlResumen !== 'function') {
      throw new TypeError('El servicio de inscripción requiere una URL de resumen.');
    }
    this.urlResumen = urlResumen;
  }

  /**
   * @param {object} solicitud Datos de actividad, turno, participantes y contacto.
   * @returns {Promise<{idInscripcion: string}>} Identificador del registro.
   * @throws {Error} ErrorValidacion con campo y número de participante.
   */
  async inscribir(solicitud) {
    this.#validarParticipantes(solicitud);
    this.#validarContactoSolicitud(solicitud.contacto);
    this.#validarActividad(solicitud.actividad);
    this.#validarTurno(solicitud);
    this.#validarCalendario(solicitud.inicioTurno);
    this.#validarVentana(solicitud.inicioTurno);
    this.#validarTerminos(solicitud);
    this.#validarNombres(solicitud.participantes);
    this.#validarEdades(solicitud.participantes);
    this.#validarDocumentos(solicitud.participantes);
    this.#validarDniRepetidos(solicitud.participantes);
    this.#validarEdadActividad(solicitud);
    this.#validarVestimenta(solicitud);
    this.#validarDisponibilidad(solicitud);
    this.#validarCupos(solicitud);

    // Validar y registrar sin await evita intercalar solicitudes en este proceso.
    const idInscripcion = this.repositorio.guardarInscripcion(solicitud);
    const inscripcion = this.repositorio.obtenerInscripcion(idInscripcion);
    const codigoResumen = this.repositorio.obtenerCodigoResumen(idInscripcion);
    const imagenQr = await this.generadorQr(this.urlResumen(codigoResumen));
    const confirmacion = this.#confirmacionDe(inscripcion);
    confirmacion.adjuntos = [
      {
        nombre: `inscripcion-${idInscripcion}.png`,
        tipo: 'image/png',
        contenido: imagenQr,
      },
    ];
    this.emisorCorreo.enviar(confirmacion);
    return { idInscripcion };
  }

  /**
   * Comprueba el formato del nombre sin registrar ni enviar confirmaciones.
   * @param {unknown} nombre Dato recibido.
   * @returns {boolean} Indica si es un nombre válido.
   */
  validarNombre(nombre) {
    return (
      typeof nombre === 'string' &&
      nombre.trim().length > 0 &&
      !CARACTERES_INVALIDOS_NOMBRE.test(nombre)
    );
  }

  /**
   * Comprueba el criterio provisional de DNI acordado por el equipo.
   * @param {unknown} dni Texto recibido.
   * @returns {boolean} Indica si el dato es válido.
   */
  validarDni(dni) {
    if (
      typeof dni !== 'string' ||
      dni.length === 0 ||
      dni.startsWith('0') ||
      CARACTERES_NO_NUMERICOS_DNI.test(dni)
    ) {
      return false;
    }

    const valor = Number(dni);
    return Number.isInteger(valor) && valor >= DNI_MINIMO && valor <= DNI_MAXIMO;
  }

  /**
   * Comprueba el contrato numérico de la edad sin convertir el dato recibido.
   * @param {unknown} edad Dato recibido.
   * @returns {boolean} Indica si cumple el rango entero configurado para la entrada.
   */
  validarEdad(edad) {
    return Number.isInteger(edad) && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA;
  }

  /**
   * Comprueba el formato básico del correo, sin verificar si la dirección existe.
   * @param {unknown} contacto Correo recibido, sin normalización implícita.
   * @returns {boolean} Indica si el formato del contacto es válido.
   */
  validarContacto(contacto) {
    return (
      typeof contacto === 'string' && contacto === contacto.trim() && FORMATO_CORREO.test(contacto)
    );
  }

  #validarContactoSolicitud(contacto) {
    if (!this.validarContacto(contacto)) {
      const error = new Error('Ingresá un correo electrónico válido');
      error.name = 'ErrorValidacion';
      error.campo = 'contacto';
      throw error;
    }
  }

  #validarActividad(actividad) {
    if (!ACTIVIDADES.has(actividad)) {
      const error = new Error('La actividad no existe');
      error.name = 'ErrorValidacion';
      error.campo = 'actividad';
      throw error;
    }
  }

  #validarTurno(solicitud) {
    const turno = this.repositorio.obtenerTurno(solicitud.actividad, solicitud.inicioTurno);
    if (turno === null || turno.habilitado !== true) {
      const error = new Error('El turno no existe o no está habilitado');
      error.name = 'ErrorValidacion';
      error.campo = 'inicioTurno';
      throw error;
    }
  }

  #validarCalendario(inicioTurno) {
    const fecha = Object.fromEntries(
      FECHA_PARQUE.formatToParts(new Date(inicioTurno)).map((parte) => [parte.type, parte.value]),
    );
    if (
      Number(fecha.hour) < HORA_PRIMER_TURNO ||
      Number(fecha.hour) > HORA_ULTIMO_TURNO ||
      fecha.minute !== '00' ||
      fecha.second !== '00'
    ) {
      const error = new Error('El turno debe iniciar en una hora entera entre las 09 y las 17');
      error.name = 'ErrorValidacion';
      error.campo = 'inicioTurno';
      throw error;
    }
    const esFeriado =
      (fecha.month === '12' && fecha.day === '25') || (fecha.month === '01' && fecha.day === '01');
    if (fecha.weekday === 'Mon' || esFeriado) {
      const error = new Error('El parque está cerrado en la fecha del turno');
      error.name = 'ErrorValidacion';
      error.campo = 'inicioTurno';
      throw error;
    }
  }

  #validarVentana(inicioTurno) {
    const distancia = Date.parse(inicioTurno) - this.reloj.ahora().getTime();
    const cierre = MINUTOS_CIERRE_INSCRIPCION * MILISEGUNDOS_POR_MINUTO;
    const apertura = HORAS_APERTURA_INSCRIPCION * MINUTOS_POR_HORA * MILISEGUNDOS_POR_MINUTO;
    if (!Number.isFinite(distancia) || distancia < cierre || distancia > apertura) {
      const error = new Error('La inscripción está fuera de la ventana de 24 horas a 15 minutos');
      error.name = 'ErrorValidacion';
      error.campo = 'inicioTurno';
      throw error;
    }
  }

  #validarTerminos(solicitud) {
    if (
      solicitud.terminos?.aceptados !== true ||
      solicitud.terminos.actividadId !== solicitud.actividad
    ) {
      const error = new Error('Debés aceptar los términos de la actividad');
      error.name = 'ErrorValidacion';
      error.campo = 'terminos';
      throw error;
    }
  }

  #validarParticipantes(solicitud) {
    if (
      solicitud === null ||
      typeof solicitud !== 'object' ||
      Array.isArray(solicitud) ||
      !Array.isArray(solicitud.participantes) ||
      solicitud.participantes.length === 0
    ) {
      const error = new Error('La solicitud debe incluir al menos un participante');
      error.name = 'ErrorValidacion';
      error.campo = 'participantes';
      throw error;
    }
    for (const [indice, participante] of solicitud.participantes.entries()) {
      if (
        participante === null ||
        typeof participante !== 'object' ||
        Array.isArray(participante)
      ) {
        const error = new Error(`Los datos del participante ${indice + 1} no son válidos`);
        error.name = 'ErrorValidacion';
        error.campo = 'participantes';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarNombres(participantes) {
    for (const [indice, participante] of participantes.entries()) {
      if (!this.validarNombre(participante.nombre)) {
        const error = new Error(`El nombre del participante ${indice + 1} no es válido`);
        error.name = 'ErrorValidacion';
        error.campo = 'nombre';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarEdades(participantes) {
    for (const [indice, participante] of participantes.entries()) {
      if (!this.validarEdad(participante.edad)) {
        const error = new Error(`La edad del participante ${indice + 1} no es válida`);
        error.name = 'ErrorValidacion';
        error.campo = 'edad';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarDocumentos(participantes) {
    for (const [indice, participante] of participantes.entries()) {
      if (!this.validarDni(participante.dni)) {
        const error = new Error(`El DNI del participante ${indice + 1} no es válido`);
        error.name = 'ErrorValidacion';
        error.campo = 'dni';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarDniRepetidos(participantes) {
    const documentos = new Set();
    for (const [indice, participante] of participantes.entries()) {
      if (documentos.has(participante.dni)) {
        const error = new Error(`El participante ${indice + 1} tiene un DNI repetido en el grupo`);
        error.name = 'ErrorValidacion';
        error.campo = 'dni';
        error.participante = indice + 1;
        throw error;
      }
      documentos.add(participante.dni);
    }
  }

  #validarEdadActividad(solicitud) {
    const { edadMinima } = ACTIVIDADES.get(solicitud.actividad);
    for (const [indice, participante] of solicitud.participantes.entries()) {
      if (participante.edad < edadMinima) {
        const error = new Error(`La edad mínima para ${solicitud.actividad} es ${edadMinima}`);
        error.name = 'ErrorValidacion';
        error.campo = 'edad';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarVestimenta(solicitud) {
    if (!ACTIVIDADES.get(solicitud.actividad).requiereTalle) {
      return;
    }
    for (const [indice, participante] of solicitud.participantes.entries()) {
      if (!TALLES_ADMITIDOS.has(participante.talle)) {
        const error = new Error(`Indicá un talle válido para el participante ${indice + 1}`);
        error.name = 'ErrorValidacion';
        error.campo = 'talle';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarDisponibilidad(solicitud) {
    for (const [indice, participante] of solicitud.participantes.entries()) {
      const tieneConflicto = this.repositorio.existeInscripcionEnHorario(
        participante.dni,
        solicitud.inicioTurno,
      );
      if (tieneConflicto) {
        const error = new Error(
          `El participante ${indice + 1} ya tiene una inscripción en ese horario`,
        );
        error.name = 'ErrorValidacion';
        error.campo = 'inicioTurno';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarCupos(solicitud) {
    const disponibles = this.repositorio.cuposDisponibles(
      solicitud.actividad,
      solicitud.inicioTurno,
    );
    if (solicitud.participantes.length > disponibles) {
      const error = new Error('No hay cupos suficientes para el grupo completo');
      error.name = 'ErrorValidacion';
      error.campo = 'participantes';
      throw error;
    }
  }

  #confirmacionDe(solicitud) {
    return {
      destinatario: solicitud.contacto,
      actividad: solicitud.actividad,
      inicioTurno: solicitud.inicioTurno,
      participantes: solicitud.participantes,
    };
  }
}
