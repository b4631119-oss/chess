import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, TouchEvent as ReactTouchEvent } from 'react';
import { squareName, type Piece, type Square as SquareIndex } from '@chess/chess-core';
import { pieceImage } from '../game/pieceImages';

interface SquareProps {
  square: SquareIndex;
  piece: Piece | null;
  dark: boolean;
  selected: boolean;
  legalTarget: boolean;
  captureTarget: boolean;
  lastMove: boolean;
  /** True when a human may move the piece on this square. */
  draggable: boolean;
  /** False while the engine controls the side to move. */
  interactive: boolean;
  onSelect: (square: SquareIndex) => void;
  onMove: (from: SquareIndex, to: SquareIndex) => void;
}

/** A finger that travels less than this is a tap; anything further is a drag. */
const TAP_SLOP_PX = 10;

/**
 * Browsers dispatch a compatibility `click` after every touch sequence, aimed
 * at whatever element the finger ended over — so it cannot be filtered per
 * square. A timestamp of the last gesture we handled ourselves is the reliable
 * way to drop the double event, and it can never go stale the way a boolean
 * flag would if the browser suppressed the click instead.
 */
const COMPATIBILITY_CLICK_WINDOW_MS = 500;
let lastTouchHandledAt = 0;

const FILE_NAMES = 'abcdefgh';

/** `'e4'` -> 28, or null when the string is not a board square. */
function squareFromName(name: string | undefined): SquareIndex | null {
  if (name === undefined) return null;
  const file = FILE_NAMES.indexOf(name.charAt(0));
  const rank = Number.parseInt(name.slice(1), 10) - 1;
  if (file < 0 || !Number.isInteger(rank) || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}

/** The cell under a viewport point, which need not be the square owning the touch. */
function cellUnderPoint(x: number, y: number): HTMLElement | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-square]') ?? null;
}

function squareUnderPoint(x: number, y: number): SquareIndex | null {
  return squareFromName(cellUnderPoint(x, y)?.dataset.square);
}

interface TouchGesture {
  /** Where the finger landed, in client coordinates. */
  x: number;
  y: number;
  /** Rendered piece size, captured so the drag ghost matches the board. */
  size: number;
  /** `tap` until the finger passes the threshold, then `drag` or `scroll`. */
  mode: 'tap' | 'drag' | 'scroll';
  /** True when touchstart already selected this square (it held a movable piece). */
  selectedOnStart: boolean;
}

interface DragGhost {
  x: number;
  y: number;
  size: number;
}

export function Square({
  square,
  piece,
  dark,
  selected,
  legalTarget,
  captureTarget,
  lastMove,
  draggable,
  interactive,
  onSelect,
  onMove,
}: SquareProps) {
  const classes = ['cell', dark ? 'black' : 'white'];
  if (selected) classes.push('selected');
  if (captureTarget) classes.push('capture');
  if (lastMove) classes.push('last-move');

  const canDrag = interactive && draggable;

  const cellRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<TouchGesture | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  /**
   * The drop-target ring is toggled straight on the DOM: routing it through
   * React state would re-render all 64 squares on every touchmove.
   */
  const highlight = useCallback((element: HTMLElement | null): void => {
    if (highlightRef.current === element) return;
    highlightRef.current?.classList.remove('touch-target');
    element?.classList.add('touch-target');
    highlightRef.current = element;
  }, []);

  /**
   * React registers `touchmove` passively, so `preventDefault` inside
   * onTouchMove is ignored (the browser also logs an intervention warning).
   * A native, non-passive listener is the only way to really stop the page
   * scrolling — and it has to be in place *before* the finger lands: the
   * browser decides whether a touch sequence is cancelable at touchstart, so
   * registering it from the handler is too late for preventDefault to count.
   * The handler reads the gesture from a ref, so it needs no re-subscribing.
   */
  useEffect(() => {
    const element = cellRef.current;
    if (element === null || !canDrag) return;
    const blockScroll = (event: TouchEvent): void => {
      if (gestureRef.current?.mode === 'drag') event.preventDefault();
    };
    element.addEventListener('touchmove', blockScroll, { passive: false });
    return () => element.removeEventListener('touchmove', blockScroll);
  }, [canDrag]);

  const handleDragStart = (event: DragEvent<HTMLDivElement>): void => {
    if (!canDrag || piece === null) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', String(square));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    event.preventDefault();
    const from = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
    if (Number.isInteger(from) && from >= 0 && from < 64 && from !== square) {
      onMove(from, square);
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    const touch = event.touches.item(0);
    if (touch === null) return;

    const image = event.currentTarget.querySelector('img');
    const ownPiece = canDrag && piece !== null;

    gestureRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      size: image === null ? event.currentTarget.clientWidth : image.clientWidth,
      mode: 'tap',
      selectedOnStart: ownPiece,
    };

    // A tap on an empty square or an opponent's piece resolves on touchend.
    if (!ownPiece) return;

    // Touching your own piece selects it, exactly like a mouse click would.
    onSelect(square);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;
    if (gesture === null || gesture.mode === 'scroll') return;
    const touch = event.touches.item(0);
    if (touch === null) return;

    if (gesture.mode === 'tap') {
      const travelled = Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y);
      if (travelled < TAP_SLOP_PX) return;
      if (!gesture.selectedOnStart) {
        // Not our piece, so the finger is panning the page: stop interfering.
        gesture.mode = 'scroll';
        return;
      }
      gesture.mode = 'drag';
    }

    // Scrolling is prevented by the non-passive listener installed on mount.
    highlight(cellUnderPoint(touch.clientX, touch.clientY));
    setGhost({ x: touch.clientX, y: touch.clientY, size: gesture.size });
  };

  /** Tears the gesture down and reports it, so a stale one can never linger. */
  const finishTouch = (): TouchGesture | null => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    highlight(null);
    setGhost(null);
    lastTouchHandledAt = Date.now();
    return gesture;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>): void => {
    const gesture = finishTouch();
    if (gesture === null || !interactive || gesture.mode === 'scroll') return;
    const touch = event.changedTouches.item(0);
    if (touch === null) return;

    const target = squareUnderPoint(touch.clientX, touch.clientY);
    if (target === null) return;

    if (gesture.mode === 'drag') {
      if (target !== square) onMove(square, target);
      return;
    }

    // A tap: touchstart already covered this square when it held a movable
    // piece, otherwise the tap means the same as a click on that square.
    if (gesture.selectedOnStart && target === square) return;
    onSelect(target);
  };

  const handleTouchCancel = (): void => {
    finishTouch();
  };

  const handleClick = (): void => {
    if (!interactive) return;
    // Swallow the compatibility click that follows a touch sequence: the touch
    // handlers above already performed the action.
    if (Date.now() - lastTouchHandledAt < COMPATIBILITY_CLICK_WINDOW_MS) return;
    onSelect(square);
  };

  return (
    <div
      ref={cellRef}
      className={classes.join(' ')}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      draggable={canDrag}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={squareName(square)}
      data-square={squareName(square)}
    >
      {legalTarget && piece === null && <div className="available" />}
      {piece !== null && (
        <img
          className={ghost === null ? undefined : 'is-dragging'}
          src={pieceImage(piece)}
          alt={`${piece.color} ${piece.type}`}
          draggable={false}
        />
      )}
      {ghost !== null && piece !== null && (
        <img
          className="drag-ghost"
          src={pieceImage(piece)}
          alt=""
          draggable={false}
          style={{ left: ghost.x, top: ghost.y, width: ghost.size, height: ghost.size }}
        />
      )}
    </div>
  );
}
