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
    try:
        piece = board.piece_at(move.from_square)
        if piece:
            piece_name = chess.PIECE_NAMES[piece.piece_type].capitalize()
            color = "White" if piece.color == chess.WHITE else "Black"
            from_name = chess.square_name(move.from_square)
            to_name = chess.square_name(move.to_square)
            return f"{color} {piece_name} from {from_name} to {to_name}"
        return ""
    except Exception as e:
        logger.error(f"Error in get_move_str: {e}")
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
        logger.warning("Missing from or to square")
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
        logger.debug("Player move: %s", player_move_str)
        ai_move_str = ""
        if not board.is_game_over():
            try:
                ai_mv = best_move(board, depth=AI_DEPTH)
                if ai_mv:
                    ai_move_str = get_move_str(ai_mv)
                    board.push(ai_mv)
                    logger.debug("AI move: %s", ai_move_str)
                else:
                    logger.error("AI returned no move")
                    return jsonify({"error": "AI failed to make a move"}), 500
            except Exception as e:
                logger.error("AI move error: %s", e)
                return jsonify({"error": f"AI move error: {str(e)}"}), 500
        return jsonify({
            "board": board_to_dict(board),
            "status": board_status(),
            "player_move": player_move_str,
            "ai_move": ai_move_str
        })
    logger.warning("Illegal move attempted: %s", move.uci())
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
    try:
        board.reset()
        logger.debug("Board reset")
        return jsonify({"board": board_to_dict(board), "status": board_status(), "player_move": "", "ai_move": ""})
    except Exception as e:
        logger.error("Reset error: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route("/undo", methods=["POST"])
def undo():
    global board
    try:
        if not board.move_stack:
            logger.debug("No moves to undo")
            return jsonify({"error": "No moves to undo"}), 400
        board.pop()  # Undo AI move
        if board.move_stack:
            board.pop()  # Undo player move
        logger.debug("Undo successful, status: %s", board_status())
        return jsonify({"board": board_to_dict(board), "status": board_status(), "player_move": "", "ai_move": ""})
    except Exception as e:
        logger.error("Undo error: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route("/legal_moves", methods=["POST"])
def legal_moves():
    try:
        data = request.get_json()
        from_sq = data.get("from")
        if from_sq is None:
            logger.warning("Missing from square")
            return jsonify({"error": "Missing from square"}), 400
        moves = [m.to_square for m in board.legal_moves if m.from_square == from_sq]
        logger.debug("Legal moves for %s: %s", from_sq, moves)
        return jsonify({"moves": moves})
    except Exception as e:
        logger.error("Legal moves error: %s", e)
        return jsonify({"error": str(e)}), 500

def board_status():
    if board.is_checkmate():
        return "Checkmate!"
    elif board.is_stalemate():
        return "Stalemate"
    elif board.is_check():
        return "Check!"
    elif board.is_insufficient_material():
        return "Insufficient material: Draw"
    elif board.can_claim_threefold_repetition():
        return "Threefold repetition: Draw"
    elif board.can_claim_fifty_moves():
        return "Fifty-move rule: Draw"
    return "White to move" if board.turn == chess.WHITE else "Black to move"

if __name__ == "__main__":
    app.run(debug=True)
