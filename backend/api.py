from flask import Flask, jsonify, request, send_from_directory
from nba_api.stats.endpoints import playercareerstats, commonplayerinfo, playergamelog, teamgamelogs, teamdashboardbygeneralsplits, leaguedashteamstats
from nba_api.stats.static import players, teams
from nba_api.live.nba.endpoints import scoreboard
from flask_cors import CORS
import pandas as pd
import time
import os
from functools import wraps, lru_cache
import requests
from requests.exceptions import Timeout, ReadTimeout, ConnectionError

# Path to the Next.js static export output
STATIC_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'out')

app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='')
CORS(app)

# Configure NBA API timeout (monkey patch)
try:
    from nba_api.library.http import NBAStatsHTTP
    original_send = NBAStatsHTTP.send_api_request
    
    def send_with_timeout(self, *args, **kwargs):
        # Increase timeout to 60 seconds
        if 'timeout' not in kwargs:
            kwargs['timeout'] = 60
        return original_send(self, *args, **kwargs)
    
    NBAStatsHTTP.send_api_request = send_with_timeout
except Exception as e:
    print(f"Warning: Could not configure NBA API timeout: {e}")

# Retry decorator with exponential backoff
def retry_with_backoff(max_retries=3, initial_delay=1, backoff_factor=2):
    """Retry decorator with exponential backoff for handling API timeouts"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (Timeout, ReadTimeout, ConnectionError) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        print(f"Attempt {attempt + 1} failed: {str(e)}. Retrying in {delay}s...")
                        time.sleep(delay)
                        delay *= backoff_factor
                    else:
                        print(f"All {max_retries} attempts failed for {func.__name__}")
                except Exception as e:
                    # For non-timeout errors, fail immediately
                    raise e
            
            # If we've exhausted all retries, raise the last exception
            raise last_exception
        return wrapper
    return decorator

# Cache for static data (teams, players list)
@lru_cache(maxsize=1)
def get_all_teams_cached():
    """Cached version of teams.get_teams()"""
    return teams.get_teams()

@lru_cache(maxsize=1)
def get_all_players_cached():
    """Cached version of players.get_players()"""
    return players.get_players()

def format_timeout_error():
    """Format a user-friendly timeout error message"""
    return {
        'error': 'NBA API timeout',
        'message': 'The NBA Stats API is currently experiencing high traffic or is slow to respond. This often happens during live games. Please try again in a moment.',
        'retry': True
    }

@app.route('/api/player/<player_id>', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_player_by_id(player_id):
    """Get player career stats by player ID"""
    try:
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        
        return jsonify({
            'player_info': info.get_dict(),
            'career_stats': career.get_dict()
        })
    except (Timeout, ReadTimeout, ConnectionError) as e:
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to fetch player data'}), 400

@app.route('/api/player/search', methods=['GET'])
def search_player():
    """Search for a player by name (active players only)"""
    name = request.args.get('name')
    if not name:
        return jsonify({'error': 'Name parameter required'}), 400
    
    try:
        # Search for player
        player_list = players.find_players_by_full_name(name)
        
        if not player_list:
            # Try partial match using cached data
            all_players = get_all_players_cached()
            player_list = [p for p in all_players if name.lower() in p['full_name'].lower()]
        
        # Filter to only active players
        active_players = [p for p in player_list if p.get('is_active', False)]
        
        return jsonify({'players': active_players})
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to search for player'}), 400

@app.route('/api/team/search', methods=['GET'])
def search_team():
    """Search for a team by name or abbreviation"""
    name = request.args.get('name')
    if not name:
        return jsonify({'error': 'Name parameter required'}), 400
    
    try:
        # Get all teams from cache
        all_teams = get_all_teams_cached()
        
        # Search by full name, city, nickname, or abbreviation
        team_list = [t for t in all_teams if 
                     name.lower() in t['full_name'].lower() or 
                     name.lower() in t['city'].lower() or 
                     name.lower() in t['nickname'].lower() or
                     name.lower() in t['abbreviation'].lower()]
        
        return jsonify({'teams': team_list})
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to search for team'}), 400

@app.route('/api/team/<int:team_id>/players', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_team_players(team_id):
    """Get all active players from a specific team"""
    try:
        from nba_api.stats.endpoints import commonteamroster
        
        # Get current season roster
        roster = commonteamroster.CommonTeamRoster(team_id=team_id, season='2025-26')
        roster_df = roster.get_data_frames()[0]
        
        # Convert to list of player objects matching our Player interface
        players_list = []
        for _, player in roster_df.iterrows():
            players_list.append({
                'id': int(player['PLAYER_ID']),
                'full_name': player['PLAYER'],
                'is_active': True  # Current roster players are active
            })
        
        return jsonify({'players': players_list})
    except (Timeout, ReadTimeout, ConnectionError) as e:
        print(f"Timeout getting team players: {str(e)}")
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        print(f"Error getting team players: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'message': 'Failed to fetch team roster'}), 400

@app.route('/api/player/<player_id>/games', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_player_games(player_id):
    """Get player game log with optional limit"""
    limit = request.args.get('limit', 10, type=int)
    season = request.args.get('season', '2025-26')
    
    try:
        gamelog = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        games_df = gamelog.get_data_frames()[0]
        
        # Get player info for team and jersey number
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        player_info_dict = info.get_dict()
        player_data = player_info_dict['resultSets'][0]['rowSet'][0] if player_info_dict['resultSets'][0]['rowSet'] else []
        
        # Extract team and jersey from player info
        # CommonPlayerInfo fields: TEAM_ABBREVIATION is usually around index 17-20, JERSEY is around index 13-14
        # Let's be more robust and check the headers
        headers = player_info_dict['resultSets'][0]['headers']
        
        team_abbr = None
        jersey = None
        
        if 'TEAM_ABBREVIATION' in headers:
            team_idx = headers.index('TEAM_ABBREVIATION')
            team_abbr = player_data[team_idx] if len(player_data) > team_idx else None
        
        if 'JERSEY' in headers:
            jersey_idx = headers.index('JERSEY')
            jersey = player_data[jersey_idx] if len(player_data) > jersey_idx else None
        
        # Get last N games
        last_games = games_df.head(limit)
        
        # Convert MIN to numeric if it's in string format (e.g., "35:42" -> 35.7)
        if 'MIN' in last_games.columns:
            def convert_minutes(min_val):
                if pd.isna(min_val):
                    return 0
                if isinstance(min_val, str) and ':' in min_val:
                    parts = min_val.split(':')
                    return float(parts[0]) + float(parts[1]) / 60
                return float(min_val)
            
            last_games['MIN'] = last_games['MIN'].apply(convert_minutes)
        
        # Calculate averages
        stats_columns = ['PTS', 'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT', 
                        'FTM', 'FTA', 'FT_PCT', 'REB', 'AST', 'STL', 'BLK', 'TOV', 
                        'PF', 'PLUS_MINUS', 'MIN']
        
        averages = {}
        for col in stats_columns:
            if col in last_games.columns:
                mean_val = last_games[col].mean()
                # Replace NaN with 0 to avoid JSON serialization issues
                averages[col] = 0.0 if pd.isna(mean_val) else float(mean_val)
        
        # Convert games to dict and replace NaN values
        games_dict = last_games.to_dict('records')
        for game in games_dict:
            for key, value in game.items():
                if pd.isna(value):
                    game[key] = None
        
        return jsonify({
            'games': games_dict,
            'averages': averages,
            'total_games': len(games_df),
            'team': team_abbr,
            'jersey': jersey
        })
    except (Timeout, ReadTimeout, ConnectionError) as e:
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to fetch player game log'}), 400

@app.route('/api/team/<team_id>/games', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_team_games(team_id):
    """Get team game log with stats"""
    limit = request.args.get('limit', 10, type=int)
    season = request.args.get('season', '2025-26')
    
    try:
        # Get team game log using correct endpoint
        from nba_api.stats.endpoints import teamgamelogs
        
        # Fetch game logs for the team
        gamelog = teamgamelogs.TeamGameLogs(team_id_nullable=team_id, season_nullable=season)
        games_df = gamelog.get_data_frames()[0]
        
        # Get last N games
        last_games = games_df.head(limit)
        
        # Calculate averages
        stats_columns = ['PTS', 'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT', 
                        'FTM', 'FTA', 'FT_PCT', 'REB', 'AST', 'STL', 'BLK', 'TOV', 
                        'PF', 'PLUS_MINUS']
        
        averages = {}
        for col in stats_columns:
            if col in last_games.columns:
                mean_val = last_games[col].mean()
                # Replace NaN with 0 to avoid JSON serialization issues
                averages[col] = 0.0 if pd.isna(mean_val) else float(mean_val)
        
        # Calculate opponent points - the column might be named differently
        opp_pts_col = None
        for col_name in ['OPP_PTS', 'PTS_OPP', 'OPPONENT_PTS']:
            if col_name in last_games.columns:
                opp_pts_col = col_name
                break
        
        if opp_pts_col:
            opp_mean = last_games[opp_pts_col].mean()
            averages['OPP_PTS'] = 0.0 if pd.isna(opp_mean) else float(opp_mean)
            averages['DEF_RATING'] = averages['OPP_PTS']
        elif 'PTS' in last_games.columns and 'PLUS_MINUS' in last_games.columns:
            # Approximate opponent points using team points minus plus/minus
            last_games = last_games.copy()
            last_games['OPP_PTS'] = last_games['PTS'] - last_games['PLUS_MINUS']
            opp_mean = last_games['OPP_PTS'].mean()
            averages['OPP_PTS'] = 0.0 if pd.isna(opp_mean) else float(opp_mean)
            averages['DEF_RATING'] = averages['OPP_PTS']
        
        # Calculate win percentage
        if 'WL' in last_games.columns:
            wins = (last_games['WL'] == 'W').sum()
            averages['WIN_PCT'] = float(wins / len(last_games)) if len(last_games) > 0 else 0.0
        else:
            averages['WIN_PCT'] = 0.0
        
        # Get team info - find_team_by_id doesn't exist, use get_teams and filter
        all_teams = get_all_teams_cached()
        team_info = next((t for t in all_teams if t['id'] == int(team_id)), None)
        
        # Convert games to dict and replace NaN values
        games_dict = last_games.to_dict('records')
        for game in games_dict:
            for key, value in game.items():
                if pd.isna(value):
                    game[key] = None
        
        return jsonify({
            'games': games_dict,
            'averages': averages,
            'total_games': len(games_df),
            'team_info': team_info
        })
    except (Timeout, ReadTimeout, ConnectionError) as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Timeout in get_team_games: {error_details}")
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_team_games: {error_details}")
        return jsonify({'error': str(e), 'message': 'Failed to fetch team game log', 'details': error_details}), 400

@app.route('/api/standings', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_standings():
    """Get current NBA standings"""
    try:
        from nba_api.stats.endpoints import leaguestandings
        standings = leaguestandings.LeagueStandings(season='2025-26')
        standings_dict = standings.get_dict()
        
        # Extract standings data
        headers = standings_dict['resultSets'][0]['headers']
        rows = standings_dict['resultSets'][0]['rowSet']
        
        standings_list = []
        for row in rows:
            standing_dict = {}
            for i, header in enumerate(headers):
                standing_dict[header] = row[i]
            standings_list.append(standing_dict)
        
        return jsonify({'standings': standings_list})
    except (Timeout, ReadTimeout, ConnectionError) as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Timeout in get_standings: {error_details}")
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_standings: {error_details}")
        return jsonify({'error': str(e), 'message': 'Failed to fetch standings', 'details': error_details}), 400

@app.route('/api/team/<int:team_id>/standings', methods=['GET'])
@retry_with_backoff(max_retries=3, initial_delay=2)
def get_team_standings(team_id):
    """Get specific team's standings info"""
    try:
        from nba_api.stats.endpoints import leaguestandings
        standings = leaguestandings.LeagueStandings(season='2025-26')
        standings_dict = standings.get_dict()
        
        # Extract standings data
        headers = standings_dict['resultSets'][0]['headers']
        rows = standings_dict['resultSets'][0]['rowSet']
        
        # Find the team's standing
        for row in rows:
            standing_dict = {}
            for i, header in enumerate(headers):
                standing_dict[header] = row[i]
            # Match by team ID
            if standing_dict.get('TEAM_ID') == team_id:
                return jsonify({
                    'team_id': team_id,
                    'wins': standing_dict.get('W'),
                    'losses': standing_dict.get('L'),
                    'win_pct': standing_dict.get('W_PCT'),
                    'conference_rank': standing_dict.get('CONF_RANK'),
                    'conference': standing_dict.get('CONFERENCE'),
                    'division': standing_dict.get('DIVISION'),
                    'division_rank': standing_dict.get('DIVISION_RANK'),
                    'gb': standing_dict.get('GB'),
                    'standing_dict': standing_dict
                })
        
        return jsonify({'error': 'Team not found in standings'}), 404
    except (Timeout, ReadTimeout, ConnectionError) as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Timeout in get_team_standings: {error_details}")
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_team_standings: {error_details}")
        return jsonify({'error': str(e), 'message': 'Failed to fetch team standings', 'details': error_details}), 400

@app.route('/api/scoreboard', methods=['GET'])
@retry_with_backoff(max_retries=2, initial_delay=1)
def get_scoreboard():
    """Get today's scoreboard"""
    try:
        games = scoreboard.ScoreBoard()
        return jsonify(games.get_dict())
    except (Timeout, ReadTimeout, ConnectionError) as e:
        return jsonify(format_timeout_error()), 503
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to fetch scoreboard'}), 400


@app.route('/api/live/player/<player_id>', methods=['GET'])
@retry_with_backoff(max_retries=2, initial_delay=1)
def get_player_live_game(player_id):
    """Check if player has a game today (scheduled/live/final), return stats and matchup history"""
    try:
        # Get player info to find their team
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        player_info_dict = info.get_dict()
        headers = player_info_dict['resultSets'][0]['headers']
        player_data = player_info_dict['resultSets'][0]['rowSet'][0] if player_info_dict['resultSets'][0]['rowSet'] else []

        team_id = None
        if 'TEAM_ID' in headers:
            team_idx = headers.index('TEAM_ID')
            team_id = player_data[team_idx] if len(player_data) > team_idx else None

        if not team_id:
            return jsonify({'live': False, 'hasGame': False, 'message': 'Could not determine player team'})

        # Get today's scoreboard (NBA API returns games for "today" in their server time)
        sb = scoreboard.ScoreBoard()
        sb_dict = sb.get_dict()

        game_found = None
        opponent_tricode = None
        is_home = False

        for game in sb_dict.get('scoreboard', {}).get('games', []):
            home_id = game['homeTeam']['teamId']
            away_id = game['awayTeam']['teamId']

            if home_id == team_id or away_id == team_id:
                game_found = game
                is_home = (home_id == team_id)
                opponent_tricode = game['awayTeam']['teamTricode'] if is_home else game['homeTeam']['teamTricode']
                break

        if not game_found:
            return jsonify({'live': False, 'hasGame': False, 'message': 'No game scheduled today'})

        # Game status: 1=scheduled, 2=live, 3=final
        game_status = game_found.get('gameStatus', 1)
        game_id = game_found['gameId']
        player_live_stats = None

        # Only fetch box score stats if game has started (status 2=live or 3=final)
        if game_status >= 2:
            try:
                from nba_api.live.nba.endpoints import boxscore as live_boxscore
                box = live_boxscore.BoxScore(game_id=game_id)
                box_dict = box.get_dict()

                team_key = 'homeTeam' if is_home else 'awayTeam'
                game_data = box_dict.get('game', {})
                for p in game_data.get(team_key, {}).get('players', []):
                    if str(p.get('personId', '')) == str(player_id):
                        stats = p.get('statistics', {})
                        player_live_stats = {
                            'name': p.get('name', ''),
                            'minutes': stats.get('minutes', ''),
                            'points': stats.get('points', 0),
                            'rebounds': stats.get('reboundsTotal', 0),
                            'assists': stats.get('assists', 0),
                            'steals': stats.get('steals', 0),
                            'blocks': stats.get('blocks', 0),
                            'turnovers': stats.get('turnovers', 0),
                            'fgm': stats.get('fieldGoalsMade', 0),
                            'fga': stats.get('fieldGoalsAttempted', 0),
                            'fg_pct': stats.get('fieldGoalsPercentage', 0),
                            'fg3m': stats.get('threePointersMade', 0),
                            'fg3a': stats.get('threePointersAttempted', 0),
                            'fg3_pct': stats.get('threePointersPercentage', 0),
                            'ftm': stats.get('freeThrowsMade', 0),
                            'fta': stats.get('freeThrowsAttempted', 0),
                            'ft_pct': stats.get('freeThrowsPercentage', 0),
                            'plus_minus': stats.get('plusMinusPoints', 0),
                            'fouls': stats.get('foulsPersonal', 0),
                        }
                        break
            except Exception as e:
                print(f"Error getting box score (Game status: {game_status}): {e}")

        # Get season matchup history vs this opponent
        matchup_history = []
        try:
            gamelog = playergamelog.PlayerGameLog(player_id=player_id, season='2025-26')
            games_df = gamelog.get_data_frames()[0]

            opp_games = games_df[games_df['MATCHUP'].str.contains(opponent_tricode, case=False, na=False)]

            if 'MIN' in opp_games.columns:
                def convert_minutes(min_val):
                    if pd.isna(min_val):
                        return 0
                    if isinstance(min_val, str) and ':' in min_val:
                        parts = min_val.split(':')
                        return float(parts[0]) + float(parts[1]) / 60
                    return float(min_val)
                opp_games = opp_games.copy()
                opp_games['MIN'] = opp_games['MIN'].apply(convert_minutes)

            history_dict = opp_games.to_dict('records')
            for game in history_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None
            matchup_history = history_dict
        except Exception as e:
            print(f"Error getting matchup history: {e}")

        return jsonify({
            'live': game_status == 2,  # True only if game is actively live (status 2)
            'hasGame': True,
            'game': {
                'gameId': game_found['gameId'],
                'status': game_status,
                'statusText': game_found.get('gameStatusText', ''),
                'period': game_found.get('period', 0),
                'clock': game_found.get('gameClock', ''),
                'homeTeam': {
                    'teamId': game_found['homeTeam']['teamId'],
                    'tricode': game_found['homeTeam'].get('teamTricode', ''),
                    'teamName': game_found['homeTeam'].get('teamName', ''),
                    'score': game_found['homeTeam'].get('score', 0),
                    'wins': game_found['homeTeam'].get('wins', 0),
                    'losses': game_found['homeTeam'].get('losses', 0),
                },
                'awayTeam': {
                    'teamId': game_found['awayTeam']['teamId'],
                    'tricode': game_found['awayTeam'].get('teamTricode', ''),
                    'teamName': game_found['awayTeam'].get('teamName', ''),
                    'score': game_found['awayTeam'].get('score', 0),
                    'wins': game_found['awayTeam'].get('wins', 0),
                    'losses': game_found['awayTeam'].get('losses', 0),
                },
                'isHome': is_home,
            },
            'playerStats': player_live_stats,
            'matchupHistory': matchup_history,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'live': False, 'hasGame': False, 'error': str(e), 'message': 'Error checking for player game'})


@app.route('/api/live/team/<team_id>', methods=['GET'])
@retry_with_backoff(max_retries=2, initial_delay=1)
def get_team_live_game(team_id):
    """Check if team has a game today (scheduled/live/final), return stats and matchup history"""
    try:
        team_id_int = int(team_id)

        # Get today's scoreboard (NBA API returns games for "today" in their server time)
        sb = scoreboard.ScoreBoard()
        sb_dict = sb.get_dict()

        game_found = None
        opponent_tricode = None
        is_home = False

        for game in sb_dict.get('scoreboard', {}).get('games', []):
            home_id = game['homeTeam']['teamId']
            away_id = game['awayTeam']['teamId']

            if home_id == team_id_int or away_id == team_id_int:
                game_found = game
                is_home = (home_id == team_id_int)
                opponent_tricode = game['awayTeam']['teamTricode'] if is_home else game['homeTeam']['teamTricode']
                break

        if not game_found:
            return jsonify({'live': False, 'hasGame': False, 'message': 'No game scheduled today'})

        # Game status: 1=scheduled, 2=live, 3=final
        game_status = game_found.get('gameStatus', 1)
        
        # Get team's stats from box score if game has started (status 2=live or 3=final)
        team_live_stats = None
        if game_status >= 2:
            try:
                from nba_api.live.nba.endpoints import boxscore as live_boxscore
                box = live_boxscore.BoxScore(game_id=game_found['gameId'])
                box_dict = box.get_dict()

                team_key = 'homeTeam' if is_home else 'awayTeam'
                game_data = box_dict.get('game', {})
                team_data = game_data.get(team_key, {})
                stats = team_data.get('statistics', {})

                if stats:
                    team_live_stats = {
                        'points': stats.get('points', 0),
                        'rebounds': stats.get('reboundsTotal', 0),
                        'assists': stats.get('assists', 0),
                        'steals': stats.get('steals', 0),
                        'blocks': stats.get('blocks', 0),
                        'turnovers': stats.get('turnovers', 0),
                        'fgm': stats.get('fieldGoalsMade', 0),
                        'fga': stats.get('fieldGoalsAttempted', 0),
                        'fg_pct': stats.get('fieldGoalsPercentage', 0),
                        'fg3m': stats.get('threePointersMade', 0),
                        'fg3a': stats.get('threePointersAttempted', 0),
                        'fg3_pct': stats.get('threePointersPercentage', 0),
                        'ftm': stats.get('freeThrowsMade', 0),
                        'fta': stats.get('freeThrowsAttempted', 0),
                        'ft_pct': stats.get('freeThrowsPercentage', 0),
                    }
            except Exception as e:
                print(f"Error getting box score for team (Game status: {game_status}): {e}")

        # Get season matchup history
        matchup_history = []
        try:
            gamelog = teamgamelogs.TeamGameLogs(team_id_nullable=team_id, season_nullable='2025-26')
            games_df = gamelog.get_data_frames()[0]

            opp_games = games_df[games_df['MATCHUP'].str.contains(opponent_tricode, case=False, na=False)]

            # Calculate OPP_PTS if not present
            if 'OPP_PTS' not in opp_games.columns and 'PTS' in opp_games.columns and 'PLUS_MINUS' in opp_games.columns:
                opp_games = opp_games.copy()
                opp_games['OPP_PTS'] = opp_games['PTS'] - opp_games['PLUS_MINUS']

            history_dict = opp_games.to_dict('records')
            for game in history_dict:
                for key, value in game.items():
                    if pd.isna(value):
                        game[key] = None
            matchup_history = history_dict
        except Exception as e:
            print(f"Error getting team matchup history: {e}")

        return jsonify({
            'live': game_status == 2,  # True only if game is actively live (status 2)
            'hasGame': True,
            'game': {
                'gameId': game_found['gameId'],
                'status': game_status,
                'statusText': game_found.get('gameStatusText', ''),
                'period': game_found.get('period', 0),
                'clock': game_found.get('gameClock', ''),
                'homeTeam': {
                    'teamId': game_found['homeTeam']['teamId'],
                    'tricode': game_found['homeTeam'].get('teamTricode', ''),
                    'teamName': game_found['homeTeam'].get('teamName', ''),
                    'score': game_found['homeTeam'].get('score', 0),
                    'wins': game_found['homeTeam'].get('wins', 0),
                    'losses': game_found['homeTeam'].get('losses', 0),
                },
                'awayTeam': {
                    'teamId': game_found['awayTeam']['teamId'],
                    'tricode': game_found['awayTeam'].get('teamTricode', ''),
                    'teamName': game_found['awayTeam'].get('teamName', ''),
                    'score': game_found['awayTeam'].get('score', 0),
                    'wins': game_found['awayTeam'].get('wins', 0),
                    'losses': game_found['awayTeam'].get('losses', 0),
                },
                'isHome': is_home,
            },
            'teamStats': team_live_stats,
            'matchupHistory': matchup_history,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'live': False, 'hasGame': False, 'error': str(e), 'message': 'Error checking for team game'})


if __name__ == '__main__':
    # Development mode: run with Flask's built-in server
    # For production, use: gunicorn -w 4 -b 0.0.0.0:5000 api:app
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        print("Testing API - Fetching LeBron James...")
        
        # Search for LeBron
        test_players = players.find_players_by_full_name("Lebron James")
        print(f"\nFound {len(test_players)} player(s):")
        for player in test_players:
            print(f"  - {player['full_name']} (ID: {player['id']})")
        
        if test_players:
            player_id = str(test_players[0]['id'])
            print(f"\nFetching 2025-26 season game log for {test_players[0]['full_name']}...")
            
            # Get current season game log
            gamelog = playergamelog.PlayerGameLog(player_id=player_id, season='2025-26')
            games_df = gamelog.get_data_frames()[0]
            
            print(f"\nTotal games this season: {len(games_df)}")
            
            # Get last 10 games
            last_10 = games_df.head(10)
            
            print(f"\n{'='*80}")
            print(f"LAST 10 GAMES AVERAGES (2025-26 Season)")
            print(f"{'='*80}")
            
            # Calculate averages
            stats_to_avg = {
                'PTS': 'Points',
                'FGM': 'FG Made',
                'FGA': 'FG Attempted',
                'FG_PCT': 'FG%',
                'FG3M': '3PT Made',
                'FG3A': '3PT Attempted',
                'FG3_PCT': '3PT%',
                'FTM': 'FT Made',
                'FTA': 'FT Attempted',
                'FT_PCT': 'FT%',
                'REB': 'Rebounds',
                'AST': 'Assists',
                'STL': 'Steals',
                'BLK': 'Blocks',
                'TOV': 'Turnovers',
                'PF': 'Fouls',
                'PLUS_MINUS': '+/-'
            }
            
            print(f"\nGames Played: {len(last_10)}")
            print(f"\nScoring:")
            for stat, label in list(stats_to_avg.items())[:10]:
                if stat in last_10.columns:
                    avg = last_10[stat].mean()
                    if 'PCT' in stat:
                        print(f"  {label:.<20} {avg:.1%}")
                    else:
                        print(f"  {label:.<20} {avg:.1f}")
            
            print(f"\nOther Stats:")
            for stat, label in list(stats_to_avg.items())[10:]:
                if stat in last_10.columns:
                    avg = last_10[stat].mean()
                    print(f"  {label:.<20} {avg:.1f}")
            
            print(f"\n{'='*80}")
            print(f"\nLast 5 Games Detail:")
            print(f"{'='*80}")
            for idx, game in last_10.head(5).iterrows():
                print(f"\n{game['GAME_DATE']} vs {game['MATCHUP'].split()[-1]}:")
                print(f"  {game['PTS']} PTS | {game['REB']} REB | {game['AST']} AST")
                print(f"  {game['FGM']}-{game['FGA']} FG | {game['FG3M']}-{game['FG3A']} 3PT | {game['FTM']}-{game['FTA']} FT")
        
        print("\n\nTest complete!")
    else:
        # Development server
        print("Starting Flask development server...")
        print(f"Serving frontend from: {STATIC_FOLDER}")
        print("For production with multiple workers, use:")
        print("  gunicorn -w 4 -b 0.0.0.0:5000 api:app")
        app.run(debug=True, host='0.0.0.0', port=5000)


# ---------- Serve Next.js static frontend ----------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve the Next.js static export. API routes are handled above."""
    # If the exact file exists, serve it (JS, CSS, images, etc.)
    full_path = os.path.join(STATIC_FOLDER, path)
    if path and os.path.isfile(full_path):
        return send_from_directory(STATIC_FOLDER, path)
    # Otherwise serve index.html for SPA client-side routing
    index_path = os.path.join(STATIC_FOLDER, 'index.html')
    if os.path.isfile(index_path):
        return send_from_directory(STATIC_FOLDER, 'index.html')
    return jsonify({'error': 'Frontend not built. Run npm run build first.'}), 404

