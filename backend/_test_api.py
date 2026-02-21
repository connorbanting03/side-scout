#!/usr/bin/env python3
"""Quick connectivity test for NBA API endpoints."""
import socket
import requests

HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/121.0.0.0 Safari/537.36'
    ),
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
}

TIMEOUT = 10

def test(label, fn):
    print(f"\n{'='*50}")
    print(f"  {label}")
    print('='*50)
    try:
        fn()
    except Exception as e:
        print(f"  ❌ UNHANDLED: {type(e).__name__}: {e}")

def dns_check():
    for host in ['stats.nba.com', 'cdn.nba.com']:
        try:
            ip = socket.gethostbyname(host)
            print(f"  ✅ {host} -> {ip}")
        except socket.gaierror as e:
            print(f"  ❌ {host} DNS FAILED: {e}")

def cdn_scoreboard():
    url = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
    try:
        r = requests.get(url, timeout=TIMEOUT)
        print(f"  HTTP {r.status_code}  ({len(r.content)} bytes)")
        games = r.json().get('scoreboard', {}).get('games', [])
        print(f"  Games today: {len(games)}")
        for g in games[:3]:
            ht = g['homeTeam']['teamTricode']
            at = g['awayTeam']['teamTricode']
            print(f"    {at} @ {ht}  — {g.get('gameStatusText','')}")
    except requests.exceptions.ConnectTimeout:
        print("  ❌ CONNECT TIMEOUT")
    except requests.exceptions.ReadTimeout:
        print("  ❌ READ TIMEOUT")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

def stats_standings():
    url = 'https://stats.nba.com/stats/leaguestandings?Season=2025-26&SeasonType=Regular+Season&LeagueID=00'
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        print(f"  HTTP {r.status_code}  ({len(r.content)} bytes)")
        if r.status_code == 200:
            rows = r.json()['resultSets'][0]['rowSet']
            print(f"  Teams in standings: {len(rows)}")
    except requests.exceptions.ConnectTimeout:
        print("  ❌ CONNECT TIMEOUT")
    except requests.exceptions.ReadTimeout:
        print("  ❌ READ TIMEOUT")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

def stats_players():
    url = 'https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=1&LeagueID=00&Season=2025-26'
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        print(f"  HTTP {r.status_code}  ({len(r.content)} bytes)")
        if r.status_code == 200:
            rows = r.json()['resultSets'][0]['rowSet']
            print(f"  Active players: {len(rows)}")
    except requests.exceptions.ConnectTimeout:
        print("  ❌ CONNECT TIMEOUT")
    except requests.exceptions.ReadTimeout:
        print("  ❌ READ TIMEOUT")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

def stats_team_gamelog():
    # Celtics team ID = 1610612738
    url = 'https://stats.nba.com/stats/teamgamelogs?TeamID=1610612738&Season=2025-26&SeasonType=Regular+Season'
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        print(f"  HTTP {r.status_code}  ({len(r.content)} bytes)")
        if r.status_code == 200:
            rows = r.json()['resultSets'][0]['rowSet']
            print(f"  Celtics games logged: {len(rows)}")
    except requests.exceptions.ConnectTimeout:
        print("  ❌ CONNECT TIMEOUT")
    except requests.exceptions.ReadTimeout:
        print("  ❌ READ TIMEOUT")
    except Exception as e:
        print(f"  ❌ {type(e).__name__}: {e}")

if __name__ == '__main__':
    print("\n🏀 NBA API Connectivity Test")
    test("DNS resolution", dns_check)
    test("cdn.nba.com — live scoreboard", cdn_scoreboard)
    test("stats.nba.com — league standings", stats_standings)
    test("stats.nba.com — all players", stats_players)
    test("stats.nba.com — team game log (Celtics)", stats_team_gamelog)
    print("\n✅ Tests complete\n")
