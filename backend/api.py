from flask import Flask, jsonify, request
from nba_api.stats.endpoints import playercareerstats, commonplayerinfo, playergamelog, teamgamelogs, teamdashboardbygeneralsplits, leaguedashteamstats
from nba_api.stats.static import players, teams
from nba_api.live.nba.endpoints import scoreboard
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)

@app.route('/api/player/<player_id>', methods=['GET'])
def get_player_by_id(player_id):
    """Get player career stats by player ID"""
    try:
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        
        return jsonify({
            'player_info': info.get_dict(),
            'career_stats': career.get_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

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
            # Try partial match
            all_players = players.get_players()
            player_list = [p for p in all_players if name.lower() in p['full_name'].lower()]
        
        # Filter to only active players
        active_players = [p for p in player_list if p.get('is_active', False)]
        
        return jsonify({'players': active_players})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/team/search', methods=['GET'])
def search_team():
    """Search for a team by name or abbreviation"""
    name = request.args.get('name')
    if not name:
        return jsonify({'error': 'Name parameter required'}), 400
    
    try:
        # Get all teams
        all_teams = teams.get_teams()
        
        # Search by full name, city, nickname, or abbreviation
        team_list = [t for t in all_teams if 
                     name.lower() in t['full_name'].lower() or 
                     name.lower() in t['city'].lower() or 
                     name.lower() in t['nickname'].lower() or
                     name.lower() in t['abbreviation'].lower()]
        
        return jsonify({'teams': team_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/team/<int:team_id>/players', methods=['GET'])
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
    except Exception as e:
        print(f"Error getting team players: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@app.route('/api/player/<player_id>/games', methods=['GET'])
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
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/team/<team_id>/games', methods=['GET'])
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
        all_teams = teams.get_teams()
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
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_team_games: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 400

@app.route('/api/standings', methods=['GET'])
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
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_standings: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 400

@app.route('/api/team/<int:team_id>/standings', methods=['GET'])
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
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_team_standings: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 400

@app.route('/api/scoreboard', methods=['GET'])
def get_scoreboard():
    """Get today's scoreboard"""
    try:
        games = scoreboard.ScoreBoard()
        return jsonify(games.get_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/live/player/<player_id>', methods=['GET'])
def get_player_live_game(player_id):
    """Check if player is in a live game today, return live stats and season matchup history"""
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
            return jsonify({'live': False, 'message': 'Could not determine player team'})

        # Get today's scoreboard
        sb = scoreboard.ScoreBoard()
        sb_dict = sb.get_dict()

        live_game = None
        opponent_tricode = None
        is_home = False

        for game in sb_dict.get('scoreboard', {}).get('games', []):
            home_id = game['homeTeam']['teamId']
            away_id = game['awayTeam']['teamId']

            if home_id == team_id or away_id == team_id:
                live_game = game
                is_home = (home_id == team_id)
                opponent_tricode = game['awayTeam']['teamTricode'] if is_home else game['homeTeam']['teamTricode']
                break

        if not live_game:
            return jsonify({'live': False})

        # Get live box score for player stats if game has started
        game_id = live_game['gameId']
        player_live_stats = None

        if live_game.get('gameStatus', 1) >= 2:
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
                print(f"Error getting live box score: {e}")

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
            'live': True,
            'game': {
                'gameId': live_game['gameId'],
                'status': live_game.get('gameStatus', 1),
                'statusText': live_game.get('gameStatusText', ''),
                'period': live_game.get('period', 0),
                'clock': live_game.get('gameClock', ''),
                'homeTeam': {
                    'teamId': live_game['homeTeam']['teamId'],
                    'tricode': live_game['homeTeam'].get('teamTricode', ''),
                    'teamName': live_game['homeTeam'].get('teamName', ''),
                    'score': live_game['homeTeam'].get('score', 0),
                    'wins': live_game['homeTeam'].get('wins', 0),
                    'losses': live_game['homeTeam'].get('losses', 0),
                },
                'awayTeam': {
                    'teamId': live_game['awayTeam']['teamId'],
                    'tricode': live_game['awayTeam'].get('teamTricode', ''),
                    'teamName': live_game['awayTeam'].get('teamName', ''),
                    'score': live_game['awayTeam'].get('score', 0),
                    'wins': live_game['awayTeam'].get('wins', 0),
                    'losses': live_game['awayTeam'].get('losses', 0),
                },
                'isHome': is_home,
            },
            'playerStats': player_live_stats,
            'matchupHistory': matchup_history,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'live': False, 'error': str(e)})


@app.route('/api/live/team/<team_id>', methods=['GET'])
def get_team_live_game(team_id):
    """Check if team is in a live game today, return live stats and season matchup history"""
    try:
        team_id_int = int(team_id)

        # Get today's scoreboard
        sb = scoreboard.ScoreBoard()
        sb_dict = sb.get_dict()

        live_game = None
        opponent_tricode = None
        is_home = False

        for game in sb_dict.get('scoreboard', {}).get('games', []):
            home_id = game['homeTeam']['teamId']
            away_id = game['awayTeam']['teamId']

            if home_id == team_id_int or away_id == team_id_int:
                live_game = game
                is_home = (home_id == team_id_int)
                opponent_tricode = game['awayTeam']['teamTricode'] if is_home else game['homeTeam']['teamTricode']
                break

        if not live_game:
            return jsonify({'live': False})

        # Get team's live stats from box score if game started
        team_live_stats = None
        if live_game.get('gameStatus', 1) >= 2:
            try:
                from nba_api.live.nba.endpoints import boxscore as live_boxscore
                box = live_boxscore.BoxScore(game_id=live_game['gameId'])
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
                print(f"Error getting live box score for team: {e}")

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
            'live': True,
            'game': {
                'gameId': live_game['gameId'],
                'status': live_game.get('gameStatus', 1),
                'statusText': live_game.get('gameStatusText', ''),
                'period': live_game.get('period', 0),
                'clock': live_game.get('gameClock', ''),
                'homeTeam': {
                    'teamId': live_game['homeTeam']['teamId'],
                    'tricode': live_game['homeTeam'].get('teamTricode', ''),
                    'teamName': live_game['homeTeam'].get('teamName', ''),
                    'score': live_game['homeTeam'].get('score', 0),
                    'wins': live_game['homeTeam'].get('wins', 0),
                    'losses': live_game['homeTeam'].get('losses', 0),
                },
                'awayTeam': {
                    'teamId': live_game['awayTeam']['teamId'],
                    'tricode': live_game['awayTeam'].get('teamTricode', ''),
                    'teamName': live_game['awayTeam'].get('teamName', ''),
                    'score': live_game['awayTeam'].get('score', 0),
                    'wins': live_game['awayTeam'].get('wins', 0),
                    'losses': live_game['awayTeam'].get('losses', 0),
                },
                'isHome': is_home,
            },
            'teamStats': team_live_stats,
            'matchupHistory': matchup_history,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'live': False, 'error': str(e)})


if __name__ == '__main__':
    # Test mode: fetch Steph Curry before starting server
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='NBA Stats API Server')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host IP address (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=5000, help='Port number (default: 5000)')
    parser.add_argument('test', nargs='?', help='Run in test mode')
    args = parser.parse_args()
    
    if args.test == 'test':
        print("Testing API - Fetching Steph Curry...")
        
        # Search for Steph Curry
        curry_players = players.find_players_by_full_name("Lebron James")
        print(f"\nFound {len(curry_players)} player(s):")
        for player in curry_players:
            print(f"  - {player['full_name']} (ID: {player['id']})")
        
        if curry_players:
            curry_id = str(curry_players[0]['id'])
            print(f"\nFetching 2025-26 season game log for {curry_players[0]['full_name']}...")
            
            # Get current season game log (2025-26 season)
            gamelog = playergamelog.PlayerGameLog(player_id=curry_id, season='2025-26')
            games_df = gamelog.get_data_frames()[0]
            
            print(f"\nTotal games this season: {len(games_df)}")
            
            # Get last 10 games
            last_10 = games_df.head(10)
            
            print(f"\n{'='*80}")
            print(f"STEPH CURRY - LAST 10 GAMES AVERAGES (2025-26 Season)")
            print(f"{'='*80}")
            
            # Calculate averages for last 10 games
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
        print(f"Starting server on {args.host}:{args.port}")
        app.run(debug=True, host=args.host, port=args.port)

