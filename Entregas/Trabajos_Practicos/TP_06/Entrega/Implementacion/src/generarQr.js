import QRCode from 'qrcode';
import { PNG } from 'pngjs';

const ANCHO_IMAGEN = 760;
const ALTO_IMAGEN = 550;
const VERDE_OSCURO = [56, 102, 65, 255];
const CREMA = [242, 232, 207, 255];
const MARGEN_SILENCIOSO = 4;

/**
 * Genera un QR escaneable integrado a la silueta de un elefante.
 * @param {string} contenido Texto por codificar.
 * @returns {Promise<Buffer>} Imagen PNG del elefante con el QR integrado.
 * @throws {Error} Contenido inválido o demasiado extenso.
 */
export async function generarQr(contenido) {
  if (typeof contenido !== 'string' || contenido.trim().length === 0) {
    throw new Error('El contenido del QR no puede estar vacío.');
  }

  const codigo = QRCode.create(contenido, { errorCorrectionLevel: 'H' });
  const modulo = Math.floor(270 / (codigo.modules.size + MARGEN_SILENCIOSO * 2));
  if (modulo < 4) {
    throw new Error('El contenido del QR es demasiado extenso para el pase de inscripción.');
  }

  const imagen = new PNG({ width: ANCHO_IMAGEN, height: ALTO_IMAGEN });
  rellenar(imagen, CREMA);
  dibujarElefante(imagen, modulo);
  dibujarCodigo(imagen, codigo, modulo);
  return PNG.sync.write(imagen);
}

function rellenar(imagen, color) {
  for (let y = 0; y < imagen.height; y += 1) {
    for (let x = 0; x < imagen.width; x += 1) {
      pintar(imagen, x, y, color);
    }
  }
}

function dibujarElefante(imagen, modulo) {
  elipse(imagen, 322, 290, 235, 137, VERDE_OSCURO);
  elipse(imagen, 528, 265, 101, 113, VERDE_OSCURO);
  rectangulo(imagen, 124, 349, 184, 462, VERDE_OSCURO);
  rectangulo(imagen, 216, 364, 278, 470, VERDE_OSCURO);
  rectangulo(imagen, 347, 369, 411, 471, VERDE_OSCURO);
  rectangulo(imagen, 443, 354, 505, 469, VERDE_OSCURO);
  trazo(imagen, 603, 276, 642, 225, 30, VERDE_OSCURO);
  trazo(imagen, 642, 225, 644, 133, 30, VERDE_OSCURO);
  trazo(imagen, 123, 283, 84, 353, 10, VERDE_OSCURO);

  for (let y = 128; y < 474; y += modulo) {
    for (let x = 84; x < 660; x += modulo) {
      if (esPielElefante(x + modulo / 2, y + modulo / 2) && patron(x / modulo, y / modulo)) {
        rectangulo(imagen, x, y, x + modulo - 1, y + modulo - 1, CREMA);
      }
    }
  }

  elipse(imagen, 494, 246, 50, 72, CREMA);
  elipse(imagen, 505, 250, 33, 52, VERDE_OSCURO);
  elipse(imagen, 506, 250, 25, 43, CREMA);
  circulo(imagen, 558, 208, 10, CREMA);
  circulo(imagen, 559, 208, 4, VERDE_OSCURO);
  trazo(imagen, 569, 283, 591, 269, 5, CREMA);
  trazo(imagen, 600, 300, 620, 288, 4, CREMA);
  trazo(imagen, 619, 281, 634, 265, 4, CREMA);
  trazo(imagen, 635, 258, 640, 240, 4, CREMA);
  dibujarDedos(imagen, 141, 457);
  dibujarDedos(imagen, 235, 465);
  dibujarDedos(imagen, 376, 466);
  dibujarDedos(imagen, 473, 464);
}

function dibujarCodigo(imagen, codigo, modulo) {
  const lado = codigo.modules.size * modulo;
  const origenX = 180;
  const origenY = 130;
  const margen = MARGEN_SILENCIOSO * modulo;
  rectangulo(
    imagen,
    origenX - margen,
    origenY - margen,
    origenX + lado + margen - 1,
    origenY + lado + margen - 1,
    CREMA,
  );
  for (let fila = 0; fila < codigo.modules.size; fila += 1) {
    for (let columna = 0; columna < codigo.modules.size; columna += 1) {
      if (codigo.modules.get(fila, columna)) {
        const x = origenX + columna * modulo;
        const y = origenY + fila * modulo;
        rectangulo(imagen, x, y, x + modulo - 1, y + modulo - 1, VERDE_OSCURO);
      }
    }
  }
}

function esPielElefante(x, y) {
  const cuerpo = ((x - 322) / 235) ** 2 + ((y - 290) / 137) ** 2 <= 1;
  const cabeza = ((x - 528) / 101) ** 2 + ((y - 265) / 113) ** 2 <= 1;
  const patas =
    (x >= 124 && x <= 184 && y >= 349 && y <= 462) ||
    (x >= 216 && x <= 278 && y >= 364 && y <= 470) ||
    (x >= 347 && x <= 411 && y >= 369 && y <= 471) ||
    (x >= 443 && x <= 505 && y >= 354 && y <= 469);
  return cuerpo || cabeza || patas;
}

function patron(x, y) {
  return Math.abs((Math.floor(x) * 73 + Math.floor(y) * 151 + Math.floor(x * y) * 17) % 101) < 52;
}

function dibujarDedos(imagen, x, y) {
  for (const desplazamiento of [-15, 0, 15]) {
    trazo(imagen, x + desplazamiento, y, x + desplazamiento, y + 14, 4, CREMA);
  }
}

function rectangulo(imagen, izquierda, arriba, derecha, abajo, color) {
  for (let y = Math.max(0, arriba); y <= Math.min(imagen.height - 1, abajo); y += 1) {
    for (let x = Math.max(0, izquierda); x <= Math.min(imagen.width - 1, derecha); x += 1) {
      pintar(imagen, x, y, color);
    }
  }
}

function elipse(imagen, centroX, centroY, radioX, radioY, color) {
  for (let y = centroY - radioY; y <= centroY + radioY; y += 1) {
    for (let x = centroX - radioX; x <= centroX + radioX; x += 1) {
      if (((x - centroX) / radioX) ** 2 + ((y - centroY) / radioY) ** 2 <= 1) {
        pintar(imagen, x, y, color);
      }
    }
  }
}

function circulo(imagen, centroX, centroY, radio, color) {
  elipse(imagen, centroX, centroY, radio, radio, color);
}

function trazo(imagen, inicioX, inicioY, finX, finY, grosor, color) {
  const pasos = Math.max(Math.abs(finX - inicioX), Math.abs(finY - inicioY));
  for (let paso = 0; paso <= pasos; paso += 1) {
    const x = Math.round(inicioX + ((finX - inicioX) * paso) / pasos);
    const y = Math.round(inicioY + ((finY - inicioY) * paso) / pasos);
    circulo(imagen, x, y, grosor / 2, color);
  }
}

function pintar(imagen, x, y, color) {
  if (x < 0 || y < 0 || x >= imagen.width || y >= imagen.height) {
    return;
  }
  const indice = (imagen.width * y + x) * 4;
  imagen.data[indice] = color[0];
  imagen.data[indice + 1] = color[1];
  imagen.data[indice + 2] = color[2];
  imagen.data[indice + 3] = color[3];
}
