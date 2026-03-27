import { describe, it, expect } from 'vitest';
import { encodeBoard, decodeBoard, extractBoardFromPath, boardToPath } from '../src/lib/encoder';
import { generateBoard } from '../src/lib/generator';
import type { Board } from '../src/lib/types';

describe('encoder round-trip', () => {
  for (const size of [5, 6, 7, 8, 9] as const) {
    it(`round-trips a size ${size} board`, () => {
      const { board, metrics } = generateBoard(size);
      const encoded = encodeBoard(board);
      const decoded = decodeBoard(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.board.size).toBe(size);
      expect(decoded!.difficulty).toBeNull(); // no difficulty passed to encodeBoard
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          expect(decoded!.board.regions[r][c]).toBe(board.regions[r][c]);
        }
      }
      void metrics; // metrics available but not tested here
    });
  }

  it('round-trips difficulty 1–5 for each value', () => {
    const { board } = generateBoard(5);
    for (const diff of [1, 2, 3, 4, 5] as const) {
      const encoded = encodeBoard(board, diff);
      const decoded = decodeBoard(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.difficulty).toBe(diff);
      expect(decoded!.board.size).toBe(5);
    }
  });

  it('decodes old URLs (no difficulty digit) with difficulty null', () => {
    const { board } = generateBoard(6);
    const oldStyleEncoded = encodeBoard(board); // no difficulty
    const decoded = decodeBoard(oldStyleEncoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.difficulty).toBeNull();
  });
});

describe('encodeBoard', () => {
  it('starts with version prefix and size', () => {
    const board: Board = {
      size: 5,
      regions: [
        [0, 0, 1, 1, 1],
        [0, 0, 1, 2, 2],
        [3, 0, 1, 2, 2],
        [3, 3, 4, 4, 2],
        [3, 3, 4, 4, 4],
      ],
    };
    const encoded = encodeBoard(board);
    expect(encoded.startsWith('v15')).toBe(true); // v1 + size 5
  });

  it('produces compact output', () => {
    const { board } = generateBoard(5);
    const encoded = encodeBoard(board);
    // v1 (2 chars) + size (1 char) + base64 data
    // 25 cells × 3 bits = 75 bits = 10 bytes ≈ 14 base64 chars
    expect(encoded.length).toBeLessThan(25);
  });

  it('produces compact output for size 9', () => {
    const { board } = generateBoard(9);
    const encoded = encodeBoard(board);
    // 81 cells × 4 bits = 324 bits = 41 bytes ≈ 55 base64 chars
    expect(encoded.length).toBeLessThan(65);
  });
});

describe('decodeBoard', () => {
  it('returns null for empty string', () => {
    expect(decodeBoard('')).toBeNull();
  });

  it('returns null for wrong version', () => {
    expect(decodeBoard('v25ABC')).toBeNull();
  });

  it('returns null for invalid size', () => {
    expect(decodeBoard('v13ABC')).toBeNull(); // size 3 not valid
    expect(decodeBoard('v1aABC')).toBeNull(); // not a number
  });

  it('returns null for string over 200 chars', () => {
    expect(decodeBoard('v15' + 'A'.repeat(200))).toBeNull();
  });

  it('returns null for invalid base64url characters', () => {
    expect(decodeBoard('v15!!!!')).toBeNull();
  });
});

describe('path helpers', () => {
  it('extractBoardFromPath gets encoding from /game/ path', () => {
    expect(extractBoardFromPath('/game/v15ABC123')).toBe('v15ABC123');
  });

  it('extractBoardFromPath returns null for non-game paths', () => {
    expect(extractBoardFromPath('/')).toBeNull();
    expect(extractBoardFromPath('/about')).toBeNull();
  });

  it('boardToPath creates correct path', () => {
    expect(boardToPath('v15ABC123')).toBe('/game/v15ABC123');
  });
});
