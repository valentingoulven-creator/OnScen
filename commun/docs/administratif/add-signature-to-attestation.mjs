/**
 * Superpose la signature sur l'attestation sur l'honneur INPI.
 * Usage: node add-signature-to-attestation.mjs [--in-place]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PDF_PATH = path.join(
  __dirname,
  'attestation_sur_lhonneur_sur_papier_libre_relative_a_labsence_de_condamnation_ou_de_sanction_civile_ou_administra.pdf'
);
const SIG_SRC = path.join(__dirname, 'assets', 'signature-valentin-goulven.png');
const SIG_FALLBACK = path.join(
  'C:/Users/vivia/.cursor/projects/c-Dev-OnScen/assets/c__Users_vivia_AppData_Roaming_Cursor_User_workspaceStorage_419acbc9cbd4685a40a517f5f5dcb476_images_image-e735f785-7a43-4a38-b2c2-e5decf0029e3.png'
);
const OUT_PATH = process.argv.includes('--in-place')
  ? PDF_PATH
  : PDF_PATH.replace(/\.pdf$/i, '_signee.pdf');

/** Efface une signature précédente mal positionnée (bas droite). */
const OLD_SIG = { x: 370, y: 85, width: 160, height: 115 };

async function main() {
  const sigPath = fs.existsSync(SIG_SRC) ? SIG_SRC : SIG_FALLBACK;
  if (!fs.existsSync(PDF_PATH)) {
    console.error('PDF introuvable:', PDF_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(sigPath)) {
    console.error('Signature introuvable:', sigPath);
    process.exit(1);
  }

  const pdfDoc = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const png = await pdfDoc.embedPng(fs.readFileSync(sigPath));

  const page = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  const { width, height } = page.getSize();

  // Masquer une éventuelle signature déjà posée trop bas
  page.drawRectangle({
    x: OLD_SIG.x,
    y: OLD_SIG.y,
    width: OLD_SIG.width,
    height: OLD_SIG.height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  // Coordonnées mesurées dans le PDF INPI : « Signature » @ x≈57, baseline y≈516
  const labelX = 56.664;
  const labelBaselineY = 516.38;
  const gapBelowLabel = 12;

  const sigWidth = 130;
  const sigHeight = (png.height / png.width) * sigWidth;
  const x = labelX;
  const y = labelBaselineY - gapBelowLabel - sigHeight;

  page.drawImage(png, { x, y, width: sigWidth, height: sigHeight });

  fs.writeFileSync(OUT_PATH, await pdfDoc.save());

  console.log('Page size:', width, 'x', height);
  console.log('Label Signature @', { labelX, labelBaselineY });
  console.log('Signature @', { x: Math.round(x), y: Math.round(y), sigWidth, sigHeight: Math.round(sigHeight) });
  console.log('PDF signé:', OUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
