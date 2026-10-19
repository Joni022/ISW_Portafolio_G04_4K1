/** Coordina el caso de uso de inscripción. */
export class ServicioInscripcion {
  /** @param {object} repositorio Almacenamiento de inscripciones. */
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  /** @param {object} solicitud @returns {{idInscripcion: string}} Resultado. */
  inscribir(solicitud) {
    const idInscripcion = this.repositorio.guardarInscripcion(solicitud);
    return { idInscripcion };
  }
}
