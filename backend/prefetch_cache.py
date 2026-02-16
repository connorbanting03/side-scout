#!/usr/bin/env python3
"""
Nightly Cache Prefetch Script for Side Scout
=============================================
Run this script nightly (e.g., 3 AM ET via cron) to pre-fetch all NBA data
into local JSON files. This eliminates most live NBA API calls during the day.

Usage:
  python prefetch_cache.py          # Full prefetch (all data)
  python prefetch_cache.py --quick  # Quick mode (directory + standings only)
  python prefetch_cache.py --update # Incremental (only fetch new games since last cache)

Cron example (run nightly at 3 AM ET, auto-push to git):
  0 3 * * * /path/to/backend/update_and_deploy.sh >> /var/log/side-scout-cron.log 2>&1
"""

import json
import os
import time
import sys
import traceback
from datetime import datetime

# NBA API imports
from nba_api.stats.static import players, teams
from nba_api.stats.endpoints import (
    playergamelog, commonplayerinfo, commonteamroster,
    teamgamelogs, leaguestandings
)
import pandas as pd

# ---- Configuration ----
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
SEASON = '2025-26'
# Delay between NBA API calls to avoid rate limiting (seconds)
API_DELAY = 1.2
# Max retries per API call
MAX_RETRIES = 3

def ensure_cache_dirs():
    """Create cache directory structure."""
    dirs = [
        CACHE_DIR,
        os.path.join(CACHE_DIR, 'player_games'),
        os.path.join(CACHE_DIR, 'team_games'),
        os.path.join(CACHE_DIR, 'rosters'),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

def save_json(filepath, data):
    """Save data to JSON file with timestamp metadata."""
    payload = {
        '_cached_at': datetime.utcnow().isoformat() + 'Z',
        '_season': SEASON,
        'data': data
    }
    with open(filepath, 'w') as f:
        json.dump(payload, f, default=str)
    print(f"  ✅ Saved: {filepath}")

def api_call_with_retry(func, *args, **kwargs):
    """Call an NBA API function with retry + delay."""
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(API_DELAY)  # Rate limit protection
            return func(*args, **kwargs)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = API_DELAY * (attempt + 2)
                print(f"    ⚠️  Attempt {attempt + 1} failed: {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"    ❌ Failed after {MAX_RETRIES} attempts: {e}")
                raise

def load_existing_cache(filepath):
    """Load existing cache data WITHOUT staleness check (for incremental updates)."""
    try:
        if not os.path.isfile(filepath):
            return None
        with open(filepath, 'r') as f:
            payload = json.load(f)
        return payload.get('data')
    except Exception:
        return None


def prefetch_directory():
    """
    Cache 1: The player/team directory (used for search).
    This is the static list from nba_api - no API calls needed.
    """
    print("\n📋 Caching player & team directory...")
    
    all_players = players.get_players()
    active_players = [p for p in all_players if p.get('is_active', False)]
    all_teams = teams.get_teams()
    
    save_json(os.path.join(CACHE_DIR, 'players.json'), active_players)
    save_json(os.path.join(CACHE_DIR, 'teams.json'), all_teams)
    
    print(f"  📊 {len(active_players)} active players, {len(all_teams)} teams")
    return active_players, all_teams

def prefetch_rosters(all_teams):
    """
    Cache 2: Team rosters (used when searching for a team).
    One NBA API call per team = 30 calls.
    """
    print("\n👥 Caching team rosters...")
    
    all_rosters = {}
    for i, team in enumerate(all_teams):
        team_id = team['id']
        print(f"  [{i+1}/{len(all_teams)}] {team['full_name']}...", end=' ')
        try:
            roster = api_call_with_retry(
                commonteamroster.CommonTeamRoster,
                team_id=team_id, season=SEASON
            )
            roster_df = roster.get_data_frames()[0]
            
            players_list = []
            for _, player in roster_df.iterrows():
                players_list.append({
                    'id': int(player['PLAYER_ID']),
                    'full_name': player['PLAYER'],
                    'is_active': True
                })
            
            all_rosters[str(team_id)] = players_list
            save_json(
                os.path.join(CACHE_DIR, 'rosters', f'{team_id}.json'),
                players_list
            )
            print(f"{len(players_list)} players")
        except Exception as e:
            print(f"FAILED: {e}")
    
    # Also save a combined rosters file for the directory endpoint
    save_json(os.path.join(CACHE_DIR, 'all_rosters.json'), all_rosters)
    return all_rosters

def prefetch_standings():
    """
    Cache 3: League standings.
    One NBA API call.
    """
    print("\n🏆 Caching standings...")
    try:
        standings = api_call_with_retry(
            leaguestandings.LeagueStandings,
            season=SEASON
        )
        standings_dict = standings.get_dict()
        
        headers = standings_dict['resultSets'][0]['headers']
        rows = standings_dict['resultSets'][0]['rowSet']
        
        standings_list = []
        for row in rows:
            standing = {}
            for i, header in enumerate(headers):
                standing[header] = row[i]
            standings_list.append(standing)
        
        save_json(os.path.join(CACHE_DIR, 'standings.json'), standings_list)
        
        # Also save per-team standings for quick lookup
        team_standings = {}
        for standing in standings_list:
            # NBA API sometimes uses 'TeamID' instead of 'TEAM_ID'
            team_id = standing.get('TEAM_ID') or standing.get('TeamID')
            if team_id:
                team_standings[str(team_id)] = {
                    'team_id': team_id,
                    'wins': standing.get('W') or standing.get('WINS'),
                    'losses': standing.get('L') or standing.get('LOSSES'),
                    'win_pct': standing.get('W_PCT') or standing.get('WinPCT'),
                    'conference_rank': standing.get('CONF_RANK') or standing.get('PlayoffRank'),
                    'conference': standing.get('CONFERENCE') or standing.get('Conference'),
                    'division': standing.get('DIVISION') or standing.get('Division'),
                    'division_rank': standing.get('DIVISION_RANK') or standing.get('DivisionRank'),
                    'gb': standing.get('GB') or standing.get('ConferenceGamesBack'),
                    'standing_dict': standing
                }
        
        save_json(os.path.join(CACHE_DIR, 'team_standings.json'), team_standings)
        print(f"  📊 {len(standings_list)} teams in standings")
    except Exception as e:
        print(f"  ❌ Failed to cache standings: {e}")

def prefetch_team_games(all_teams):
    """
    Cache 4: Team game logs (used for TeamDashboard).
    One NBA API call per team = 30 calls.
    """
    print("\n📊 Caching team game logs...")
    
    for i, team in enumerate(all_teams):
        team_id = team['id']
        print(f"  [{i+1}/{len(all_teams)}] {team['full_name']}...", end=' ')
        try:
            gamelog = api_call_with_retry(
                teamgamelogs.TeamGameLogs,
                team_id_nullable=team_id, season_nullable=SEASON
            )
            games_df = gamelog.get_data_frames()[0]
            
            # Calculate OPP_PTS
            if 'OPP_PTS' not in games_df.columns and 'PTS' in games_df.columns and 'PLUS_MINUS' in games_df.columns:
                games_df = games_df.copy()
                games_df['OPP_PTS'] = games_df['PTS'] - games_df['PLUS_MINUS']
            
            games_dict = games_df.to_dict('records')
            for game in games_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None
            
            save_json(
                os.path.join(CACHE_DIR, 'team_games', f'{team_id}.json'),
                games_dict
            )
            print(f"{len(games_dict)} games")
        except Exception as e:
            print(f"FAILED: {e}")

def prefetch_team_games_incremental(all_teams):
    """
    Incremental team game log update.
    Fetches all 30 teams but compares with cached data to detect
    which teams had new games. Returns set of team_ids with new games.
    """
    print("\n📊 Caching team game logs (incremental)...")

    teams_with_new_games = set()
    skipped = 0

    for i, team in enumerate(all_teams):
        team_id = team['id']
        cache_path = os.path.join(CACHE_DIR, 'team_games', f'{team_id}.json')
        print(f"  [{i+1}/{len(all_teams)}] {team['full_name']}...", end=' ')

        # Load existing cached game IDs
        existing_data = load_existing_cache(cache_path)
        existing_game_ids = set()
        if existing_data and isinstance(existing_data, list):
            existing_game_ids = {g.get('GAME_ID') for g in existing_data if g.get('GAME_ID')}

        try:
            gamelog = api_call_with_retry(
                teamgamelogs.TeamGameLogs,
                team_id_nullable=team_id, season_nullable=SEASON
            )
            games_df = gamelog.get_data_frames()[0]

            if 'OPP_PTS' not in games_df.columns and 'PTS' in games_df.columns and 'PLUS_MINUS' in games_df.columns:
                games_df = games_df.copy()
                games_df['OPP_PTS'] = games_df['PTS'] - games_df['PLUS_MINUS']

            games_dict = games_df.to_dict('records')
            for game in games_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None

            # Compare game IDs to detect new games
            new_game_ids = {g.get('GAME_ID') for g in games_dict if g.get('GAME_ID')}
            truly_new = new_game_ids - existing_game_ids

            if truly_new:
                teams_with_new_games.add(team_id)
                save_json(cache_path, games_dict)
                print(f"📥 {len(truly_new)} new game(s) (total: {len(games_dict)})")
            else:
                skipped += 1
                print(f"⏭️  no new games")

        except Exception as e:
            print(f"FAILED: {e}")

    print(f"\n  📊 {len(teams_with_new_games)} teams with new games, {skipped} unchanged")
    return teams_with_new_games

def prefetch_player_games(active_players):
    """
    Cache 5: Player game logs + info (used for PlayerDashboard).
    Two NBA API calls per player (gamelog + info).
    This is the slowest step — ~500+ active players.
    """
    print(f"\n🏀 Caching player game logs ({len(active_players)} players)...")
    print("  ⏱️  Estimated time: ~{:.0f} minutes".format(len(active_players) * API_DELAY * 2 / 60))
    
    failed = []
    for i, player in enumerate(active_players):
        player_id = player['id']
        if (i + 1) % 25 == 0 or i == 0:
            print(f"\n  --- Progress: {i+1}/{len(active_players)} ---")
        
        try:
            # Fetch game log
            gamelog = api_call_with_retry(
                playergamelog.PlayerGameLog,
                player_id=player_id, season=SEASON
            )
            games_df = gamelog.get_data_frames()[0]
            
            if len(games_df) == 0:
                # Player hasn't played this season, skip
                continue
            
            # Convert MIN to numeric
            if 'MIN' in games_df.columns:
                def convert_minutes(min_val):
                    if pd.isna(min_val):
                        return 0
                    if isinstance(min_val, str) and ':' in min_val:
                        parts = min_val.split(':')
                        return float(parts[0]) + float(parts[1]) / 60
                    return float(min_val)
                games_df = games_df.copy()
                games_df['MIN'] = games_df['MIN'].apply(convert_minutes)
            
            games_dict = games_df.to_dict('records')
            for game in games_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None
            
            # Fetch player info (team, jersey)
            info = api_call_with_retry(
                commonplayerinfo.CommonPlayerInfo,
                player_id=player_id
            )
            player_info_dict = info.get_dict()
            player_data = player_info_dict['resultSets'][0]['rowSet'][0] if player_info_dict['resultSets'][0]['rowSet'] else []
            headers = player_info_dict['resultSets'][0]['headers']
            
            team_abbr = None
            jersey = None
            team_id_numeric = None
            
            if 'TEAM_ABBREVIATION' in headers:
                team_idx = headers.index('TEAM_ABBREVIATION')
                team_abbr = player_data[team_idx] if len(player_data) > team_idx else None
            
            if 'JERSEY' in headers:
                jersey_idx = headers.index('JERSEY')
                jersey = player_data[jersey_idx] if len(player_data) > jersey_idx else None

            if 'TEAM_ID' in headers:
                tid_idx = headers.index('TEAM_ID')
                team_id_numeric = player_data[tid_idx] if len(player_data) > tid_idx else None
            
            cache_data = {
                'games': games_dict,
                'total_games': len(games_df),
                'team': team_abbr,
                'jersey': jersey,
                'team_id': team_id_numeric,
            }
            
            save_json(
                os.path.join(CACHE_DIR, 'player_games', f'{player_id}.json'),
                cache_data
            )
            
        except Exception as e:
            failed.append((player['full_name'], str(e)))
            print(f"    ❌ {player['full_name']}: {e}")
    
    if failed:
        print(f"\n  ⚠️  {len(failed)} players failed:")
        for name, err in failed[:10]:
            print(f"    - {name}: {err}")
        if len(failed) > 10:
            print(f"    ... and {len(failed) - 10} more")

def prefetch_player_games_incremental(active_players, teams_with_new_games):
    """
    Incrementally update player game logs.
    Only fetches players on teams that had new games since last cache.
    Reuses cached team/jersey/team_id info to skip CommonPlayerInfo API call.

    Savings vs full mode:
      - Skips ~70% of players (their teams didn't play)
      - Skips CommonPlayerInfo for cached players (saves 1 API call each)
      - Typical night: ~150 API calls vs ~1000 in full mode
    """
    # Load rosters from cache to know which players are on which teams
    all_rosters = load_existing_cache(os.path.join(CACHE_DIR, 'all_rosters.json'))

    # Build set of player IDs on teams that played
    players_to_update = set()
    if all_rosters:
        for team_id in teams_with_new_games:
            roster = all_rosters.get(str(team_id), [])
            for p in roster:
                players_to_update.add(int(p['id']))

    # Also include any active player whose cache file is missing entirely
    for player in active_players:
        cache_path = os.path.join(CACHE_DIR, 'player_games', f'{player["id"]}.json')
        if not os.path.isfile(cache_path):
            players_to_update.add(player['id'])

    total = len(players_to_update)
    total_active = len(active_players)
    skipped = total_active - total

    print(f"\n🏀 Incremental player update: {total} to fetch, {skipped} skipped")
    if total == 0:
        print("  ✅ All players already up to date!")
        return

    print(f"  ⏱️  Estimated: ~{total * API_DELAY * 1.5 / 60:.0f} minutes")

    failed = []
    fetched = 0
    info_skipped = 0

    for player in active_players:
        player_id = player['id']
        if player_id not in players_to_update:
            continue

        fetched += 1
        if fetched % 25 == 0 or fetched == 1:
            print(f"\n  --- Progress: {fetched}/{total} ---")

        try:
            # Check existing cache for player info (team/jersey/team_id)
            cache_path = os.path.join(CACHE_DIR, 'player_games', f'{player_id}.json')
            existing = load_existing_cache(cache_path)
            has_info = existing and existing.get('team_id') and existing.get('team')

            # Always fetch gamelog (1 API call)
            gamelog = api_call_with_retry(
                playergamelog.PlayerGameLog,
                player_id=player_id, season=SEASON
            )
            games_df = gamelog.get_data_frames()[0]

            if len(games_df) == 0:
                continue

            # Convert MIN to numeric
            if 'MIN' in games_df.columns:
                def convert_minutes(min_val):
                    if pd.isna(min_val):
                        return 0
                    if isinstance(min_val, str) and ':' in min_val:
                        parts = min_val.split(':')
                        return float(parts[0]) + float(parts[1]) / 60
                    return float(min_val)
                games_df = games_df.copy()
                games_df['MIN'] = games_df['MIN'].apply(convert_minutes)

            games_dict = games_df.to_dict('records')
            for game in games_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None

            if has_info:
                # Reuse cached player info — SKIP CommonPlayerInfo API call!
                info_skipped += 1
                cache_data = {
                    'games': games_dict,
                    'total_games': len(games_df),
                    'team': existing['team'],
                    'jersey': existing.get('jersey'),
                    'team_id': existing['team_id'],
                }
            else:
                # First time caching this player — need CommonPlayerInfo
                info = api_call_with_retry(
                    commonplayerinfo.CommonPlayerInfo,
                    player_id=player_id
                )
                player_info_dict = info.get_dict()
                player_data = player_info_dict['resultSets'][0]['rowSet'][0] if player_info_dict['resultSets'][0]['rowSet'] else []
                headers = player_info_dict['resultSets'][0]['headers']

                team_abbr = None
                jersey = None
                team_id_numeric = None

                if 'TEAM_ABBREVIATION' in headers:
                    idx = headers.index('TEAM_ABBREVIATION')
                    team_abbr = player_data[idx] if len(player_data) > idx else None
                if 'JERSEY' in headers:
                    idx = headers.index('JERSEY')
                    jersey = player_data[idx] if len(player_data) > idx else None
                if 'TEAM_ID' in headers:
                    idx = headers.index('TEAM_ID')
                    team_id_numeric = player_data[idx] if len(player_data) > idx else None

                cache_data = {
                    'games': games_dict,
                    'total_games': len(games_df),
                    'team': team_abbr,
                    'jersey': jersey,
                    'team_id': team_id_numeric,
                }

            save_json(cache_path, cache_data)

        except Exception as e:
            failed.append((player['full_name'], str(e)))
            print(f"    ❌ {player['full_name']}: {e}")

    print(f"\n  📊 Fetched {fetched} players, skipped CommonPlayerInfo for {info_skipped}")
    if failed:
        print(f"  ⚠️  {len(failed)} players failed:")
        for name, err in failed[:10]:
            print(f"    - {name}: {err}")
        if len(failed) > 10:
            print(f"    ... and {len(failed) - 10} more")

def main():
    quick_mode = '--quick' in sys.argv
    update_mode = '--update' in sys.argv

    if update_mode:
        mode_str = 'UPDATE (incremental — only new games)'
    elif quick_mode:
        mode_str = 'QUICK (directory + standings only)'
    else:
        mode_str = 'FULL'

    print("=" * 60)
    print(f"🌙 Side Scout Cache Prefetch")
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Season: {SEASON}")
    print(f"   Mode: {mode_str}")
    print("=" * 60)

    start = time.time()
    ensure_cache_dirs()

    # Always refresh directory + standings (directory = no API calls, standings = 1 call)
    active_players, all_teams = prefetch_directory()
    prefetch_standings()

    if quick_mode:
        pass  # Done — directory + standings only
    elif update_mode:
        # Incremental: fetch team games to detect who played,
        # then only update players on those teams
        teams_with_new_games = prefetch_team_games_incremental(all_teams)
        prefetch_player_games_incremental(active_players, teams_with_new_games)
    else:
        # Full mode: re-fetch everything
        prefetch_rosters(all_teams)
        prefetch_team_games(all_teams)
        prefetch_player_games(active_players)

    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print(f"✅ Cache prefetch complete in {elapsed/60:.1f} minutes")
    print(f"   Cache location: {CACHE_DIR}")
    print("=" * 60)

if __name__ == '__main__':
    main()
