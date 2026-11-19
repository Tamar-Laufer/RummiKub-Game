"""
Combined Matrix + Greedy Algorithm — Python version
=====================================================
Mirrors the logic in js/game-algorithm.js.

Card format: [color, number]   e.g. ['red', 7]
Colors: 'red', 'black', 'blue', 'orange'
Numbers: 1–13
"""

from typing import List, Dict

Card   = List          # [color, number]
COLORS = ['red', 'black', 'blue', 'orange']


# ─── Frequency matrix ─────────────────────────────────────────────────────────

def build_freq(cards: List[Card]) -> List[List[int]]:
    """Return a 4×13 frequency matrix: freq[color_idx][num-1] = count."""
    freq = [[0] * 13 for _ in range(4)]
    for color, num in cards:
        freq[COLORS.index(color)][num - 1] += 1
    return freq


# ─── Extract groups (קבוצות): same number, 3–4 different colors ───────────────

def extract_groups(freq: List[List[int]], sets: list) -> None:
    for ni in range(13):
        available = [ci for ci in range(4) if freq[ci][ni] > 0]
        if len(available) >= 3:
            chosen = available[:min(4, len(available))]
            sets.append([[COLORS[ci], ni + 1] for ci in chosen])
            for ci in chosen:
                freq[ci][ni] -= 1


# ─── Extract runs (רצפים): same color, consecutive numbers ≥ 3 ───────────────

def extract_runs(freq: List[List[int]], sets: list) -> None:
    for ci in range(4):
        run = []
        for ni in range(14):          # ni=13 is a sentinel to flush the last run
            if ni < 13 and freq[ci][ni] > 0:
                run.append(ni)
                freq[ci][ni] -= 1
            else:
                if len(run) >= 3:
                    sets.append([[COLORS[ci], ni_val + 1] for ni_val in run])
                else:
                    for ni_val in run:
                        freq[ci][ni_val] += 1   # return short run to pool
                run = []


# ─── Try one extraction order ─────────────────────────────────────────────────

def try_order(freq_orig: List[List[int]], order: str) -> list:
    freq = [row[:] for row in freq_orig]   # deep copy
    sets: list = []
    if order == 'groups':
        extract_groups(freq, sets)
        extract_runs(freq, sets)
    else:
        extract_runs(freq, sets)
        extract_groups(freq, sets)
    return sets


# ─── Count how many HAND cards are consumed by a set of results ───────────────

def count_hand_used(hand: List[Card], board_cards: List[Card], sets: list) -> int:
    used_freq  = [[0] * 13 for _ in range(4)]
    board_freq = [[0] * 13 for _ in range(4)]

    for s in sets:
        for color, num in s:
            used_freq[COLORS.index(color)][num - 1] += 1

    for color, num in board_cards:
        board_freq[COLORS.index(color)][num - 1] += 1

    return sum(
        max(0, used_freq[ci][ni] - board_freq[ci][ni])
        for ci in range(4)
        for ni in range(13)
    )


# ─── Compute remaining hand after sets are placed ────────────────────────────

def compute_remaining_hand(
    hand: List[Card],
    board_cards: List[Card],
    sets: list
) -> List[Card]:
    used_freq  = [[0] * 13 for _ in range(4)]
    board_freq = [[0] * 13 for _ in range(4)]

    for s in sets:
        for color, num in s:
            used_freq[COLORS.index(color)][num - 1] += 1

    for color, num in board_cards:
        board_freq[COLORS.index(color)][num - 1] += 1

    # Hand cards consumed = max(0, total used − board supplied)
    hand_used = [
        [max(0, used_freq[ci][ni] - board_freq[ci][ni]) for ni in range(13)]
        for ci in range(4)
    ]

    remaining = []
    for card in hand:
        ci, ni = COLORS.index(card[0]), card[1] - 1
        if hand_used[ci][ni] > 0:
            hand_used[ci][ni] -= 1
        else:
            remaining.append(card)
    return remaining


# ─── Verify all board cards are present in the result sets ───────────────────

def all_board_cards_present(board_cards: List[Card], sets: list) -> bool:
    """The computer may rearrange board tiles but NEVER remove them."""
    needed: dict = {}
    for color, num in board_cards:
        key = f"{color}-{num}"
        needed[key] = needed.get(key, 0) + 1

    have: dict = {}
    for s in sets:
        for color, num in s:
            key = f"{color}-{num}"
            have[key] = have.get(key, 0) + 1

    return all(have.get(key, 0) >= count for key, count in needed.items())


# ─── Main entry point ─────────────────────────────────────────────────────────

def find_best_play(hand: List[Card], board_cards: List[Card]) -> Dict:
    """
    Find the best sets the computer can play.

    Tries groups-first and runs-first, picks whichever uses more hand cards.
    Rejects any result that removes board tiles.

    Returns:
      {
        'sets':           list of valid sets to place on the board,
        'remaining_hand': hand cards not used
      }
    """
    freq = build_freq(list(hand) + list(board_cards))

    sets_g = try_order(freq, 'groups')
    sets_r = try_order(freq, 'runs')

    used_g = count_hand_used(hand, board_cards, sets_g)
    used_r = count_hand_used(hand, board_cards, sets_r)

    # Valid = preserves all board cards AND plays at least 1 hand card
    valid_g = used_g > 0 and all_board_cards_present(board_cards, sets_g)
    valid_r = used_r > 0 and all_board_cards_present(board_cards, sets_r)

    if valid_g and valid_r:
        best_sets = sets_g if used_g >= used_r else sets_r
    elif valid_g:
        best_sets = sets_g
    elif valid_r:
        best_sets = sets_r
    else:
        # Cannot play a valid move — draw instead
        return {'sets': [], 'remaining_hand': list(hand)}

    remaining = compute_remaining_hand(hand, board_cards, best_sets)
    return {'sets': best_sets, 'remaining_hand': remaining}


# ─── Place sets onto a 5×22 board ────────────────────────────────────────────

def place_sets_on_board(
    sets: list, rows: int = 5, cols: int = 22
) -> List[List]:
    board = [[None] * cols for _ in range(rows)]
    r, c = 0, 0
    for s in sets:
        if c + len(s) > cols:
            r += 1
            c = 0
        if r >= rows:
            break
        for card in s:
            board[r][c] = card
            c += 1
        c += 1   # gap between sets
    return board


# ─── Demo ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import random

    deck = [[color, num] for color in COLORS for _ in range(2) for num in range(1, 14)]
    random.shuffle(deck)

    hand        = deck[:14]
    board_cards = []

    print('Hand:', sorted(hand, key=lambda c: (c[0], c[1])))

    result = find_best_play(hand, board_cards)

    print(f'\nPlayed {len(hand) - len(result["remaining_hand"])} card(s):')
    for s in result['sets']:
        kind = 'group' if len({c[0] for c in s}) > 1 and len({c[1] for c in s}) == 1 else 'run'
        print(f'  {kind}: {s}')

    print(f'\nRemaining hand ({len(result["remaining_hand"])}): {result["remaining_hand"]}')
