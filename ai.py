import chess
import math

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000
}

psqt = {
    chess.PAWN: [
        0, 0, 0, 0, 0, 0, 0, 0,
        -35, -1, -20, -23, -15, 24, 38, -22,
        -26, -4, -4, -10, 3, 3, 33, -12,
        -27, -2, -5, 12, 17, 6, 10, -25,
        -14, 13, 6, 21, 23, 12, 17, -23,
        -6, 7, 26, 31, 65, 56, 25, -20,
        98, 134, 61, 95, 68, 126, 34, -11,
        0, 0, 0, 0, 0, 0, 0, 0
    ],
    chess.KNIGHT: [
        -105, -21, -58, -33, -17, -28, -19, -23,
        -29, -53, -12, -3, -1, 18, -14, -19,
        -23, -9, 12, 10, 19, 17, 25, -16,
        -13, 4, 16, 13, 28, 19, 21, -8,
        -9, 17, 19, 53, 37, 69, 18, 22,
        -47, 60, 37, 65, 84, 129, 73, 44,
        -73, -41, 72, 36, 23, 62, 7, -17,
        -167, -89, -34, -49, 61, -97, -15, -107
    ],
    chess.BISHOP: [0] * 64,
    chess.ROOK: [0] * 64,
    chess.QUEEN: [0] * 64,
    chess.KING: [0] * 64
}

def evaluate_board(board: chess.Board) -> int:
    if board.is_checkmate():
        return 99999 if board.turn == chess.WHITE else -99999
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_fifty_moves():
        return 0

    score = 0
    for pt, val in PIECE_VALUES.items():
        score += val * len(board.pieces(pt, chess.WHITE))
        score -= val * len(board.pieces(pt, chess.BLACK))
    
    psqt_score = 0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            table = psqt.get(p.piece_type, [0] * 64)
            psqt_val = table[sq] if p.color == chess.WHITE else table[sq ^ 56]
            psqt_score += psqt_val if p.color == chess.WHITE else -psqt_val
    score += psqt_score

    return -score if board.turn == chess.BLACK else score

def order_moves(board: chess.Board, moves):
    def score(m):
        s = 0
        if board.is_capture(m):
            victim = board.piece_at(m.to_square)
            if victim:
                s += PIECE_VALUES.get(victim.piece_type, 0)
        if m.promotion:
            s += 800
        return -s
    return sorted(moves, key=score)

def alphabeta(board: chess.Board, depth: int, alpha: int, beta: int, maximizing: bool) -> int:
    if depth == 0 or board.is_game_over():
        return evaluate_board(board)

    legal_moves = order_moves(board, list(board.legal_moves))
    if maximizing:
        value = -math.inf
        for mv in legal_moves:
            board.push(mv)
            value = max(value, alphabeta(board, depth - 1, alpha, beta, False))
            board.pop()
            alpha = max(alpha, value)
            if alpha >= beta:
                break
        return value
    else:
        value = math.inf
        for mv in legal_moves:
            board.push(mv)
            value = min(value, alphabeta(board, depth - 1, alpha, beta, True))
            board.pop()
            beta = min(beta, value)
            if alpha >= beta:
                break
        return value

def best_move(board: chess.Board, depth: int = 3):
    if board.is_game_over():
        return None
    
    maximizing = board.turn == chess.WHITE
    best_val = -math.inf if maximizing else math.inf
    best_mv = None
    
    legal_moves = order_moves(board, list(board.legal_moves))
    
    for mv in legal_moves:
        board.push(mv)
        val = alphabeta(board, depth - 1, -math.inf, math.inf, not maximizing)
        board.pop()

        if maximizing and val > best_val:
            best_val, best_mv = val, mv
        elif not maximizing and val < best_val:
            best_val, best_mv = val, mv
    
    return best_mv
