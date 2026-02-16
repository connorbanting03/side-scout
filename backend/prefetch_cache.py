#!/usr/bin/env python3
"""
Nightly Cache Prefetch Script for Side Scout
=============================================
Run this script nightly (e.g., 3 AM ET via cron) to pre-fetch all NBA data
into local JSON files. This eliminates most live NBA API calls during the day.

Usage:
  python prefetch_cache.py          # Full prefetch (all data)
  python prefetch_cache.py --quick  # Quick mode (directory + standings only)

Cron example (run at 3 AM ET every day):
  0 3 * * * cd /path/to/backend && python prefetch_cache.py >> /var/log/prefetch.log 2>&1
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

def main():
    quick_mode = '--quick' in sys.argv
    
    print("=" * 60)
    print(f"🌙 Side Scout Nightly Cache Prefetch")
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Season: {SEASON}")
    print(f"   Mode: {'QUICK (directory + standings only)' if quick_mode else 'FULL'}")
    print("=" * 60)
    
    start = time.time()
    ensure_cache_dirs()
    
    # Always do these (fast, no NBA API calls for directory)
    active_players, all_teams = prefetch_directory()
    prefetch_standings()
    
    if not quick_mode:
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
