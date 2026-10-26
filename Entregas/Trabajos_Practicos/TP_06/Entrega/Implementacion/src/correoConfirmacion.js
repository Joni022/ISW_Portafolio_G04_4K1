import { CONFIGURACION_PARQUE } from '../prototipo/configuracionParque.js';

/**
 * Arma el pase de correo con imágenes CID y una alternativa de texto.
 * @param {object} mensaje Datos de la inscripción confirmada.
 * @returns {{html: string, text: string}} Contenido del correo.
 */
export function crearContenidoCorreo(mensaje) {
  const actividad = nombreActividad(mensaje.actividad);
  const fecha = formatearTurno(mensaje.inicioTurno, { dateStyle: 'long' });
  const hora = formatearTurno(mensaje.inicioTurno, { timeStyle: 'short', hourCycle: 'h23' });
  const requiereTalle = CONFIGURACION_PARQUE.actividades[mensaje.actividad].requiereTalle;
  const personas = mensaje.participantes.map(
    (persona) =>
      `${persona.nombre} · ${persona.edad} años${requiereTalle ? ` · Talle ${persona.talle}` : ''}`,
  );
  const cantidad = `${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}`;
  const text = [
    '¡Tu próxima aventura está confirmada!',
    `Actividad: ${actividad}`,
    `Fecha: ${fecha}`,
    `Horario: ${hora} (hora del parque, Argentina)`,
    `Participantes: ${cantidad}`,
    ...personas.map((persona) => `- ${persona}`),
    'Adjuntamos tu pase QR en tamaño completo. Presentalo al llegar a la actividad.',
    'Nos vemos en el parque. EcoHarmony Park.',
  ].join('\n');

  // Tablas de presentación y estilos inline para lectores de correo como Gmail y Outlook.
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tu pase · EcoHarmony Park</title></head>
<body style="margin:0;padding:0;background-color:#f2e8cf;color:#386641;font-family:Lato,Arial,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Tu inscripción a ${escaparHtml(actividad)} está confirmada. Encontrá los detalles y tu pase QR en este correo.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2e8cf" style="width:100%;background-color:#f2e8cf">
    <tr><td align="center" style="padding:24px 12px">
      <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff9e9" style="width:100%;max-width:600px;background-color:#fff9e9;border:1px solid #a7c957;border-radius:12px;border-spacing:0">
        <tr><td bgcolor="#386641" style="padding:24px;color:#f2e8cf;background-color:#386641;border-radius:11px 11px 0 0">
          <p style="margin:0;font-size:23px;font-weight:700;letter-spacing:-.5px">EcoHarmony Park</p>
          <p style="margin:8px 0 0;font-size:12px;letter-spacing:1.6px;text-transform:uppercase">Tu encuentro con la naturaleza</p>
        </td></tr>
        <tr><td style="padding:0"><img src="cid:actividad-foto" alt="${escaparHtml(actividad)} · EcoHarmony Park" width="600" height="338" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
        <tr><td style="padding:28px 24px 24px">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6a994e">Inscripción confirmada</p>
          <h1 style="margin:0 0 16px;font-size:30px;line-height:1.18;font-weight:700;letter-spacing:-.8px">¡Tu próxima aventura está confirmada!</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6">Te esperamos para vivir ${escaparHtml(actividad)}. Estos son los detalles de tu experiencia.</p>
          <h2 style="margin:0 0 16px;font-size:27px;line-height:1.2">${escaparHtml(actividad)}</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:15px;line-height:1.5">
            ${filaDetalle('Fecha', fecha)}
            ${filaDetalle('Horario', `${hora} · Hora del parque, Argentina`)}
            ${filaDetalle('Participantes', cantidad)}
          </table>
          <h2 style="margin:28px 0 12px;font-size:20px;line-height:1.3">Quienes te acompañan</h2>
          <ul style="margin:0;padding:0 0 0 20px;font-size:15px;line-height:1.7;overflow-wrap:anywhere">${personas.map((persona) => `<li style="padding:4px 0">${escaparHtml(persona)}</li>`).join('')}</ul>
        </td></tr>
        <tr><td align="center" bgcolor="#f2e8cf" style="padding:24px 16px 28px;background-color:#f2e8cf;border-top:1px dashed #6a994e">
          <h2 style="margin:0 0 8px;font-size:23px;line-height:1.3">Tu pase para la actividad</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Presentá este QR al llegar a tu actividad.</p>
          <img src="cid:pase-qr" alt="Pase QR de tu inscripción a ${escaparHtml(actividad)}. También se incluye como archivo PNG adjunto." width="568" style="display:block;width:100%;max-width:568px;height:auto;border:0;margin:0 auto">
          <p style="margin:16px 0 0;font-size:13px;line-height:1.6">También adjuntamos tu pase en tamaño completo para que puedas guardarlo.</p>
        </td></tr>
        <tr><td align="center" style="padding:26px 24px;border-radius:0 0 11px 11px">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700">Nos vemos en el parque.</p>
          <p style="margin:0;font-size:13px;line-height:1.6">EcoHarmony Park · Viví la naturaleza de cerca.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return { html, text };
}

/** @param {string} actividad Identificador de actividad. @returns {string} Nombre visible. */
export function nombreActividad(actividad) {
  return { safari: 'Safari', tirolesa: 'Tirolesa', palestra: 'Palestra', jardineria: 'Jardinería' }[
    actividad
  ];
}

function filaDetalle(etiqueta, valor) {
  return `<tr><td style="padding:12px 0;border-top:1px solid #a7c957"><span style="font-size:12px;color:#6a994e">${etiqueta}</span><br><strong>${escaparHtml(valor)}</strong></td></tr>`;
}

function formatearTurno(inicio, opciones) {
  return new Intl.DateTimeFormat('es-AR', {
    ...opciones,
    timeZone: CONFIGURACION_PARQUE.zonaHoraria,
  }).format(new Date(inicio));
}

function escaparHtml(valor) {
  return String(valor).replace(
    /[&<>"']/gu,
    (caracter) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[caracter],
  );
}
