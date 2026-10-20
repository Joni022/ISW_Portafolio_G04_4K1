const ACTIVIDADES = new Map([
  ['safari', { edadMinima: 0, requiereTalle: false }],
  ['jardineria', { edadMinima: 0, requiereTalle: false }],
  ['palestra', { edadMinima: 12, requiereTalle: true }],
  ['tirolesa', { edadMinima: 8, requiereTalle: true }],
]);
const CARACTERES_INVALIDOS_NOMBRE = /[^\p{L} ]/u;
const EDAD_MINIMA = 0;
const EDAD_MAXIMA = 120;
const DNI_MINIMO = 1000000;
const DNI_MAXIMO = 99999999;
const CARACTERES_NO_NUMERICOS_DNI = /[^0-9]/u;

/** Coordina el caso de uso de inscripción. */
export class ServicioInscripcion {
  /**
   * @param {object} repositorio Almacenamiento de inscripciones.
   * @param {object} emisorCorreo Bandeja de confirmaciones.
   */
  constructor(repositorio, emisorCorreo) {
    this.repositorio = repositorio;
    this.emisorCorreo = emisorCorreo;
  }

  /**
   * @param {object} solicitud Datos de actividad, turno, participantes y contacto.
   * @returns {{idInscripcion: string}} Identificador del registro.
   * @throws {Error} ErrorValidacion con campo y número de participante.
   */
  inscribir(solicitud) {
    this.#validarParticipantes(solicitud);
    this.#validarActividad(solicitud.actividad);
    this.#validarNombres(solicitud.participantes);
    this.#validarEdades(solicitud.participantes);
    this.#validarDocumentos(solicitud.participantes);
    this.#validarEdadActividad(solicitud);
    this.#validarDisponibilidad(solicitud);

    const idInscripcion = this.repositorio.guardarInscripcion(solicitud);
    this.emisorCorreo.enviar(this.#confirmacionDe(solicitud));
    return { idInscripcion };
  }

  /**
   * Comprueba el formato del nombre sin registrar ni enviar confirmaciones.
   * @param {unknown} nombre Dato recibido.
   * @returns {boolean} Indica si es un nombre válido.
   */
  validarNombre(nombre) {
    return typeof nombre === 'string'
      && nombre.trim().length > 0
      && !CARACTERES_INVALIDOS_NOMBRE.test(nombre);
  }

  /**
   * Comprueba el criterio provisional de DNI acordado por el equipo.
   * @param {unknown} dni Texto recibido.
   * @returns {boolean} Indica si el dato es válido.
   */
  validarDni(dni) {
    if (typeof dni !== 'string' || dni.length === 0 || CARACTERES_NO_NUMERICOS_DNI.test(dni)) {
      return false;
    }

    const valor = Number(dni);
    return Number.isInteger(valor) && valor >= DNI_MINIMO && valor <= DNI_MAXIMO;
  }

  /** @param {unknown} edad @returns {boolean} Edad entera admitida por el equipo. */
  validarEdad(edad) {
    return Number.isInteger(edad) && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA;
  }

  #validarActividad(actividad) {
    if (!ACTIVIDADES.has(actividad)) {
      const error = new Error('La actividad no existe');
      error.name = 'ErrorValidacion';
      error.campo = 'actividad';
      throw error;
    }
  }

  #validarParticipantes(solicitud) {
    if (solicitud === null || typeof solicitud !== 'object' || Array.isArray(solicitud)
        || !Array.isArray(solicitud.participantes) || solicitud.participantes.length === 0) {
      const error = new Error('La solicitud debe incluir al menos un participante');
      error.name = 'ErrorValidacion';
      error.campo = 'participantes';
      throw error;
    }
    for (const [indice, participante] of solicitud.participantes.entries()) {
      if (participante === null || typeof participante !== 'object'
          || Array.isArray(participante)) {
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

  #confirmacionDe(solicitud) {
    return {
      destinatario: 'ana@ejemplo.com',
      actividad: solicitud.actividad,
      inicioTurno: solicitud.inicioTurno,
      participantes: solicitud.participantes,
    };
  }
}
