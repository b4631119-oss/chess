/**
 * The worker wire protocol is plain UCI text (plus one out-of-band error line),
 * so the same client code drives Stockfish and the built-in engine.
 */

/** Posted by a host worker when the underlying engine could not start. */
export const ENGINE_ERROR_PREFIX = 'engineerror';

/** Sent to a worker to stop a search; a UCI engine answers with `bestmove`. */
export const UCI_QUIT = 'quit';
