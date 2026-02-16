import json, os, glob
cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
files = sorted(glob.glob(os.path.join(cache_dir, 'player_games', '*.json')))[:1]
if files:
    with open(files[0]) as f:
        data = json.load(f)
    print("PLAYER CACHE KEYS:", list(data.keys()))
    print("Cached at:", data.get("_cached_at"))
    d = data.get("data", {})
    if isinstance(d, dict) and "games" in d:
        g = d["games"]
        if g:
            print("Game keys:", list(g[0].keys()))
            print("Sample GAME_DATE:", g[0].get("GAME_DATE"))
            print("Total games:", len(g))
            dates = [gg.get("GAME_DATE") for gg in g]
            print("Newest:", dates[0])
            print("Oldest:", dates[-1])
else:
    print("No player games cache files found")

files2 = sorted(glob.glob(os.path.join(cache_dir, 'team_games', '*.json')))[:1]
if files2:
    with open(files2[0]) as f:
        data2 = json.load(f)
    print("\nTEAM CACHE at:", data2.get("_cached_at"))
    d2 = data2.get("data", [])
    if d2:
        print("Team game keys:", list(d2[0].keys()))
        print("Sample GAME_DATE:", d2[0].get("GAME_DATE"))
        print("Newest:", d2[0].get("GAME_DATE"))
        print("Oldest:", d2[-1].get("GAME_DATE"))
        print("Total:", len(d2))
else:
    print("No team games cache files found")
