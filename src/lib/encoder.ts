import type { Board, BoardSize } from './types';

const VERSION = 'v1';

/**
 * Bits per cell based on board size.
 * Sizes 5-8 need region IDs 0-7 → 3 bits.
 * Size 9 needs region IDs 0-8 → 4 bits.
 */
function bitsPerCell(size: BoardSize): number {
  return size <= 8 ? 3 : 4;
}

/**
 * Returns the number of base64url characters produced by encoding `byteCount` bytes
 * with the unpadded scheme used here.
 */
function base64urlLength(byteCount: number): number {
  const remainder = byteCount % 3;
  return Math.floor(byteCount / 3) * 4 + (remainder === 0 ? 0 : remainder + 1);
}

/**
 * Encode a board into a compact URL-safe string.
 * Format: "v1" + size digit + base64url-encoded region data [+ difficulty digit 1–5]
 * Example: "v17AqM2x...3" (version 1, size 7, encoded regions, difficulty 3)
 * The difficulty digit is optional for backward compatibility with old shared URLs.
 */
export function encodeBoard(board: Board, difficulty?: 1 | 2 | 3 | 4 | 5): string {
  const { size, regions } = board;
  const bits = bitsPerCell(size as BoardSize);
  const totalBits = size * size * bits;
  const totalBytes = Math.ceil(totalBits / 8);
  const bytes = new Uint8Array(totalBytes);

  let bitPos = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const value = regions[r][c];
      // Write `bits` bits of value starting at bitPos
      for (let b = bits - 1; b >= 0; b--) {
        const bit = (value >> b) & 1;
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = 7 - (bitPos % 8);
        bytes[byteIdx] |= bit << bitIdx;
        bitPos++;
      }
    }
  }

  const base = VERSION + size.toString() + base64urlEncode(bytes);
  return difficulty !== undefined ? base + difficulty.toString() : base;
}

/**
 * Decode a compact string back into a Board and optional difficulty.
 * Accepts both old format (no difficulty) and new format (trailing digit 1–5).
 * Returns null if the string is invalid.
 */
export function decodeBoard(encoded: string): { board: Board; difficulty: 1 | 2 | 3 | 4 | 5 | null } | null {
  if (!encoded || encoded.length > 200) return null;

  // Check version prefix
  if (!encoded.startsWith(VERSION)) return null;
  const rest = encoded.slice(VERSION.length);

  if (rest.length < 2) return null;

  // Parse size
  const sizeChar = rest[0];
  const size = parseInt(sizeChar, 10);
  if (isNaN(size) || size < 5 || size > 9) return null;

  const bits = bitsPerCell(size as BoardSize);
  const totalBits = size * size * bits;
  const expectedBytes = Math.ceil(totalBits / 8);
  const expectedBase64Len = base64urlLength(expectedBytes);

  const payload = rest.slice(1); // base64url data + optional difficulty digit

  // Extract optional trailing difficulty digit
  let difficulty: 1 | 2 | 3 | 4 | 5 | null = null;
  let boardData = payload;
  if (payload.length === expectedBase64Len + 1) {
    const last = payload[payload.length - 1];
    if (last >= '1' && last <= '5') {
      difficulty = parseInt(last, 10) as 1 | 2 | 3 | 4 | 5;
      boardData = payload.slice(0, expectedBase64Len);
    } else {
      return null; // unexpected trailing character
    }
  } else if (payload.length !== expectedBase64Len) {
    return null; // wrong length
  }

  const bytes = base64urlDecode(boardData);
  if (!bytes || bytes.length < expectedBytes) return null;

  // Decode regions
  const regions: number[][] = [];
  let bitPos = 0;

  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      let value = 0;
      for (let b = bits - 1; b >= 0; b--) {
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = 7 - (bitPos % 8);
        value |= ((bytes[byteIdx] >> bitIdx) & 1) << b;
        bitPos++;
      }

      // Validate region ID
      if (value < 0 || value >= size) return null;
      row.push(value);
    }
    regions.push(row);
  }

  // Validate each region has at least 1 cell
  const regionCounts = new Array(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      regionCounts[regions[r][c]]++;
    }
  }
  for (let i = 0; i < size; i++) {
    if (regionCounts[i] === 0) return null;
  }

  return { board: { size: size as BoardSize, regions }, difficulty };
}

/**
 * Extract the board encoding from a URL path like "/game/v17AqM2x..."
 */
export function extractBoardFromPath(path: string): string | null {
  const match = path.match(/^\/game\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Build a URL path from an encoded board string.
 */
export function boardToPath(encoded: string): string {
  return `/game/${encoded}`;
}

// Base64url encoding (RFC 4648 §5, no padding)
function base64urlEncode(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[(b0 >> 2) & 0x3f];
    result += chars[((b0 << 4) | (b1 >> 4)) & 0x3f];
    if (i + 1 < bytes.length) {
      result += chars[((b1 << 2) | (b2 >> 6)) & 0x3f];
    }
    if (i + 2 < bytes.length) {
      result += chars[b2 & 0x3f];
    }
  }
  return result;
}

function base64urlDecode(str: string): Uint8Array | null {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) {
    lookup.set(chars[i], i);
  }

  // Validate characters
  for (const ch of str) {
    if (!lookup.has(ch)) return null;
  }

  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 4) {
    const c0 = lookup.get(str[i]) ?? 0;
    const c1 = i + 1 < str.length ? (lookup.get(str[i + 1]) ?? 0) : 0;
    const c2 = i + 2 < str.length ? (lookup.get(str[i + 2]) ?? 0) : 0;
    const c3 = i + 3 < str.length ? (lookup.get(str[i + 3]) ?? 0) : 0;

    bytes.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < str.length) {
      bytes.push(((c1 << 4) | (c2 >> 2)) & 0xff);
    }
    if (i + 3 < str.length) {
      bytes.push(((c2 << 6) | c3) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}
