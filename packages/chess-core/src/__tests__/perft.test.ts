import { describe, expect, it } from 'vitest';
import { createGame, perft, perftDivide, squareName } from '../index';

interface PerftCase {
  name: string;
  fen: string;
  depth: number;
  nodes: number;
}

/**
 * Reference node counts from the Chess Programming Wiki. These exercise
 * castling, en passant, promotion, pins and discovered checks.
 */
const CASES: PerftCase[] = [
  {
    name: 'start position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depth: 4,
    nodes: 197281,
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depth: 3,
    nodes: 97862,
  },
  {
    name: 'position 3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depth: 4,
    nodes: 43238,
  },
  {
    name: 'position 4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depth: 4,
    nodes: 422333,
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depth: 3,
    nodes: 62379,
  },
  {
    name: 'position 6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    depth: 4,
    nodes: 3894594,
  },
];

describe('perft', () => {
  it.each(CASES)('$name (depth $depth) = $nodes', ({ fen, depth, nodes }) => {
    expect(perft(createGame(fen), depth)).toBe(nodes);
  });

  it('reaches 4,865,609 nodes from the start at depth 5', () => {
    expect(perft(createGame(), 5)).toBe(4865609);
  });

  it('reaches 4,085,603 nodes from kiwipete at depth 4', () => {
    const game = createGame(
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    );
    expect(perft(game, 4)).toBe(4085603);
  });
});

describe('perftDivide', () => {
  it('sums to the total node count at depth 1', () => {
    const game = createGame();
    const divide = perftDivide(game, 2);
    const total = Object.values(divide).reduce((sum, nodes) => sum + nodes, 0);

    expect(total).toBe(400);
    expect(Object.keys(divide)).toHaveLength(20);
  });

  it('reports knight moves by name', () => {
    const divide = perftDivide(createGame(), 1);
    expect(divide[squareName(1) + squareName(18)]).toBe(1); // b1-c3
  });
});
