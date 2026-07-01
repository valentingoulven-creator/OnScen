/**
 * Sondage de la durée réelle d'une vidéo à partir de ses octets (headers de conteneur),
 * sans dépendance externe (pas de ffmpeg/ffprobe — non disponible de façon fiable sur
 * tous les environnements de déploiement : VPS Linux, .exe Windows packagé msdev).
 *
 * Supporte MP4/MOV/M4V (ISO BMFF — box `moov` > `mvhd`) et WebM (EBML — `Segment` >
 * `Info` > `Duration` + `TimecodeScale`).
 *
 * Best-effort : si le conteneur ne peut pas être décodé (moov en streaming sans durée
 * connue, fichier tronqué, format non reconnu…), retourne `null` plutôt que de rejeter
 * l'upload — la durée déclarée par le client reste alors utilisée comme repli.
 */

interface Mp4Box {
  type: string;
  start: number;
  end: number;
}

function walkMp4Boxes(buf: Buffer, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size32;
    if (size32 === 1) {
      if (offset + 16 > end) break;
      boxSize = Number(buf.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }
    if (boxSize < headerSize || offset + boxSize > end + headerSize) break;
    const boxEnd = Math.min(offset + boxSize, end);
    boxes.push({ type, start: offset + headerSize, end: boxEnd });
    if (boxEnd <= offset) break;
    offset = boxEnd;
  }
  return boxes;
}

/** Durée (s) d'un MP4/MOV/M4V via le box `mvhd` du `moov`. */
export function probeMp4DurationSec(buffer: Buffer): number | null {
  try {
    const top = walkMp4Boxes(buffer, 0, buffer.length);
    const moov = top.find((b) => b.type === 'moov');
    if (!moov) return null;
    const mvhd = walkMp4Boxes(buffer, moov.start, moov.end).find((b) => b.type === 'mvhd');
    if (!mvhd) return null;
    const version = buffer[mvhd.start];
    let timescale: number;
    let duration: number;
    if (version === 1) {
      timescale = buffer.readUInt32BE(mvhd.start + 20);
      duration = Number(buffer.readBigUInt64BE(mvhd.start + 24));
    } else {
      timescale = buffer.readUInt32BE(mvhd.start + 12);
      duration = buffer.readUInt32BE(mvhd.start + 16);
    }
    if (!timescale || !Number.isFinite(duration)) return null;
    const sec = duration / timescale;
    return Number.isFinite(sec) && sec >= 0 ? sec : null;
  } catch {
    return null;
  }
}

const EBML_SEGMENT_ID = 0x18538067;
const EBML_INFO_ID = 0x1549a966;
const EBML_TIMECODESCALE_ID = 0x2ad7b1;
const EBML_DURATION_ID = 0x4489;

interface EbmlElement {
  id: number;
  dataStart: number;
  dataEnd: number;
}

function readEbmlVint(
  buf: Buffer,
  offset: number,
  maxLength: number,
  stripMarker: boolean
): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  let length = 0;
  for (let i = 0; i < maxLength; i++) {
    if (first & (0x80 >> i)) {
      length = i + 1;
      break;
    }
  }
  if (length === 0 || offset + length > buf.length) return null;
  let value = stripMarker ? first & (0xff >> length) : first;
  for (let i = 1; i < length; i++) value = value * 256 + buf[offset + i];
  return { value, length };
}

function* iterateEbmlElements(buf: Buffer, start: number, end: number): Generator<EbmlElement> {
  let offset = start;
  while (offset < end) {
    const idInfo = readEbmlVint(buf, offset, 4, false);
    if (!idInfo) return;
    const sizeOffset = offset + idInfo.length;
    const sizeInfo = readEbmlVint(buf, sizeOffset, 8, true);
    if (!sizeInfo) return;
    const dataStart = sizeOffset + sizeInfo.length;
    const unknownSizeMarker = Math.pow(2, 7 * sizeInfo.length) - 1;
    const dataSize = sizeInfo.value === unknownSizeMarker ? end - dataStart : sizeInfo.value;
    const dataEnd = Math.min(dataStart + dataSize, end);
    if (dataEnd <= offset || dataStart > end) return;
    yield { id: idInfo.value, dataStart, dataEnd };
    offset = dataEnd;
  }
}

function readEbmlUint(buf: Buffer, start: number, end: number): number {
  let v = 0;
  for (let i = start; i < end; i++) v = v * 256 + buf[i];
  return v;
}

function readEbmlFloat(buf: Buffer, start: number, end: number): number | null {
  const len = end - start;
  if (len === 4) return buf.readFloatBE(start);
  if (len === 8) return buf.readDoubleBE(start);
  return null;
}

/** Durée (s) d'un WebM via `Segment` > `Info` > `Duration`/`TimecodeScale` (EBML). */
export function probeWebmDurationSec(buffer: Buffer): number | null {
  try {
    for (const top of iterateEbmlElements(buffer, 0, buffer.length)) {
      if (top.id !== EBML_SEGMENT_ID) continue;
      for (const child of iterateEbmlElements(buffer, top.dataStart, top.dataEnd)) {
        if (child.id !== EBML_INFO_ID) continue;
        let timecodeScale = 1_000_000; // ns, valeur par défaut EBML
        let durationRaw: number | null = null;
        for (const infoChild of iterateEbmlElements(buffer, child.dataStart, child.dataEnd)) {
          if (infoChild.id === EBML_TIMECODESCALE_ID) {
            timecodeScale = readEbmlUint(buffer, infoChild.dataStart, infoChild.dataEnd) || timecodeScale;
          } else if (infoChild.id === EBML_DURATION_ID) {
            durationRaw = readEbmlFloat(buffer, infoChild.dataStart, infoChild.dataEnd);
          }
        }
        if (durationRaw == null) return null;
        const sec = (durationRaw * timecodeScale) / 1e9;
        return Number.isFinite(sec) && sec >= 0 ? sec : null;
      }
      return null; // Segment sans Info
    }
    return null;
  } catch {
    return null;
  }
}

/** Sonde la durée (s) d'une vidéo décodée selon son sous-type MIME déclaré. */
export function probeVideoDurationSec(buffer: Buffer, mimeSubtype: string): number | null {
  const m = mimeSubtype.toLowerCase();
  if (m === 'webm') return probeWebmDurationSec(buffer);
  if (m === 'mp4' || m === 'quicktime' || m === 'x-m4v') return probeMp4DurationSec(buffer);
  return null;
}
