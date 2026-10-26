/**
 * Quita un participante sin modificar la colección recibida.
 * @param {object[]} participantes Participantes actuales de la inscripción.
 * @param {number} indice Posición del participante que se desea quitar.
 * @returns {object[]} Participantes restantes, en su orden original.
 */
export function eliminarParticipante(participantes, indice) {
  if (!Array.isArray(participantes) || !Number.isInteger(indice)) {
    return participantes;
  }
  return participantes.filter((_, indiceActual) => indiceActual !== indice);
}
