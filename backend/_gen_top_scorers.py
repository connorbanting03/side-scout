#!/usr/bin/env python3
"""One-shot script to generate team_top_scorers.json from existing caches."""
import json
import os
from datetime import datetime, timezone

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')


def load_existing_cache(filepath):
    try:
        if not os.path.isfile(filepath):
            return None
        with open(filepath, 'r') as f:
            payload = json.load(f)
        return payload.get('data')
    except Exception:
        return None


def save_json(filepath, data):
    payload = {
        '_cached_at': datetime.now(tz=timezone.utc).isoformat(),
        '_season': '2025-26',
        'data': data
    }
    with open(filepath, 'w') as f:
        json.dump(payload, f, default=str)
    print(f'  Saved: {filepath}')


rosters_data = load_existing_cache(os.path.join(CACHE_DIR, 'all_rosters.json'))
if not rosters_data:
    print('ERROR: all_rosters.json not found')
    raise SystemExit(1)

all_top_scorers = {}

for team_id_str, roster in rosters_data.items():
    scorers = []
    for player in roster:
        player_id = player.get('id')
        if not player_id:
            continue
        cached = load_existing_cache(
            os.path.join(CACHE_DIR, 'player_games', f'{player_id}.json')
        )
        if not cached:
            continue
        games = cached.get('games', [])
        if not games:
            continue
        n = len(games)
        scorers.append({
            'id': player_id,
            'full_name': player.get('full_name', ''),
            'ppg': round(sum((g.get('PTS', 0) or 0) for g in games) / n, 1),
            'rpg': round(sum((g.get('REB', 0) or 0) for g in games) / n, 1),
            'apg': round(sum((g.get('AST', 0) or 0) for g in games) / n, 1),
            'mpg': round(sum((g.get('MIN', 0) or 0) for g in games) / n, 1),
        })

    scorers.sort(key=lambda x: x['ppg'], reverse=True)
    all_top_scorers[team_id_str] = scorers[:5]
    if scorers:
        print(f'  {team_id_str}: {scorers[0]["full_name"]} {scorers[0]["ppg"]} PPG')
    else:
        print(f'  {team_id_str}: no player data found')

save_json(os.path.join(CACHE_DIR, 'team_top_scorers.json'), all_top_scorers)
print(f'\nDone: {len(all_top_scorers)} teams written to team_top_scorers.json')
