"""
Flask server — Rummikub AI API
Run from the project root:  python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ai.algorithm import find_best_play, place_sets_on_board

app = Flask(__name__)
CORS(app)   # allow requests from file:// and any localhost origin


@app.route('/computer-turn', methods=['POST'])
def computer_turn():
    """
    POST  /computer-turn
    Body: { "hand": [[color, num], ...], "boardCards": [[color, num], ...] }
    Response: { "sets": [...], "remainingHand": [...], "board": <5×22 grid> }
    """
    data        = request.get_json(force=True)
    hand        = [list(c) for c in data.get('hand', [])]
    board_cards = [list(c) for c in data.get('boardCards', [])]

    result = find_best_play(hand, board_cards)
    board  = place_sets_on_board(result['sets']) if result['sets'] else None

    return jsonify({
        'sets':          result['sets'],
        'remainingHand': result['remaining_hand'],
        'board':         board
    })


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})
