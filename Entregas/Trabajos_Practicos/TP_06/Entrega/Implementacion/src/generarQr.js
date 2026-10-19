import { toBuffer } from 'qrcode';

const LADO_EN_PIXELES = 300;

/**
 * Genera una imagen para adjuntar a una confirmación.
 * @param {string} contenido Texto por codificar.
 * @returns {Promise<Buffer>} Imagen PNG.
 */
export async function generarQr(contenido) {
  return toBuffer(contenido, { type: 'png', width: LADO_EN_PIXELES });
}
