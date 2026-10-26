import QRCode from 'qrcode';
import sharp from 'sharp';

const VERDE = '#386641';
const CREMA = '#f2e8cf';
const MARGEN = 1;
const LADO_CODIGO = 324;
// Contorno estable, independiente de los módulos del QR.
const SILUETA = `M108 263 C111 181 149 126 218 114
 C297 99 366 121 426 132 C451 84 503 67 547 89
 C596 113 613 167 615 217 C639 244 669 225 680 185
 C688 154 679 120 678 98 C676 76 692 76 704 95
 C726 134 723 192 705 231 C687 272 650 302 610 291
 C594 287 582 278 573 268 C562 321 539 365 511 385
 L506 485 Q505 498 492 498 L453 498 Q440 498 440 485 L435 430
 L403 435 L400 487 Q400 501 386 501 L351 501 Q339 501 337 487 L331 437
 L263 437 L255 487 Q254 501 241 501 L205 501 Q192 501 194 487 L198 431
 L164 422 L153 484 Q151 498 137 498 L103 498 Q91 498 94 485 L110 348
 C105 323 104 291 108 263 Z`;

/**
 * Genera el pase desde un contorno vectorial fijo y un QR dinámico en el torso.
 * @param {string} contenido Enlace o texto por codificar.
 * @returns {Promise<Buffer>} PNG de 1520 × 1100 para pase y adjunto de correo.
 * @throws {Error} Si el contenido es inválido o demasiado extenso.
 */
export async function generarQr(contenido) {
  if (typeof contenido !== 'string' || contenido.trim().length === 0) {
    throw new Error('El contenido del QR no puede estar vacío.');
  }
  const codigo = QRCode.create(contenido, { errorCorrectionLevel: 'H' });
  const modulo = LADO_CODIGO / (codigo.modules.size + MARGEN * 2);
  if (modulo < 4) {
    throw new Error('El contenido del QR es demasiado extenso para el pase de inscripción.');
  }
  const lado = (codigo.modules.size + MARGEN * 2) * modulo;
  const x = 135;
  const y = 121;
  const modulos = [];
  for (let fila = 0; fila < codigo.modules.size; fila += 1) {
    for (let columna = 0; columna < codigo.modules.size; columna += 1) {
      if (codigo.modules.get(fila, columna)) {
        modulos.push(
          `<rect x="${x + (columna + MARGEN) * modulo}" y="${y + (fila + MARGEN) * modulo}" width="${modulo}" height="${modulo}"/>`,
        );
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 550" width="1520" height="1100">
    <defs><clipPath id="piel"><path d="${SILUETA}"/></clipPath></defs>
    <rect width="760" height="550" fill="${CREMA}"/>
    <path d="${SILUETA}" fill="${CREMA}" stroke="${VERDE}" stroke-width="5"/>
    <g clip-path="url(#piel)" fill="${VERDE}">${patronPiel()}</g>
    <path d="M110 246 C82 269 84 310 68 332" fill="none" stroke="${VERDE}" stroke-width="6" stroke-linecap="round"/>
    <path d="M68 327 Q56 335 61 344 Q73 345 75 331" fill="${VERDE}"/>
    <rect x="${x}" y="${y}" width="${lado}" height="${lado}" fill="${CREMA}"/>
    <g fill="${VERDE}" shape-rendering="crispEdges">${modulos.join('')}</g>
    <path d="M520 125 C479 106 465 137 467 185 C469 226 487 247 510 261 C534 234 543 196 542 160 C542 143 531 131 520 125 Z" fill="${CREMA}" stroke="${VERDE}" stroke-width="5"/>
    <path d="M520 137 C486 122 480 146 481 181 C482 210 493 232 506 241" fill="none" stroke="${VERDE}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="566" cy="161" r="9" fill="${CREMA}"/><circle cx="566" cy="161" r="4.5" fill="${VERDE}"/>
    <path d="M580 230 Q595 238 610 228" fill="none" stroke="${VERDE}" stroke-width="4" stroke-linecap="round"/>
    <g stroke="${CREMA}" stroke-width="4">${[116, 130, 144, 212, 226, 240, 352, 366, 380, 457, 471, 485].map((dedo) => `<path d="M${dedo} 485v13"/>`).join('')}</g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function patronPiel() {
  const modulos = [];
  let semilla = 173;
  for (let y = 80; y < 505; y += 8) {
    for (let x = 88; x < 728; x += 8) {
      // Secuencia estable sin franjas diagonales ni dependencia del contenido del QR.
      semilla ^= semilla << 13;
      semilla ^= semilla >>> 17;
      semilla ^= semilla << 5;
      semilla >>>= 0;
      if (semilla / 4294967296 < 0.6) {
        modulos.push(`<rect x="${x}" y="${y}" width="8" height="8"/>`);
      }
    }
  }
  return modulos.join('');
}
