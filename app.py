from flask import Flask, render_template, request, jsonify
import chess
from ai import best_move

app = Flask(__name__)
board = chess.Board()
AI_DEPTH = 3

def board_to_dict(board):
    """Return board as dictionary {square: piece_symbol}"""
    d = {}
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            d[sq] = p.symbol()
    return d

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/move", methods=["POST"])
def move():
    global board
    data = request.get_json()
    from_sq = data.get("from")
    to_sq = data.get("to")
    
    # Create the move object
    move = chess.Move(from_sq, to_sq)
    
    # Auto-promotion logic for pawns reaching the last rank
    piece = board.piece_at(from_sq)
    if piece and piece.piece_type == chess.PAWN:
        rank = chess.square_rank(to_sq)
        if (piece.color == chess.WHITE and rank == 7) or \
           (piece.color == chess.BLACK and rank == 0):
            move = chess.Move(from_sq, to_sq, promotion=chess.QUEEN)
    
    if move in board.legal_moves:
        board.push(move)
        
        # AI move
        if not board.is_game_over():
            ai_mv = best_move(board, depth=AI_DEPTH)
            if ai_mv:
                board.push(ai_mv)
        
        return jsonify({"board": board_to_dict(board), "status": board_status()})
    else:
        return jsonify({"error": "Illegal move"}), 400

@app.route("/reset", methods=["POST"])
def reset():
    global board
    board.reset()
    return jsonify({"board": board_to_dict(board), "status": board_status()})

@app.route("/undo", methods=["POST"])
def undo():
    global board
    if board.move_stack:
        board.pop()
    if board.move_stack:
        board.pop()
    return jsonify({"board": board_to_dict(board), "status": board_status()})

def board_status():
    if board.is_checkmate():
        return "Checkmate!"
    elif board.is_stalemate():
        return "Stalemate"
    elif board.is_check():
        return "Check!"
    else:
        return "White to move" if board.turn == chess.WHITE else "Black to move"

if __name__ == "__main__":
    app.run(debug=True)