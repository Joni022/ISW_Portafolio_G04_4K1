import { createServer } from 'node:http';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearApiInscripciones } from '../src/apiInscripciones.js';
import { EmisorCorreoSimulado } from '../src/emisorCorreoSimulado.js';

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

  it('debe conservar los cupos y conflictos cuando el prototipo usa inscripciones precargadas', async () => {
    const emisorCorreo = new EmisorCorreoSimulado();
    api = crearApiInscripciones({
      reloj: { ahora: () => new Date('2026-10-14T10:00:00-03:00') },
      urlPublica: () => baseUrl,
      precargarInscripciones: true,
      emisorCorreo,
    });

    const primera = await fetch(`${baseUrl}/api/turnos?actividad=safari&fecha=2026-10-14`);
    const cupos = await primera.json();
    expect(cupos.turnos).toContainEqual({ hora: '11:00', cuposDisponibles: 0 });
    expect(cupos.turnos).toContainEqual({ hora: '12:00', cuposDisponibles: 8 });
    expect(cupos.turnos).toContainEqual({ hora: '13:00', cuposDisponibles: 6 });
    expect(cupos.turnos).toContainEqual({ hora: '14:00', cuposDisponibles: 1 });
    expect(emisorCorreo.mensajes()).toHaveLength(0);

    const repetida = solicitudValida();
    repetida.actividad = 'jardineria';
    repetida.terminos.actividadId = 'jardineria';
    repetida.participantes[0].dni = '90000001';
    const rechazo = await fetch(`${baseUrl}/api/inscripciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repetida),
    });
    expect(rechazo.status).toBe(422);
    expect((await rechazo.json()).mensaje).toContain('ya tiene una inscripción en ese horario');

    const aceptada = await fetch(`${baseUrl}/api/inscripciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitudValida()),
    });
    expect(aceptada.status).toBe(201);
    const segunda = await fetch(`${baseUrl}/api/turnos?actividad=safari&fecha=2026-10-14`);
    expect((await segunda.json()).turnos).toContainEqual({ hora: '14:00', cuposDisponibles: 0 });
    expect(emisorCorreo.mensajes()).toHaveLength(1);
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
