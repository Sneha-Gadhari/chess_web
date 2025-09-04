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

def evaluate_board(board: chess.Board) -> int:
    if board.is_checkmate():
        return 99999 if board.turn == chess.WHITE else -99999
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_fifty_moves():
        return 0

    score = 0
    for pt, val in PIECE_VALUES.items():
        score += val * len(board.pieces(pt, chess.WHITE))
        score -= val * len(board.pieces(pt, chess.BLACK))
    
    if board.turn == chess.BLACK:
        return -score
    else:
        return score

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
        # We need to pass the initial alpha and beta values and whether to maximize for the recursive call
        val = alphabeta(board, depth - 1, -math.inf, math.inf, not maximizing)
        board.pop()

        if maximizing:
            if val > best_val:
                best_val, best_mv = val, mv
        else:
            if val < best_val:
                best_val, best_mv = val, mv
    
    return best_mv