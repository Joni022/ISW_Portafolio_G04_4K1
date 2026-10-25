import { createServer } from 'node:http';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearApiInscripciones } from '../src/apiInscripciones.js';

describe('API de inscripciones', () => {
  let api;
  let servidor;
  let baseUrl;

  beforeEach(async () => {
    api = crearApiInscripciones({
      reloj: { ahora: () => new Date('2026-10-14T10:00:00-03:00') },
      urlPublica: () => baseUrl,
    });
    servidor = createServer(async (solicitud, respuesta) => {
      if (await api.atender(solicitud, respuesta)) {
        return;
      }
      respuesta.writeHead(404).end();
    });
    await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    baseUrl = `http://127.0.0.1:${servidor.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolver, rechazar) =>
      servidor.close((error) => (error ? rechazar(error) : resolver())),
    );
  });

  it('debe registrar la inscripción y devolver el resumen y QR cuando la solicitud es válida', async () => {
    const respuesta = await fetch(`${baseUrl}/api/inscripciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitudValida()),
    });
    const resultado = await respuesta.json();

    expect(respuesta.status).toBe(201);
    expect(resultado.idInscripcion).toBe('1');
    expect(resultado.resumenUrl).toMatch(
      new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/inscripciones/`),
    );
    expect(resultado.qrUrl).toBe(`${resultado.resumenUrl}/qr.png`);

    const imagen = await fetch(resultado.qrUrl);
    expect(imagen.status).toBe(200);
    expect(imagen.headers.get('content-type')).toBe('image/png');
    const png = PNG.sync.read(Buffer.from(await imagen.arrayBuffer()));
    const lectura = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(lectura.data).toBe(resultado.resumenUrl);
  });

  it('debe informar el nombre cuando la inscripción contiene un participante sin nombre', async () => {
    const solicitud = solicitudValida();
    solicitud.participantes[0].nombre = '';

    const respuesta = await fetch(`${baseUrl}/api/inscripciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitud),
    });
    const resultado = await respuesta.json();

    expect(respuesta.status).toBe(422);
    expect(resultado).toEqual({
      campo: 'nombre',
      mensaje: 'El nombre del participante 1 no es válido',
      participante: 1,
    });
  });

  it('debe informar el cupo restante de un turno luego de registrar una inscripción', async () => {
    await fetch(`${baseUrl}/api/inscripciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitudValida()),
    });

    const respuesta = await fetch(`${baseUrl}/api/turnos?actividad=safari&fecha=2026-10-14`);
    const resultado = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(resultado.turnos).toContainEqual({ hora: '14:00', cuposDisponibles: 7 });
  });
});

function solicitudValida() {
  return {
    actividad: 'safari',
    contacto: 'ana@ejemplo.com',
    inicioTurno: '2026-10-14T14:00:00-03:00',
    participantes: [{ nombre: 'Ana Gómez', dni: '30111222', edad: 30 }],
    terminos: { actividadId: 'safari', aceptados: true },
  };
}
