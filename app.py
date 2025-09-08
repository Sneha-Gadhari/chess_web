from flask import Flask, render_template, request, jsonify
import chess
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
board = chess.Board()
difficulty_depth = {'easy': 1, 'medium': 3, 'hard': 5}
AI_DEPTH = 3

def board_to_dict(board):
    d = {}
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            d[sq] = p.symbol()
    return d

def get_move_str(move):
    piece = board.piece_at(move.from_square)
    if piece:
        piece_name = chess.PIECE_NAMES[piece.piece_type].capitalize()
        color = "White" if piece.color == chess.WHITE else "Black"
        from_name = chess.square_name(move.from_square)
        to_name = chess.square_name(move.to_square)
        return f"{color} {piece_name} from {from_name} to {to_name}"
    return ""

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/move", methods=["POST"])
def move():
    global board
    from ai import best_move
    data = request.get_json()
    from_sq = data.get("from")
    to_sq = data.get("to")
    
    if from_sq is None or to_sq is None:
        return jsonify({"error": "Missing from or to square"}), 400
    
    move = chess.Move(from_sq, to_sq)
    piece = board.piece_at(from_sq)
    if piece and piece.piece_type == chess.PAWN:
        rank = chess.square_rank(to_sq)
        if (piece.color == chess.WHITE and rank == 7) or (piece.color == chess.BLACK and rank == 0):
            move = chess.Move(from_sq, to_sq, promotion=chess.QUEEN)
    
    if move in board.legal_moves:
        player_move_str = get_move_str(move)
        board.push(move)
        ai_move_str = ""
        if not board.is_game_over():
            ai_mv = best_move(board, depth=AI_DEPTH)
            if ai_mv:
                ai_move_str = get_move_str(ai_mv)
                board.push(ai_mv)
        return jsonify({"board": board_to_dict(board), "status": board_status(), "player_move": player_move_str, "ai_move": ai_move_str})
    return jsonify({"error": "Illegal move"}), 400

@app.route("/start", methods=["POST"])
def start():
    global board, AI_DEPTH
    try:
        data = request.get_json()
        logger.debug("Received start data: %s", data)
        diff = data.get("difficulty", "medium")
        AI_DEPTH = difficulty_depth.get(diff, 3)
        logger.debug("Setting AI depth to: %d", AI_DEPTH)
        board.reset()
        response = {"board": board_to_dict(board), "status": board_status(), "player_move": "", "ai_move": ""}
        logger.debug("Start response: %s", response)
        return jsonify(response)
    except Exception as e:
        logger.error("Start route error: %s", str(e))
        return jsonify({"error": "Failed to start game", "details": str(e)}), 500

@app.route("/reset", methods=["POST"])
def reset():
    global board
    board.reset()
    return jsonify({"board": board_to_dict(board), "status": board_status(), "player_move": "", "ai_move": ""})

@app.route("/undo", methods=["POST"])
def undo():
    global board
    if board.move_stack:
        board.pop()
    if board.move_stack:
        board.pop()
    return jsonify({"board": board_to_dict(board), "status": board_status(), "player_move": "", "ai_move": ""})

@app.route("/legal_moves", methods=["POST"])
def legal_moves():
    data = request.get_json()
    from_sq = data.get("from")
    if from_sq is None:
        return jsonify({"error": "Missing from square"}), 400
    moves = [m.to_square for m in board.legal_moves if m.from_square == from_sq]
    return jsonify({"moves": moves})

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
