from flask import Flask, jsonify, request
from nba_api.stats.endpoints import playercareerstats, commonplayerinfo, playergamelog
from nba_api.stats.static import players
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
    """Search for a player by name"""
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
        
        return jsonify({'players': player_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/player/<player_id>/games', methods=['GET'])
def get_player_games(player_id):
    """Get player game log with optional limit"""
    limit = request.args.get('limit', 10, type=int)
    season = request.args.get('season', '2025-26')
    
    try:
        gamelog = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        games_df = gamelog.get_data_frames()[0]
        
        # Get last N games
        last_games = games_df.head(limit)
        
        # Calculate averages
        stats_columns = ['PTS', 'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT', 
                        'FTM', 'FTA', 'FT_PCT', 'REB', 'AST', 'STL', 'BLK', 'TOV', 
                        'PF', 'PLUS_MINUS', 'MIN']
        
        averages = {}
        for col in stats_columns:
            if col in last_games.columns:
                averages[col] = float(last_games[col].mean())
        
        return jsonify({
            'games': last_games.to_dict('records'),
            'averages': averages,
            'total_games': len(games_df)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/scoreboard', methods=['GET'])
def get_scoreboard():
    """Get today's scoreboard"""
    try:
        games = scoreboard.ScoreBoard()
        return jsonify(games.get_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    # Test mode: fetch Steph Curry before starting server
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
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
        app.run(debug=True, port=5000)

