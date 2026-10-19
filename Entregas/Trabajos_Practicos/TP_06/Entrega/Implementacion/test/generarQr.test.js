import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { generarQr } from '../src/generarQr.js';

describe('Código QR', () => {
  it('debe generar un PNG válido cuando hay contenido para el adjunto', async () => {
    // Preparación.
    const contenido = 'INSCRIPCION-1';

    // Ejecución.
    const imagen = await generarQr(contenido);

    // Comprobación: firma PNG y lectura real de sus píxeles.
    expect(imagen.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const png = PNG.sync.read(imagen);
    expect(png.width).toBeGreaterThan(0);
    expect(png.height).toBeGreaterThan(0);
  });
});
