import { toBuffer } from 'qrcode';

const LADO_EN_PIXELES = 300;

/**
 * Genera una imagen para adjuntar a una confirmación.
 * @param {string} contenido Texto por codificar.
 * @returns {Promise<Buffer>} Imagen PNG.
 * @throws {Error} Contenido inválido o error de codificación.
 */
export async function generarQr(contenido) {
  if (typeof contenido !== 'string' || contenido.trim().length === 0) {
    throw new Error('El contenido del QR no puede estar vacío.');
  }
  return toBuffer(contenido, { type: 'png', width: LADO_EN_PIXELES });
}
