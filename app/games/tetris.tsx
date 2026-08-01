/**
 * /games/tetris — Blocks.
 *
 * The classic falling-block game in 10 columns × 20 rows. Standard
 * tetrominoes (I, O, T, S, Z, L, J), standard rotation, soft drop,
 * hard drop, line clearing with score and increasing speed by level.
 *
 * Keyboard:
 *   ←/→  move
 *   ↓    soft drop (faster fall)
 *   ↑/X  rotate clockwise
 *   Z    rotate counter-clockwise
 *   Space hard drop (slam to bottom)
 *   P    pause
 *
 * Touch (mobile):
 *   Tap left half  : move left
 *   Tap right half : move right
 *   Tap center     : rotate
 *   Swipe down     : soft drop
 *   Long-press     : hard drop
 *
 * No leaderboards, no daily quests, no popups. Just the game.
 */

import React, { useEffect, useReducer, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, Heights } from '../../constants/design';
import { Gen } from '../../constants/generations';

const COLS = 10;
const ROWS = 20;

// 0 = empty. 1-7 = piece type id, used for color.
type Cell = number;
type Board = Cell[][];

// Each tetromino: an array of rotations, each rotation is a 4×4 grid
// of 0/1. Coordinates are [row][col].
const PIECES: number[][][][] = [
  // I
  [
    [
      [0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0],
    ],
    [
      [0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0],
    ],
    [
      [0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0],
    ],
    [
      [0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],
    ],
  ],
  // O
  [
    [
      [0,2,2,0],[0,2,2,0],[0,0,0,0],[0,0,0,0],
    ],
  ],
  // T
  [
    [[0,3,0,0],[3,3,3,0],[0,0,0,0],[0,0,0,0]],
    [[0,3,0,0],[0,3,3,0],[0,3,0,0],[0,0,0,0]],
    [[0,0,0,0],[3,3,3,0],[0,3,0,0],[0,0,0,0]],
    [[0,3,0,0],[3,3,0,0],[0,3,0,0],[0,0,0,0]],
  ],
  // S
  [
    [[0,4,4,0],[4,4,0,0],[0,0,0,0],[0,0,0,0]],
    [[4,0,0,0],[4,4,0,0],[0,4,0,0],[0,0,0,0]],
    [[0,0,0,0],[0,4,4,0],[4,4,0,0],[0,0,0,0]],
    [[0,4,0,0],[0,4,4,0],[0,0,4,0],[0,0,0,0]],
  ],
  // Z
  [
    [[5,5,0,0],[0,5,5,0],[0,0,0,0],[0,0,0,0]],
    [[0,0,5,0],[0,5,5,0],[0,5,0,0],[0,0,0,0]],
    [[0,0,0,0],[5,5,0,0],[0,5,5,0],[0,0,0,0]],
    [[0,5,0,0],[5,5,0,0],[5,0,0,0],[0,0,0,0]],
  ],
  // J
  [
    [[6,0,0,0],[6,6,6,0],[0,0,0,0],[0,0,0,0]],
    [[0,6,6,0],[0,6,0,0],[0,6,0,0],[0,0,0,0]],
    [[0,0,0,0],[6,6,6,0],[0,0,6,0],[0,0,0,0]],
    [[0,6,0,0],[0,6,0,0],[6,6,0,0],[0,0,0,0]],
  ],
  // L
  [
    [[0,0,7,0],[7,7,7,0],[0,0,0,0],[0,0,0,0]],
    [[0,7,0,0],[0,7,0,0],[0,7,7,0],[0,0,0,0]],
    [[0,0,0,0],[7,7,7,0],[7,0,0,0],[0,0,0,0]],
    [[7,7,0,0],[0,7,0,0],[0,7,0,0],[0,0,0,0]],
  ],
];

/**
 * Piece colors, indexed by piece id. Built per render: these were seven
 * hand-copied hexes at module scope, five of them stale duplicates of
 * dark-theme palette values, so they froze at import and drifted the
 * moment those tokens moved. Seven distinct hues is the requirement, and
 * the palette carries exactly seven that stay apart in every skin.
 */
function pieceColors(): string[] {
  return [
    'transparent',
    Colors.info,                        // I — blue
    Colors.important,                   // O — gold
    Colors.share,                       // T — violet
    Colors.agree,                       // S — green
    Colors.disagree,                    // Z — red
    Colors.clusters.pragmatic_center,   // J — warm neutral
    Colors.clusters.tradition_minded,   // L — orange
  ];
}

interface Piece { type: number; rot: number; row: number; col: number; }

interface State {
  board: Board;
  piece: Piece;
  next: number;
  bag: number[];
  score: number;
  level: number;
  lines: number;
  paused: boolean;
  over: boolean;
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function refillBag(): number[] {
  // 7-piece bag — each tetromino once, in random order. Standard.
  const arr = [0,1,2,3,4,5,6];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickFromBag(bag: number[]): { piece: number; nextBag: number[] } {
  let nb = bag.length === 0 ? refillBag() : bag;
  const piece = nb[0];
  return { piece, nextBag: nb.slice(1) };
}

function spawnPiece(type: number): Piece {
  return { type, rot: 0, row: 0, col: 3 };
}

function shape(p: Piece): number[][] { return PIECES[p.type][p.rot % PIECES[p.type].length]; }

function fits(board: Board, p: Piece): boolean {
  const sh = shape(p);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (sh[r][c] === 0) continue;
      const br = p.row + r;
      const bc = p.col + c;
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) return false;
      if (board[br][bc] !== 0) return false;
    }
  }
  return true;
}

function lockPiece(board: Board, p: Piece): { board: Board; cleared: number } {
  const next = board.map((row) => [...row]);
  const sh = shape(p);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (sh[r][c] !== 0) {
        const br = p.row + r;
        const bc = p.col + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
          next[br][bc] = sh[r][c];
        }
      }
    }
  }
  // Clear full rows.
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (next[r].every((v) => v !== 0)) {
      next.splice(r, 1);
      next.unshift(Array<Cell>(COLS).fill(0));
      cleared += 1;
      r += 1; // re-check this row
    }
  }
  return { board: next, cleared };
}

const SCORES_PER_LINE = [0, 100, 300, 500, 800];

function levelTickMs(level: number): number {
  // Speed table — Gym Boy era. Level 0 falls every 800ms; level 9 every 100ms.
  const base = 800 - level * 70;
  return Math.max(80, base);
}

type Action =
  | { type: 'tick' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'down' }
  | { type: 'rotate'; ccw?: boolean }
  | { type: 'drop' }
  | { type: 'pause' }
  | { type: 'reset' };

function reducer(s: State, a: Action): State {
  if (s.over) {
    if (a.type === 'reset') return initialState();
    return s;
  }
  if (s.paused && a.type !== 'pause' && a.type !== 'reset') return s;

  switch (a.type) {
    case 'pause':
      return { ...s, paused: !s.paused };
    case 'reset':
      return initialState();
    case 'tick':
    case 'down': {
      const next = { ...s.piece, row: s.piece.row + 1 };
      if (fits(s.board, next)) return { ...s, piece: next };
      // Lock + clear.
      const { board: nb, cleared } = lockPiece(s.board, s.piece);
      const totalLines = s.lines + cleared;
      const newLevel = Math.floor(totalLines / 10);
      const score = s.score + SCORES_PER_LINE[cleared] * (s.level + 1);
      // Spawn next.
      const nextType = s.next;
      const piece = spawnPiece(nextType);
      const { piece: future, nextBag } = pickFromBag(s.bag);
      const over = !fits(nb, piece);
      return {
        board: nb,
        piece,
        next: future,
        bag: nextBag,
        score,
        level: newLevel,
        lines: totalLines,
        paused: false,
        over,
      };
    }
    case 'left': {
      const np = { ...s.piece, col: s.piece.col - 1 };
      return fits(s.board, np) ? { ...s, piece: np } : s;
    }
    case 'right': {
      const np = { ...s.piece, col: s.piece.col + 1 };
      return fits(s.board, np) ? { ...s, piece: np } : s;
    }
    case 'rotate': {
      const rotMax = PIECES[s.piece.type].length;
      const newRot = (s.piece.rot + (a.ccw ? rotMax - 1 : 1)) % rotMax;
      // Wall-kick — try base, then ±1 col, then ±2.
      for (const kick of [0, -1, 1, -2, 2]) {
        const np = { ...s.piece, rot: newRot, col: s.piece.col + kick };
        if (fits(s.board, np)) return { ...s, piece: np };
      }
      return s;
    }
    case 'drop': {
      let p = s.piece;
      while (fits(s.board, { ...p, row: p.row + 1 })) p = { ...p, row: p.row + 1 };
      return reducer({ ...s, piece: p }, { type: 'tick' });
    }
  }
}

function initialState(): State {
  const bag1 = refillBag();
  const piece = spawnPiece(bag1[0]);
  const next = bag1[1];
  return {
    board: emptyBoard(),
    piece,
    next,
    bag: bag1.slice(2),
    score: 0,
    level: 0,
    lines: 0,
    paused: false,
    over: false,
  };
}

export default function Tetris() {
  const s = makeStyles();
  const pieceHex = pieceColors();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const tickRef = useRef<any>(null);

  // Game loop.
  useEffect(() => {
    if (state.over || state.paused) return;
    const ms = levelTickMs(state.level);
    tickRef.current = setTimeout(() => dispatch({ type: 'tick' }), ms);
    return () => { if (tickRef.current) clearTimeout(tickRef.current); };
  }, [state.piece, state.level, state.paused, state.over]);

  // Keyboard.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft':  dispatch({ type: 'left' }); break;
        case 'ArrowRight': dispatch({ type: 'right' }); break;
        case 'ArrowDown':  dispatch({ type: 'down' }); break;
        case 'ArrowUp':
        case 'x': case 'X': dispatch({ type: 'rotate' }); break;
        case 'z': case 'Z': dispatch({ type: 'rotate', ccw: true }); break;
        case ' ':          e.preventDefault(); dispatch({ type: 'drop' }); break;
        case 'p': case 'P': dispatch({ type: 'pause' }); break;
        case 'r': case 'R': dispatch({ type: 'reset' }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Render the board with the active piece overlaid.
  const display = state.board.map((row) => [...row]);
  const sh = shape(state.piece);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (sh[r][c] !== 0) {
        const br = state.piece.row + r;
        const bc = state.piece.col + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) {
          display[br][bc] = sh[r][c];
        }
      }
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/games' as any)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>BLOCKS</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={s.scorebar}>
        <View style={s.scoreCol}>
          <Text style={s.scoreLabel}>Score</Text>
          <Text style={s.scoreNum}>{state.score}</Text>
        </View>
        <View style={s.scoreCol}>
          <Text style={s.scoreLabel}>Level</Text>
          <Text style={s.scoreNum}>{state.level}</Text>
        </View>
        <View style={s.scoreCol}>
          <Text style={s.scoreLabel}>Lines</Text>
          <Text style={s.scoreNum}>{state.lines}</Text>
        </View>
      </View>

      <View style={s.boardWrap}>
        <View style={s.board}>
          {display.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  style={[
                    s.cell,
                    cell !== 0 && {
                      backgroundColor: pieceHex[cell],
                      borderColor: Colors.brandIvory,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
          {state.paused && (
            <View style={s.overlay}><Text style={s.overlayText}>PAUSED</Text></View>
          )}
          {state.over && (
            <View style={s.overlay}>
              <Text style={s.overlayText}>GAME OVER</Text>
              <Button title="Play again" onPress={() => dispatch({ type: 'reset' })} style={s.againBtn} />
            </View>
          )}
        </View>
      </View>

      {/* Touch controls — present on every device since web users
          might also enjoy tapping a pause button. */}
      <View style={s.controls}>
        <ControlBtn icon="chevron-back" onPress={() => dispatch({ type: 'left' })} />
        <ControlBtn icon="arrow-down" onPress={() => dispatch({ type: 'down' })} />
        <ControlBtn icon="refresh" onPress={() => dispatch({ type: 'rotate' })} />
        <ControlBtn icon="chevron-forward" onPress={() => dispatch({ type: 'right' })} />
        <Pressable
          style={s.dropBtn}
          onPress={() => dispatch({ type: 'drop' })}
          onLongPress={() => dispatch({ type: 'drop' })}
        >
          <Ionicons name="arrow-down-circle" size={22} color={Colors.onPrimary} />
        </Pressable>
      </View>

      <View style={s.metaRow}>
        <TouchableOpacity onPress={() => dispatch({ type: 'pause' })} style={s.metaBtn}>
          <Ionicons name={state.paused ? 'play' : 'pause'} size={14} color={Colors.textSecondary} />
          <Text style={s.metaBtnText}>{state.paused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => dispatch({ type: 'reset' })} style={s.metaBtn}>
          <Ionicons name="reload" size={14} color={Colors.textSecondary} />
          <Text style={s.metaBtnText}>Reset</Text>
        </TouchableOpacity>
        {Platform.OS === 'web' && (
          <Text style={s.metaHint}>
            ← → ↓ to move · ↑ rotate · space drop · P pause
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function ControlBtn({ icon, onPress }: { icon: any; onPress: () => void }) {
  const s = makeStyles();
  return (
    <TouchableOpacity onPress={onPress} style={s.ctrlBtn} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={Colors.textPrimary} />
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, maxWidth: 480, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  title: {
    flex: 1, textAlign: 'center', fontSize: Type.body.size, fontWeight: '900',
    color: Colors.textPrimary, letterSpacing: 6,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },

  scorebar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  scoreCol: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  scoreNum: {
    fontSize: 22, color: Colors.primary, fontWeight: '800', letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },

  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  board: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.primary,
    padding: Spacing.xxs, borderRadius: 4,
    aspectRatio: COLS / ROWS,
    width: '100%', maxWidth: 360,
  },
  row: { flex: 1, flexDirection: 'row' },
  cell: {
    flex: 1, aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    margin: 1, borderRadius: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...(StyleSheet.absoluteFillObject as any),
    alignItems: 'center', justifyContent: 'center',
    // Scrim over live media (the board). Stays a fixed dark wash so the
    // PAUSED / GAME OVER type reads on top of any piece color.
    backgroundColor: 'rgba(10, 10, 15, 0.78)',
    gap: 14,
  },
  // Ink for the scrim above, not for the board. The wash is fixed dark in
  // every skin, so the type has to be the light one.
  overlayText: {
    fontSize: Type.display.size, color: Colors.brandIvory, letterSpacing: 4, fontWeight: '900',
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
  againBtn: { borderRadius: Radius.full },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  ctrlBtn: {
    width: 50, height: Heights.touchTarget, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  dropBtn: {
    width: 60, height: Heights.touchTarget, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  metaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  metaBtnText: { fontSize: Type.eyebrow.size, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  metaHint: { flex: 1, fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'right' },
}); }
