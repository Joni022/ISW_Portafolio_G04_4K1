import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import sharp from 'sharp';
import { crearContenidoCorreo, nombreActividad } from './correoConfirmacion.js';

const REMITENTE_DE_PRUEBA = 'EcoHarmony Park <onboarding@resend.dev>';
// Rutas controladas por el proyecto; nunca se toman rutas del formulario.
const FOTOS_ACTIVIDADES = {
  safari: { archivo: 'safari.jpg', posicion: 'centre' },
  tirolesa: { archivo: 'tirolesa-video.jpg', posicion: 'south' },
  palestra: { archivo: 'palestra.jpg', posicion: 'south' },
  jardineria: { archivo: 'jardineria.jpg', posicion: 'centre' },
};

/** Señala que el proveedor no aceptó la confirmación de correo. */
export class ErrorEnvioCorreo extends Error {
  constructor(causa) {
    super('No se pudo enviar la confirmación por correo.', { cause: causa });
    this.name = 'ErrorEnvioCorreo';
  }
}

/** Envía confirmaciones mediante la API de Resend. */
export class EmisorCorreoResend {
  /**
   * @param {object} [opciones] Dependencias y configuración del proveedor.
   * @param {string} [opciones.apiKey] Clave obtenida desde el entorno.
   * @param {string} [opciones.desde] Remitente visible para la persona inscripta.
   * @param {{emails: {send: function(object): Promise<{data: object|null, error: object|null}>}}} [opciones.cliente] Cliente reemplazable para pruebas.
   */
  constructor({
    apiKey = process.env.RESEND_API_KEY,
    desde = process.env.RESEND_FROM ?? REMITENTE_DE_PRUEBA,
    cliente,
  } = {}) {
    if (cliente !== undefined) {
      this.cliente = cliente;
    } else {
      if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('Configurá RESEND_API_KEY para enviar confirmaciones reales.');
      }
      this.cliente = new Resend(apiKey);
    }
    this.desde = desde;
  }

  /**
   * Envía la confirmación y adjunta el pase QR en resolución completa.
   * @param {object} mensaje Confirmación creada por el servicio de inscripción.
   * @returns {Promise<string>} Identificador devuelto por Resend.
   * @throws {ErrorEnvioCorreo} Si el proveedor no acepta o no puede procesar el mensaje.
   */
  async enviar(mensaje) {
    let respuesta;
    try {
      const foto = await prepararFotografia(mensaje.actividad);
      const contenido = crearContenidoCorreo(mensaje);
      const adjuntoQr = mensaje.adjuntos.find((adjunto) => adjunto.tipo === 'image/png');
      if (adjuntoQr === undefined) {
        throw new Error('La confirmación requiere el pase QR.');
      }
      const qr = Buffer.from(adjuntoQr.contenido);
      // El hash del pase evita colisiones al reiniciar el repositorio en memoria.
      const claveEnvio = createHash('sha256').update(qr).digest('hex');
      respuesta = await this.cliente.emails.send(
        {
          from: this.desde,
          to: [mensaje.destinatario],
          subject: `Confirmación de inscripción · ${nombreActividad(mensaje.actividad)}`,
          ...contenido,
          attachments: [
            {
              filename: `actividad-${mensaje.actividad}.jpg`,
              content: foto,
              contentId: 'actividad-foto',
            },
            { filename: 'pase-qr-inline.png', content: qr, contentId: 'pase-qr' },
            { filename: adjuntoQr.nombre, content: qr },
          ],
        },
        { idempotencyKey: `inscripcion/${claveEnvio}` },
      );
    } catch (causa) {
      throw new ErrorEnvioCorreo(causa);
    }

    if (respuesta.error || !respuesta.data?.id) {
      throw new ErrorEnvioCorreo(respuesta.error);
    }
    return respuesta.data.id;
  }
}

async function prepararFotografia(actividad) {
  if (!Object.hasOwn(FOTOS_ACTIVIDADES, actividad)) {
    throw new Error('La actividad del correo no existe.');
  }
  const foto = FOTOS_ACTIVIDADES[actividad];
  const archivo = new URL(`../prototipo/assets/photos/${foto.archivo}`, import.meta.url);
  const original = await readFile(archivo);
  return sharp(original)
    .resize(1200, 675, { fit: 'cover', position: foto.posicion })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
