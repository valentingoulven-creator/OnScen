import { describe, expect, it } from 'vitest';
import { probeMp4DurationSec, probeVideoDurationSec, probeWebmDurationSec } from './videoDuration';

function buildBox(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function buildMvhdPayload(version: 0 | 1, timescale: number, duration: number): Buffer {
  if (version === 0) {
    const buf = Buffer.alloc(20);
    buf.writeUInt32BE(0, 4);
    buf.writeUInt32BE(0, 8);
    buf.writeUInt32BE(timescale, 12);
    buf.writeUInt32BE(duration, 16);
    return buf;
  }
  const buf = Buffer.alloc(32);
  buf[0] = 1;
  buf.writeBigUInt64BE(0n, 4);
  buf.writeBigUInt64BE(0n, 12);
  buf.writeUInt32BE(timescale, 20);
  buf.writeBigUInt64BE(BigInt(duration), 24);
  return buf;
}

function buildMp4(version: 0 | 1, timescale: number, duration: number): Buffer {
  const mvhd = buildBox('mvhd', buildMvhdPayload(version, timescale, duration));
  return buildBox('moov', mvhd);
}

function encodeVintSize(value: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  const marker = 0x80 >> (length - 1);
  const dataMask = 0xff >> length;
  let v = value;
  for (let i = length - 1; i >= 1; i--) {
    buf[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  buf[0] = marker | (v & dataMask);
  return buf;
}

function idBytes(id: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  let v = id;
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return buf;
}

function uintBytes(value: number): Buffer {
  if (value === 0) return Buffer.from([0]);
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Buffer.from(bytes);
}

function ebmlElement(idBuf: Buffer, payload: Buffer): Buffer {
  return Buffer.concat([idBuf, encodeVintSize(payload.length, 1), payload]);
}

const SEGMENT_ID = idBytes(0x18538067, 4);
const INFO_ID = idBytes(0x1549a966, 4);
const TIMECODESCALE_ID = idBytes(0x2ad7b1, 3);
const DURATION_ID = idBytes(0x4489, 2);

function buildWebm(durationSec: number, timecodeScaleNs = 1_000_000): Buffer {
  const durationTicks = (durationSec * 1e9) / timecodeScaleNs;
  const durationBytes = Buffer.alloc(8);
  durationBytes.writeDoubleBE(durationTicks, 0);
  const info = ebmlElement(
    INFO_ID,
    Buffer.concat([
      ebmlElement(TIMECODESCALE_ID, uintBytes(timecodeScaleNs)),
      ebmlElement(DURATION_ID, durationBytes),
    ])
  );
  return ebmlElement(SEGMENT_ID, info);
}

describe('probeMp4DurationSec', () => {
  it('parses mvhd version 0 duration', () => {
    expect(probeMp4DurationSec(buildMp4(0, 1000, 5000))).toBe(5);
  });

  it('parses mvhd version 1 duration (64-bit fields)', () => {
    expect(probeMp4DurationSec(buildMp4(1, 90000, 90000 * 12))).toBe(12);
  });

  it('returns null when moov box is missing', () => {
    expect(probeMp4DurationSec(Buffer.from('not a real mp4 file'))).toBeNull();
  });

  it('returns null on truncated/corrupted buffers', () => {
    const truncated = buildMp4(0, 1000, 5000).subarray(0, 10);
    expect(probeMp4DurationSec(truncated)).toBeNull();
  });
});

describe('probeWebmDurationSec', () => {
  it('parses Segment > Info > Duration with default TimecodeScale', () => {
    expect(probeWebmDurationSec(buildWebm(10))).toBeCloseTo(10, 5);
  });

  it('parses a non-default TimecodeScale correctly', () => {
    expect(probeWebmDurationSec(buildWebm(45, 100_000))).toBeCloseTo(45, 5);
  });

  it('returns null when Segment/Info elements are absent', () => {
    expect(probeWebmDurationSec(Buffer.from('not a webm file'))).toBeNull();
  });
});

describe('probeVideoDurationSec', () => {
  it('dispatches to the mp4 parser for mp4/quicktime/x-m4v subtypes', () => {
    const buf = buildMp4(0, 1000, 30_000);
    expect(probeVideoDurationSec(buf, 'mp4')).toBe(30);
    expect(probeVideoDurationSec(buf, 'quicktime')).toBe(30);
    expect(probeVideoDurationSec(buf, 'x-m4v')).toBe(30);
  });

  it('dispatches to the webm parser for the webm subtype', () => {
    expect(probeVideoDurationSec(buildWebm(20), 'webm')).toBeCloseTo(20, 5);
  });

  it('returns null for unknown subtypes', () => {
    expect(probeVideoDurationSec(buildMp4(0, 1000, 5000), 'ogg')).toBeNull();
  });
});
