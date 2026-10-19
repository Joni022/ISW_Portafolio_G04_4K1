import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
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

  it('debe recuperar el contenido original cuando se decodifica el QR generado', async () => {
    // Preparación.
    const contenido = 'INSCRIPCION-1';

    // Ejecución: codificar y leer con una biblioteca independiente.
    const imagen = await generarQr(contenido);
    const png = PNG.sync.read(imagen);
    const pixeles = new Uint8ClampedArray(png.data);
    const decodificado = jsQR(pixeles, png.width, png.height);

    // Comprobación.
    expect(decodificado?.data).toBe('INSCRIPCION-1');
  });

  it('debe rechazar el contenido cuando está vacío, en blanco o ausente', async () => {
    // Ejecución y comprobación: se conserva el contrato del generador Java.
    await expect(generarQr('')).rejects.toThrow(Error);
    await expect(generarQr(' ')).rejects.toThrow(Error);
    await expect(generarQr(null)).rejects.toThrow(Error);
  });
});
