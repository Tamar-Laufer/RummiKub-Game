"""
Rummikub — single entry point.
Runs the Flask server that serves BOTH the website files AND the AI API.

Usage:
    python app.py

Then open:  http://localhost:5000
"""

import sys, os
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from ai.algorithm import find_best_play, place_sets_on_board

app = Flask(__name__)
CORS(app)

# ── Static file routes ────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(os.path.join(ROOT, 'html'), 'contat.html')

@app.route('/html/<path:filename>')
def html_files(filename):
    return send_from_directory(os.path.join(ROOT, 'html'), filename)

@app.route('/css/<path:filename>')
def css_files(filename):
    return send_from_directory(os.path.join(ROOT, 'css'), filename)

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory(os.path.join(ROOT, 'js'), filename)

@app.route('/images/<path:filename>')
def image_files(filename):
    return send_from_directory(os.path.join(ROOT, 'images'), filename)

# ── AI API ────────────────────────────────────────────────────────────────────

@app.route('/computer-turn', methods=['POST'])
def computer_turn():
    data        = request.get_json(force=True)
    hand        = [list(c) for c in data.get('hand', [])        if c[0] != 'joker']
    board_cards = [list(c) for c in data.get('boardCards', [])  if c[0] != 'joker']

    result = find_best_play(hand, board_cards)
    board  = place_sets_on_board(result['sets']) if result['sets'] else None

    return jsonify({
        'sets':          result['sets'],
        'remainingHand': result['remaining_hand'],
        'board':         board
    })

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("\n" + "="*48)
    print("  Rummikub server starting...")
    print("  Open:  http://localhost:5000")
    print("="*48 + "\n")
    app.run(debug=True, port=5000)
