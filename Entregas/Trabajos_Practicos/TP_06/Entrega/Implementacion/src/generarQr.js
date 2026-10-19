import { toBuffer } from 'qrcode';

/**
 * Genera una imagen para adjuntar a una confirmación.
 * @param {string} contenido Texto por codificar.
 * @returns {Promise<Buffer>} Imagen PNG.
 */
export async function generarQr(contenido) {
  return toBuffer(contenido, { type: 'png', width: 300 });
}
