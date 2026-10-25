import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { EmisorCorreoSimulado } from '../src/emisorCorreoSimulado.js';
import { RepositorioParqueEnMemoria } from '../src/repositorioParqueEnMemoria.js';
import { crearServidorResumenInscripcion } from '../src/servidorResumenInscripcion.js';
import { ServicioInscripcion } from '../src/servicioInscripcion.js';

describe('Resumen de inscripción por QR', () => {
  let repositorio;
  let servidor;
  let baseUrl;

  beforeEach(async () => {
    repositorio = new RepositorioParqueEnMemoria();
    servidor = crearServidorResumenInscripcion(repositorio);
    await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
    const { port } = servidor.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise((resolver, rechazar) =>
      servidor.close((error) => (error ? rechazar(error) : resolver())),
    );
  });

  it('debe mostrar actividad, turno y participantes cuando el QR identifica una inscripción existente', async () => {
    const idInscripcion = repositorio.guardarInscripcion({
      actividad: 'safari',
      inicioTurno: '2026-10-14T14:00:00-03:00',
      participantes: [
        { nombre: 'Ana Gómez', dni: '30111222', edad: 30 },
        { nombre: 'Juan Pérez', dni: '28444555', edad: 34 },
      ],
      contacto: 'ana@ejemplo.com',
    });

    const codigoResumen = repositorio.obtenerCodigoResumen(idInscripcion);
    const respuesta = await fetch(`${baseUrl}/inscripciones/${codigoResumen}`);
    const pagina = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(pagina).toContain('Resumen de tu inscripción');
    expect(pagina).toContain('safari');
    expect(pagina).toContain('Ana Gómez');
    expect(pagina).toContain('Juan Pérez');
    expect(pagina).toContain('14:00');
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
  });

  it('debe abrir el resumen cuando se escanea el QR de una inscripción registrada', async () => {
    repositorio.agregarTurno({
      actividad: 'safari',
      inicioTurno: '2026-10-14T14:00:00-03:00',
      capacidad: 8,
      habilitado: true,
    });
    const emisorCorreo = new EmisorCorreoSimulado();
    const servicio = new ServicioInscripcion(repositorio, emisorCorreo, {
      reloj: { ahora: () => new Date('2026-10-14T10:00:00-03:00') },
      urlResumen: (codigo) => `${baseUrl}/inscripciones/${codigo}`,
    });

    await servicio.inscribir({
      actividad: 'safari',
      terminos: { actividadId: 'safari', aceptados: true },
      inicioTurno: '2026-10-14T14:00:00-03:00',
      participantes: [{ nombre: 'Ana Gómez', dni: '30111222', edad: 30 }],
      contacto: 'ana@ejemplo.com',
    });
    const adjunto = emisorCorreo.mensajes()[0].adjuntos[0].contenido;
    const png = PNG.sync.read(Buffer.from(adjunto));
    const lectura = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

    const respuesta = await fetch(lectura.data);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toContain('Ana Gómez');
  });

  it('debe responder sin ejecutar HTML almacenado cuando un nombre contiene caracteres especiales', async () => {
    const idInscripcion = repositorio.guardarInscripcion({
      actividad: 'safari',
      inicioTurno: '2026-10-14T14:00:00-03:00',
      participantes: [{ nombre: '<img src=x onerror=alert(1)>', dni: '30111222', edad: 30 }],
      contacto: 'ana@ejemplo.com',
    });

    const codigoResumen = repositorio.obtenerCodigoResumen(idInscripcion);
    const respuesta = await fetch(`${baseUrl}/inscripciones/${codigoResumen}`);
    const pagina = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(pagina).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(pagina).not.toContain('<img src=x onerror=alert(1)>');
    expect(respuesta.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('debe informar que no existe la inscripción cuando el identificador es desconocido', async () => {
    const respuesta = await fetch(`${baseUrl}/inscripciones/00000000-0000-0000-0000-000000000000`);

    expect(respuesta.status).toBe(404);
    expect(await respuesta.text()).toContain('Inscripción no encontrada');
  });
});
