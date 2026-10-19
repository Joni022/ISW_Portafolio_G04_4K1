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

  /** @param {object} solicitud @returns {{idInscripcion: string}} Resultado. */
  inscribir(solicitud) {
    const idInscripcion = this.repositorio.guardarInscripcion(solicitud);
    return { idInscripcion };
  }
}
