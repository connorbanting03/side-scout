#!/usr/bin/env python3
"""
Value Picks Generator for Side Scout
=====================================
Analyzes cached player game logs to find:

1. BEST VALUE PICKS — Players trending above their season average with
   high consistency (low std dev).  These are "hot AND reliable" bets.
   Score = trend_strength × consistency_multiplier

2. MOST CONSISTENT PLAYERS — Lowest coefficient of variation across key
   betting stats over the last 10 games.  The safest, most predictable
   player props to bet on.

Designed to be called from prefetch_cache.py or standalone:
  python generate_value_picks.py
"""

import json
import os
import math
from datetime import datetime

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')

# Minimum games to qualify
MIN_SEASON_GAMES = 20
# How many recent games to evaluate
RECENT_WINDOW = 10
# Key betting stat categories
BETTING_STATS = ['PTS', 'REB', 'AST', 'FG3M', 'STL', 'BLK']
# Minimum averages to qualify for consistency ranking (filter out low-usage players)
MIN_AVG_THRESHOLDS = {'PTS': 10.0, 'REB': 3.0, 'AST': 2.0}


def load_todays_team_ids():
    """Load today's schedule and return the set of team IDs playing tonight."""
    fpath = os.path.join(CACHE_DIR, 'todays_schedule.json')
    try:
        if not os.path.isfile(fpath):
            return set()
        with open(fpath, 'r') as f:
            payload = json.load(f)
        games = payload.get('data', [])
        team_ids = set()
        for game in games:
            home = game.get('homeTeam', {})
            away = game.get('awayTeam', {})
            if home.get('teamId'):
                team_ids.add(int(home['teamId']))
            if away.get('teamId'):
                team_ids.add(int(away['teamId']))
        return team_ids
    except Exception:
        return set()


def load_all_player_games():
    """Load every player's cached game log."""
    player_dir = os.path.join(CACHE_DIR, 'player_games')
    if not os.path.isdir(player_dir):
        return {}

    all_data = {}
    for fname in os.listdir(player_dir):
        if not fname.endswith('.json'):
            continue
        player_id = fname.replace('.json', '')
        fpath = os.path.join(player_dir, fname)
        try:
            with open(fpath, 'r') as f:
                payload = json.load(f)
            data = payload.get('data')
            if data and isinstance(data, dict) and data.get('games'):
                all_data[player_id] = data
        except Exception:
            continue
    return all_data


def load_players_directory():
    """Load player directory for name lookups."""
    fpath = os.path.join(CACHE_DIR, 'players.json')
    try:
        with open(fpath, 'r') as f:
            payload = json.load(f)
        players = payload.get('data', [])
        return {str(p['id']): p for p in players}
    except Exception:
        return {}


def std_dev(values):
    """Population standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


def coefficient_of_variation(values):
    """CV = std_dev / mean.  Lower = more consistent.  Returns inf if mean ~ 0."""
    if len(values) < 2:
        return float('inf')
    mean = sum(values) / len(values)
    if abs(mean) < 0.01:
        return float('inf')
    return std_dev(values) / abs(mean)


def analyze_player(player_id, data, directory):
    """
    Analyze a single player's game log for value + consistency.
    Returns a dict with scoring info or None if player doesn't qualify.
    """
    games = data.get('games', [])
    if len(games) < MIN_SEASON_GAMES:
        return None

    # Recent games (already sorted most-recent-first from the API)
    recent = games[:RECENT_WINDOW]
    baseline_games = games[RECENT_WINDOW:]  # Everything outside the window

    if len(recent) < RECENT_WINDOW or len(baseline_games) < 5:
        return None

    player_info = directory.get(str(player_id), {})
    name = player_info.get('full_name', f'Player {player_id}')
    team = data.get('team', '???')
    team_id = data.get('team_id')

    # ---- Per-stat analysis ----
    stat_analysis = {}
    total_value_score = 0.0
    total_consistency_score = 0.0
    qualifying_stats = 0

    for stat in BETTING_STATS:
        recent_vals = [g.get(stat, 0) or 0 for g in recent]
        baseline_vals = [g.get(stat, 0) or 0 for g in baseline_games]

        recent_avg = sum(recent_vals) / len(recent_vals) if recent_vals else 0
        baseline_avg = sum(baseline_vals) / len(baseline_vals) if baseline_vals else 0
        season_vals = [g.get(stat, 0) or 0 for g in games]
        season_avg = sum(season_vals) / len(season_vals) if season_vals else 0

        recent_std = std_dev(recent_vals)
        cv = coefficient_of_variation(recent_vals)

        # Trend: how much recent exceeds baseline (as absolute diff and pct)
        trend_diff = recent_avg - baseline_avg
        trend_pct = (trend_diff / baseline_avg * 100) if baseline_avg > 0.5 else 0

        stat_analysis[stat] = {
            'recent_avg': round(recent_avg, 1),
            'season_avg': round(season_avg, 1),
            'baseline_avg': round(baseline_avg, 1),
            'trend_diff': round(trend_diff, 1),
            'trend_pct': round(trend_pct, 1),
            'recent_std': round(recent_std, 2),
            'cv': round(cv, 3) if cv != float('inf') else 99.0,
        }

        # Value score for this stat:
        # Positive trend weighted by consistency (low CV = higher multiplier)
        if trend_diff > 0 and cv < 2.0 and recent_avg > 1.0:
            # consistency_multiplier: 1/cv capped, so low CV = big boost
            consistency_mult = min(1.0 / max(cv, 0.1), 5.0)
            stat_value = trend_diff * consistency_mult
            total_value_score += stat_value
            qualifying_stats += 1

        # Consistency score (lower CV = better)
        if recent_avg > 1.0:
            total_consistency_score += cv

    if qualifying_stats == 0:
        consistency_avg = total_consistency_score / len(BETTING_STATS) if total_consistency_score else 99
    else:
        consistency_avg = total_consistency_score / qualifying_stats

    # ---- Combo stats (PRA = PTS + REB + AST) ----
    recent_pra = [
        (g.get('PTS', 0) or 0) + (g.get('REB', 0) or 0) + (g.get('AST', 0) or 0)
        for g in recent
    ]
    season_pra = [
        (g.get('PTS', 0) or 0) + (g.get('REB', 0) or 0) + (g.get('AST', 0) or 0)
        for g in games
    ]
    pra_recent_avg = sum(recent_pra) / len(recent_pra) if recent_pra else 0
    pra_season_avg = sum(season_pra) / len(season_pra) if season_pra else 0
    pra_std = std_dev(recent_pra)
    pra_cv = coefficient_of_variation(recent_pra)

    stat_analysis['PRA'] = {
        'recent_avg': round(pra_recent_avg, 1),
        'season_avg': round(pra_season_avg, 1),
        'baseline_avg': round(sum(season_pra[RECENT_WINDOW:]) / max(len(season_pra[RECENT_WINDOW:]), 1), 1),
        'trend_diff': round(pra_recent_avg - pra_season_avg, 1),
        'trend_pct': round((pra_recent_avg - pra_season_avg) / max(pra_season_avg, 1) * 100, 1),
        'recent_std': round(pra_std, 2),
        'cv': round(pra_cv, 3) if pra_cv != float('inf') else 99.0,
    }

    return {
        'player_id': str(player_id),
        'name': name,
        'team': team,
        'team_id': team_id,
        'total_games': len(games),
        'value_score': round(total_value_score, 2),
        'consistency_avg_cv': round(consistency_avg, 3),
        'stats': stat_analysis,
    }


def find_best_value_picks(analyses, top_n=5):
    """
    Best Value = highest value_score.
    Players trending up across multiple stats with low variance.
    """
    # Filter: must have meaningful minutes & points
    qualified = [
        a for a in analyses
        if a['value_score'] > 0
        and a['stats']['PTS']['recent_avg'] >= MIN_AVG_THRESHOLDS['PTS']
    ]
    qualified.sort(key=lambda x: x['value_score'], reverse=True)
    return qualified[:top_n]


def find_most_consistent(analyses, top_n=5):
    """
    Most Consistent = lowest average CV across PTS, REB, AST.
    Must meet minimum average thresholds so we don't get bench warmers.
    """
    qualified = []
    for a in analyses:
        pts_avg = a['stats']['PTS']['recent_avg']
        reb_avg = a['stats']['REB']['recent_avg']
        ast_avg = a['stats']['AST']['recent_avg']

        if pts_avg < MIN_AVG_THRESHOLDS['PTS']:
            continue
        if reb_avg < MIN_AVG_THRESHOLDS['REB']:
            continue
        if ast_avg < MIN_AVG_THRESHOLDS['AST']:
            continue

        # Average CV across PTS, REB, AST, PRA
        cvs = [
            a['stats']['PTS']['cv'],
            a['stats']['REB']['cv'],
            a['stats']['AST']['cv'],
            a['stats']['PRA']['cv'],
        ]
        cvs = [c for c in cvs if c < 90]  # filter out inf-like values
        if not cvs:
            continue

        avg_cv = sum(cvs) / len(cvs)
        a['consistency_score'] = round(avg_cv, 3)
        qualified.append(a)

    qualified.sort(key=lambda x: x['consistency_score'])
    return qualified[:top_n]


def generate_value_picks():
    """Main entry: crunch all player data, produce value_picks.json."""
    print("\n💎 Generating value picks & consistency rankings...")

    all_data = load_all_player_games()
    directory = load_players_directory()

    print(f"  📂 Loaded {len(all_data)} player game logs")

    analyses = []
    for player_id, data in all_data.items():
        result = analyze_player(player_id, data, directory)
        if result:
            analyses.append(result)

    print(f"  📊 {len(analyses)} players qualified (≥{MIN_SEASON_GAMES} games)")

    # Filter to only players whose team is playing tonight
    todays_teams = load_todays_team_ids()
    if todays_teams:
        tonight_analyses = [
            a for a in analyses
            if a.get('team_id') and int(a['team_id']) in todays_teams
        ]
        print(f"  🏀 {len(tonight_analyses)} players on tonight's {len(todays_teams)//2} games")
    else:
        # No schedule available — fall back to all players
        tonight_analyses = analyses
        print("  ⚠️  No schedule found — using all players")

    best_value = find_best_value_picks(tonight_analyses, top_n=10)
    most_consistent = find_most_consistent(tonight_analyses, top_n=10)

    # Build the output, keeping only the fields the frontend needs
    def slim_pick(pick, rank, category):
        """Trim to essential fields for the frontend."""
        # Find the single best trending stat for the headline
        best_stat = None
        best_trend = 0
        for stat in BETTING_STATS:
            s = pick['stats'].get(stat, {})
            if s.get('trend_pct', 0) > best_trend and s.get('recent_avg', 0) > 1.0:
                best_trend = s['trend_pct']
                best_stat = stat

        return {
            'rank': rank,
            'player_id': pick['player_id'],
            'name': pick['name'],
            'team': pick['team'],
            'total_games': pick['total_games'],
            'category': category,
            'value_score': pick.get('value_score', 0),
            'consistency_score': pick.get('consistency_score', 0),
            'best_trending_stat': best_stat,
            'stats': {
                'PTS': pick['stats']['PTS'],
                'REB': pick['stats']['REB'],
                'AST': pick['stats']['AST'],
                'FG3M': pick['stats']['FG3M'],
                'PRA': pick['stats']['PRA'],
                'STL': pick['stats'].get('STL', {}),
                'BLK': pick['stats'].get('BLK', {}),
            }
        }

    output = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'window': RECENT_WINDOW,
        'min_games': MIN_SEASON_GAMES,
        'best_value': [slim_pick(p, i + 1, 'value') for i, p in enumerate(best_value)],
        'most_consistent': [slim_pick(p, i + 1, 'consistent') for i, p in enumerate(most_consistent)],
    }

    out_path = os.path.join(CACHE_DIR, 'value_picks.json')
    with open(out_path, 'w') as f:
        json.dump({
            '_cached_at': datetime.utcnow().isoformat() + 'Z',
            'data': output
        }, f, default=str)

    print(f"  ✅ Saved: {out_path}")
    print(f"  🔥 Best Value: {', '.join(p['name'] for p in best_value)}")
    print(f"  🎯 Most Consistent: {', '.join(p['name'] for p in most_consistent)}")

    return output


if __name__ == '__main__':
    generate_value_picks()
