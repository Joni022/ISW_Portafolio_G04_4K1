import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { EmisorCorreoResend } from '../src/emisorCorreoResend.js';

describe('Emisor de correo Resend', () => {
  it('debe enviar la confirmación con el QR completo cuando Resend acepta el mensaje', async () => {
    let solicitudEnviada;
    let opcionesEnvio;
    const cliente = {
      emails: {
        send: async (solicitud, opciones) => {
          solicitudEnviada = solicitud;
          opcionesEnvio = opciones;
          return { data: { id: 'correo-123' }, error: null };
        },
      },
    };
    const emisor = new EmisorCorreoResend({ cliente });
    const qr = Buffer.from([137, 80, 78, 71]);

    const identificador = await emisor.enviar({
      idInscripcion: '42',
      destinatario: 'ecoharmonypark0@gmail.com',
      actividad: 'safari',
      inicioTurno: '2026-10-29T14:00:00-03:00',
      participantes: [{ nombre: 'Ana <Gómez>', edad: 30 }],
      adjuntos: [{ nombre: 'pase-42.png', tipo: 'image/png', contenido: qr }],
    });

    expect(identificador).toBe('correo-123');
    expect(solicitudEnviada).toMatchObject({
      from: 'EcoHarmony Park <onboarding@resend.dev>',
      to: ['ecoharmonypark0@gmail.com'],
      subject: 'Confirmación de inscripción · Safari',
    });
    expect(opcionesEnvio.idempotencyKey).toMatch(/^inscripcion\/[a-f0-9]{64}$/u);
    expect(solicitudEnviada.attachments).toHaveLength(3);
    expect(solicitudEnviada.attachments[0]).toMatchObject({
      filename: 'actividad-safari.jpg',
      contentId: 'actividad-foto',
    });
    expect(await sharp(solicitudEnviada.attachments[0].content).metadata()).toMatchObject({
      format: 'jpeg',
      width: 1200,
      height: 675,
    });
    expect(solicitudEnviada.attachments[1]).toEqual({
      filename: 'pase-qr-inline.png',
      content: qr,
      contentId: 'pase-qr',
    });
    expect(solicitudEnviada.attachments[2]).toEqual({ filename: 'pase-42.png', content: qr });
    expect(solicitudEnviada.html).toContain('src="cid:actividad-foto"');
    expect(solicitudEnviada.html).toContain('src="cid:pase-qr"');
    expect(solicitudEnviada.html).toContain('29 de octubre de 2026');
    expect(solicitudEnviada.html).toContain('14:00');
    expect(solicitudEnviada.html).toContain('Ana &lt;Gómez&gt;');
    expect(solicitudEnviada.text).toContain('Adjuntamos tu pase QR en tamaño completo.');
  });

  it('debe informar el error cuando Resend rechaza el mensaje', async () => {
    const emisor = new EmisorCorreoResend({
      cliente: {
        emails: {
          send: async () => ({ data: null, error: { message: 'El remitente no está permitido' } }),
        },
      },
    });

    await expect(
      emisor.enviar({
        idInscripcion: '42',
        destinatario: 'ecoharmonypark0@gmail.com',
        actividad: 'safari',
        inicioTurno: '2026-10-29T14:00:00-03:00',
        participantes: [{ nombre: 'Ana Gómez', edad: 30 }],
        adjuntos: [{ nombre: 'pase.png', tipo: 'image/png', contenido: Buffer.from('qr') }],
      }),
    ).rejects.toMatchObject({
      name: 'ErrorEnvioCorreo',
      message: 'No se pudo enviar la confirmación por correo.',
      cause: { message: 'El remitente no está permitido' },
    });
  });

  it('debe incluir talles y la fotografía de Tirolesa cuando se confirma esa actividad', async () => {
    let correo;
    const emisor = new EmisorCorreoResend({
      cliente: {
        emails: {
          send: async (datos) => {
            correo = datos;
            return { data: { id: 'correo-tirolesa' }, error: null };
          },
        },
      },
    });

    await emisor.enviar({
      idInscripcion: '43',
      destinatario: 'ecoharmonypark0@gmail.com',
      actividad: 'tirolesa',
      inicioTurno: '2026-10-29T14:00:00-03:00',
      participantes: [
        { nombre: 'Juan Pérez', edad: 20, talle: 'L' },
        { nombre: 'Ana Gómez', edad: 30, talle: 'M' },
      ],
      adjuntos: [{ nombre: 'pase.png', tipo: 'image/png', contenido: Buffer.from('qr') }],
    });

    expect(correo.attachments[0].filename).toBe('actividad-tirolesa.jpg');
    expect(correo.html).toContain('2 personas');
    expect(correo.html).toContain('Juan Pérez · 20 años · Talle L');
    expect(correo.text).toContain('Ana Gómez · 30 años · Talle M');
    expect(correo.html).not.toContain('http://127.0.0.1');
  });
});
