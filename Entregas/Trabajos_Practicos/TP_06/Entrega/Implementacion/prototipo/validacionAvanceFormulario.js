/**
 * Comprueba que la etapa actual tenga los datos obligatorios para avanzar.
 * Las reglas de formato y negocio se validan definitivamente en el servidor.
 * @param {object} estado Datos ingresados durante el recorrido.
 * @param {number} paso Etapa desde la que se quiere avanzar.
 * @param {boolean} requiereTalle Indica si la actividad solicita talle.
 * @returns {string|null} Mensaje de bloqueo o ausencia de datos obligatorios pendientes.
 */
export function validarAvanceFormulario(estado, paso, requiereTalle) {
  if (paso === 1 && (!tieneContenido(estado.date) || !tieneContenido(estado.time))) {
    return 'Elegí un horario para continuar.';
  }
  if (paso !== 2) {
    return null;
  }

  const participantes = estado.participants?.slice(0, estado.count) ?? [];
  const faltanDatosParticipante =
    participantes.length === 0 ||
    participantes.some(
      (participante) =>
        !tieneContenido(participante?.name) ||
        !tieneContenido(participante?.dni) ||
        !tieneContenido(participante?.age) ||
        (requiereTalle && !tieneContenido(participante?.size)),
    );
  if (faltanDatosParticipante) {
    return 'Completá los datos obligatorios de cada participante.';
  }
  if (!tieneContenido(estado.email)) {
    return 'Ingresá un email de contacto para continuar.';
  }
  if (estado.accepted !== true) {
    return 'Aceptá los términos y condiciones para continuar.';
  }
  return null;
}

function tieneContenido(valor) {
  return typeof valor === 'string' ? valor.trim().length > 0 : Number.isFinite(valor);
}
