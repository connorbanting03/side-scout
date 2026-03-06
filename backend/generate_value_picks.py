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
from datetime import datetime, timezone

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')

# Minimum games to qualify
MIN_SEASON_GAMES = 20
# Game windows to precompute (mirrors the "Last X games" selector in the UI)
WINDOWS = [5, 10, 15, 20]
# Key betting stat categories
BETTING_STATS = ['PTS', 'REB', 'AST', 'FG3M', 'STL', 'BLK']
# Minimum averages to qualify for consistency ranking (filter out low-usage players)
MIN_AVG_THRESHOLDS = {'PTS': 10.0, 'REB': 3.0, 'AST': 2.0}


def load_todays_team_ids():
    """Load today's schedule and return the set of team IDs with games TODAY (ET).
    First tries the cached schedule file, then falls back to ScoreboardV2
    (stats.nba.com) which accepts an explicit date and is always pre-populated.
    Skips completed (Final) games."""
    try:
        from zoneinfo import ZoneInfo
        _et = ZoneInfo('America/New_York')
    except ImportError:
        import pytz
        _et = pytz.timezone('America/New_York')
    today_et = datetime.now(_et).strftime('%Y-%m-%d')

    def extract_team_ids(games):
        """From a list of game dicts, extract team IDs for today's non-final games."""
        ids = set()
        for game in games:
            game_date = (game.get('gameEt', '') or game.get('gameTimeUTC', ''))[:10]
            if game_date and game_date != today_et:
                continue
            if game.get('status', 1) == 3:
                continue
            home = game.get('homeTeam', {})
            away = game.get('awayTeam', {})
            if home.get('teamId'):
                ids.add(int(home['teamId']))
            if away.get('teamId'):
                ids.add(int(away['teamId']))
        return ids

    # Try 1: Read from the prefetched cache file
    fpath = os.path.join(CACHE_DIR, 'todays_schedule.json')
    try:
        if os.path.isfile(fpath):
            with open(fpath, 'r') as f:
                payload = json.load(f)
            games = payload.get('data', [])
            ids = extract_team_ids(games)
            if ids:
                return ids
    except Exception:
        pass

    # Try 2: ScoreboardV2 (stats.nba.com) — always pre-populated for today
    try:
        from nba_api.stats.endpoints import scoreboardv2
        import warnings
        today_fmt = datetime.now(_et).strftime('%m/%d/%Y')
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', DeprecationWarning)
            sb = scoreboardv2.ScoreboardV2(game_date=today_fmt, day_offset=0)
        dfs = sb.get_data_frames()
        game_header = dfs[0]
        ids = set()
        for _, row in game_header.iterrows():
            status = int(row.get('GAME_STATUS_ID', 1))
            if status == 3:
                continue  # skip Final games
            ids.add(int(row['HOME_TEAM_ID']))
            ids.add(int(row['VISITOR_TEAM_ID']))
        if ids:
            print(f"  📡 Got {len(ids)//2} games from ScoreboardV2")
        return ids
    except Exception as e:
        print(f"  ⚠️  ScoreboardV2 unavailable: {e}")
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


def analyze_player(player_id, data, directory, window=10):
    """
    Analyze a single player's game log for value + consistency.
    window=N  -> recent N games vs rest of season (trend-based scoring)
    window=0  -> season mode: all games, volume x consistency scoring
    Returns a dict with scoring info or None if player doesn't qualify.
    """
    games = data.get('games', [])
    if len(games) < MIN_SEASON_GAMES:
        return None

    season_mode = (window == 0 or window >= len(games))
    if season_mode:
        recent = games
        baseline_games = []
    else:
        recent = games[:window]
        baseline_games = games[window:]
        if len(recent) < window or len(baseline_games) < 5:
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
        season_vals = [g.get(stat, 0) or 0 for g in games]

        recent_avg = sum(recent_vals) / len(recent_vals) if recent_vals else 0
        baseline_avg = sum(baseline_vals) / len(baseline_vals) if baseline_vals else 0
        season_avg = sum(season_vals) / len(season_vals) if season_vals else 0

        recent_std = std_dev(recent_vals)
        cv = coefficient_of_variation(recent_vals)

        # Trend vs baseline (zero in season mode — no baseline to compare against)
        if season_mode:
            trend_diff = 0.0
            trend_pct = 0.0
        else:
            trend_diff = recent_avg - baseline_avg
            trend_pct = (trend_diff / baseline_avg * 100) if baseline_avg > 0.5 else 0.0

        stat_analysis[stat] = {
            'recent_avg': round(recent_avg, 1),
            'season_avg': round(season_avg, 1),
            'baseline_avg': round(baseline_avg, 1),
            'trend_diff': round(trend_diff, 1),
            'trend_pct': round(trend_pct, 1),
            'recent_std': round(recent_std, 2),
            'cv': round(cv, 3) if cv != float('inf') else 99.0,
        }

        # Value score: trend x consistency for windowed; volume x consistency for season
        if cv < 2.0 and recent_avg > 1.0:
            consistency_mult = min(1.0 / max(cv, 0.1), 5.0)
            if season_mode:
                # Season: reward high volume + consistency (no trend available)
                total_value_score += recent_avg * consistency_mult
                qualifying_stats += 1
            elif trend_diff > 0:
                # Windowed: reward trending up x consistency
                total_value_score += trend_diff * consistency_mult
                qualifying_stats += 1

        # Accumulate CV for consistency ranking
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

    if season_mode:
        pra_baseline_avg = pra_season_avg
        pra_trend_diff = 0.0
        pra_trend_pct = 0.0
    else:
        baseline_pra = [
            (g.get('PTS', 0) or 0) + (g.get('REB', 0) or 0) + (g.get('AST', 0) or 0)
            for g in baseline_games
        ]
        pra_baseline_avg = sum(baseline_pra) / len(baseline_pra) if baseline_pra else 0
        pra_trend_diff = pra_recent_avg - pra_baseline_avg
        pra_trend_pct = (pra_trend_diff / pra_baseline_avg * 100) if pra_baseline_avg > 0.5 else 0.0

    stat_analysis['PRA'] = {
        'recent_avg': round(pra_recent_avg, 1),
        'season_avg': round(pra_season_avg, 1),
        'baseline_avg': round(pra_baseline_avg, 1),
        'trend_diff': round(pra_trend_diff, 1),
        'trend_pct': round(pra_trend_pct, 1),
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


def find_best_value_picks(analyses, top_n=12, is_season=False):
    """
    Best Value = highest value_score.
    Players trending up across multiple stats with low variance.
    In windowed mode: excludes players where every stat has 0.0% trend (injured/inactive).
    In season mode: trend is always 0 by design, so skip that check.
    """
    def has_real_trend(a):
        """True if at least one betting stat has a non-zero trend."""
        return any(
            a['stats'][s]['trend_pct'] != 0.0 or a['stats'][s]['trend_diff'] != 0.0
            for s in BETTING_STATS
            if s in a['stats']
        )

    qualified = [
        a for a in analyses
        if a['value_score'] > 0
        and a['stats']['PTS']['recent_avg'] >= MIN_AVG_THRESHOLDS['PTS']
        and (is_season or has_real_trend(a))
    ]
    qualified.sort(key=lambda x: x['value_score'], reverse=True)
    return qualified[:top_n]


def find_most_consistent(analyses, top_n=12, is_season=False):
    """
    Most Consistent = lowest average CV across PTS, REB, AST.
    Must meet minimum average thresholds so we don't get bench warmers.
    In windowed mode: excludes players where every stat has 0.0% trend (injured/inactive).
    In season mode: trend is always 0 by design, so skip that check.
    """
    def has_real_trend(a):
        return any(
            a['stats'][s]['trend_pct'] != 0.0 or a['stats'][s]['trend_diff'] != 0.0
            for s in BETTING_STATS
            if s in a['stats']
        )

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
        if not is_season and not has_real_trend(a):
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
    """Main entry: crunch all player data, produce value_picks.json.
    Computes picks for each game window (5, 10, 15, 20) and full season,
    all filtered to players on tonight's schedule."""
    print("\n💎 Generating value picks & consistency rankings...")

    all_data = load_all_player_games()
    directory = load_players_directory()

    print(f"  📂 Loaded {len(all_data)} player game logs")

    # Load tonight's team IDs for filtering
    todays_teams = load_todays_team_ids()
    if todays_teams:
        print(f"  🗓️  Tonight: {len(todays_teams) // 2} games")
    else:
        print("  ⚠️  No schedule found — using all players")

    # Load injury report (generated by prefetch_injuries)
    injured_out = set()   # player names (lower) confirmed Out or Suspended
    injured_dtd = set()   # player names (lower) Day-To-Day — kept but flagged
    try:
        inj_path = os.path.join(CACHE_DIR, 'injuries.json')
        if os.path.isfile(inj_path):
            with open(inj_path, 'r') as f:
                inj_payload = json.load(f)
            inj_data = inj_payload.get('data', {})
            for name_lower, info in inj_data.items():
                status = info.get('status', '')
                if status in ('Out', 'Suspension'):
                    injured_out.add(name_lower)
                elif status == 'Day-To-Day':
                    injured_dtd.add(name_lower)
            print(f"  \U0001f3e5 Injuries loaded: {len(injured_out)} Out, {len(injured_dtd)} Day-To-Day")
    except Exception as e:
        print(f"  \u26a0\ufe0f  Could not load injuries: {e}")

    def filter_tonight(analyses):
        """Keep only players on tonight's teams (or all if no schedule).
        Also removes players confirmed Out or Suspended.
        Attaches injury_status field for Day-To-Day players."""
        result = []
        for a in analyses:
            name_lower = a.get('name', '').lower()
            # Hard-exclude: Out / Suspension
            if name_lower in injured_out:
                continue
            # Tonight filter
            if todays_teams and (not a.get('team_id') or int(a['team_id']) not in todays_teams):
                continue
            # Tag Day-To-Day players so the frontend can show a badge
            if name_lower in injured_dtd:
                a['injury_status'] = 'DTD'
            result.append(a)
        return result

    STAT_LABELS = {
        'PTS': 'Points', 'REB': 'Rebounds', 'AST': 'Assists',
        'FG3M': '3-Pointers Made', 'STL': 'Steals', 'BLK': 'Blocks', 'PRA': 'PTS+REB+AST',
    }

    def make_betting_line(avg):
        """Round to nearest sportsbook-style half-point line just below the average."""
        # e.g. avg=26.3 -> 25.5,  avg=24.8 -> 24.5,  avg=5.2 -> 4.5
        return math.floor(avg - 0.5) + 0.5

    def generate_betting_rec(pick, category):
        """
        Generate a betting recommendation for a pick.
        - Value picks: recommend OVER on the best trending stat with best CV.
        - Consistent picks: recommend OVER on the stat with the lowest CV.
        Returns a dict with type, stat, line, confidence, reason, etc.
        """
        stats = pick.get('stats', {})

        if category == 'value':
            # Rank stats by a combined score: trend_pct weighted by consistency
            candidates = []
            for s in BETTING_STATS:
                d = stats.get(s, {})
                if not d or d.get('recent_avg', 0) < 1.0:
                    continue
                cv = d.get('cv', 99)
                trend = d.get('trend_pct', 0)
                if trend <= 0 and cv >= 90:
                    continue
                # Score: positive trend is key, penalised by high CV
                consistency_boost = min(1.0 / max(cv, 0.05), 5.0) if cv < 90 else 0.1
                score = trend * consistency_boost
                candidates.append((s, score, d))
            candidates.sort(key=lambda x: x[1], reverse=True)
            if not candidates:
                return None
            best_stat, _, detail = candidates[0]
        else:
            # Consistent picks: lowest CV among meaningful stats
            candidates = []
            for s in BETTING_STATS:
                d = stats.get(s, {})
                if not d or d.get('recent_avg', 0) < 1.0:
                    continue
                cv = d.get('cv', 99)
                if cv >= 90:
                    continue
                candidates.append((s, cv, d))
            candidates.sort(key=lambda x: x[1])  # lowest CV first
            if not candidates:
                return None
            best_stat, _, detail = candidates[0]

        recent_avg = detail.get('recent_avg', 0)
        season_avg = detail.get('season_avg', 0)
        cv = detail.get('cv', 99)
        trend_pct = detail.get('trend_pct', 0)
        recent_std = detail.get('recent_std', 0)

        line = make_betting_line(recent_avg)
        if line < 0.5:
            return None

        # Confidence tiers
        if cv < 0.25:
            confidence = 'strong'
        elif cv < 0.40:
            confidence = 'moderate'
        else:
            confidence = 'lean'

        # Build a short human-readable reason
        stat_label = STAT_LABELS.get(best_stat, best_stat)
        if category == 'value':
            if trend_pct > 0:
                reason = f"Trending +{trend_pct:.1f}% above baseline with {cv:.2f} CV"
            else:
                reason = f"High volume ({recent_avg:.1f} avg) with {cv:.2f} CV"
        else:
            reason = f"CV of {cv:.2f} — one of the most predictable {stat_label.lower()} outputs"

        return {
            'type': 'OVER',
            'stat': best_stat,
            'stat_label': stat_label,
            'line': line,
            'recent_avg': recent_avg,
            'season_avg': season_avg,
            'cv': round(cv, 3),
            'trend_pct': round(trend_pct, 1),
            'confidence': confidence,
            'reason': reason,
        }

    def slim_pick(pick, rank, category):
        """Trim to essential fields for the frontend."""
        # Best trending stat: highest trend_pct; fallback to highest recent_avg for season mode
        best_stat = None
        best_trend = 0
        for stat in BETTING_STATS:
            s = pick['stats'].get(stat, {})
            if s.get('trend_pct', 0) > best_trend and s.get('recent_avg', 0) > 1.0:
                best_trend = s['trend_pct']
                best_stat = stat
        if best_stat is None:  # season mode — no trend, show highest-volume stat
            best_avg = 0
            for stat in ['PTS', 'AST', 'REB']:
                s = pick['stats'].get(stat, {})
                if s.get('recent_avg', 0) > best_avg:
                    best_avg = s['recent_avg']
                    best_stat = stat
        # Top 4 stats to show on the card face, ranked by trend_pct (or recent_avg in season mode)
        displayable = [s for s in BETTING_STATS if pick['stats'].get(s, {}).get('recent_avg', 0) > 0.5]
        if any(pick['stats'].get(s, {}).get('trend_pct', 0) != 0 for s in displayable):
            displayable.sort(key=lambda s: pick['stats'][s].get('trend_pct', 0), reverse=True)
        else:  # season mode — sort by volume
            displayable.sort(key=lambda s: pick['stats'][s].get('recent_avg', 0), reverse=True)
        top_trending_stats = displayable[:4]

        # Generate betting recommendation
        betting_rec = generate_betting_rec(pick, category)

        return {
            'rank': rank,
            'player_id': pick['player_id'],
            'name': pick['name'],
            'team': pick['team'],
            'total_games': pick['total_games'],
            'category': category,
            'injury_status': pick.get('injury_status', None),
            'value_score': pick.get('value_score', 0),
            'consistency_score': pick.get('consistency_score', 0),
            'best_trending_stat': best_stat,
            'top_trending_stats': top_trending_stats,
            'betting_rec': betting_rec,
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

    windows_output = {}

    # Windowed analysis: 5, 10, 15, 20 games
    for w in WINDOWS:
        analyses = []
        for player_id, data in all_data.items():
            result = analyze_player(player_id, data, directory, window=w)
            if result:
                analyses.append(result)
        analyses = filter_tonight(analyses)
        print(f"  📊 Window {w}g: {len(analyses)} players")
        best_value = find_best_value_picks(analyses, top_n=12)
        most_consistent = find_most_consistent(analyses, top_n=12)
        windows_output[str(w)] = {
            'best_value': [slim_pick(p, i + 1, 'value') for i, p in enumerate(best_value)],
            'most_consistent': [slim_pick(p, i + 1, 'consistent') for i, p in enumerate(most_consistent)],
        }

    # Season analysis (window=0 means all games)
    analyses = []
    for player_id, data in all_data.items():
        result = analyze_player(player_id, data, directory, window=0)
        if result:
            analyses.append(result)
    analyses = filter_tonight(analyses)
    print(f"  📊 Season: {len(analyses)} players")
    best_value = find_best_value_picks(analyses, top_n=12, is_season=True)
    most_consistent = find_most_consistent(analyses, top_n=12, is_season=True)
    windows_output['season'] = {
        'best_value': [slim_pick(p, i + 1, 'value') for i, p in enumerate(best_value)],
        'most_consistent': [slim_pick(p, i + 1, 'consistent') for i, p in enumerate(most_consistent)],
    }

    output = {
        'generated_at': datetime.now(tz=timezone.utc).isoformat(),
        'min_games': MIN_SEASON_GAMES,
        'windows': windows_output,
    }

    out_path = os.path.join(CACHE_DIR, 'value_picks.json')
    with open(out_path, 'w') as f:
        json.dump({
            '_cached_at': datetime.now(tz=timezone.utc).isoformat(),
            'data': output
        }, f, default=str)

    print(f"  ✅ Saved: {out_path}")
    w10 = windows_output.get('10', {})
    print(f"  🔥 Best Value (L10): {', '.join(p['name'] for p in w10.get('best_value', [])[:5])}")
    print(f"  🎯 Most Consistent (L10): {', '.join(p['name'] for p in w10.get('most_consistent', [])[:5])}")

    return output


if __name__ == '__main__':
    generate_value_picks()
