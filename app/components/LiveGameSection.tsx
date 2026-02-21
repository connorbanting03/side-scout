'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Clock, Trophy, Calendar, RefreshCw } from 'lucide-react';
import { LiveGameData, LivePlayerStats, LiveTeamStats, LiveGameInfo, GameStats, ScheduleGame } from '../types';
import { API_BASE_URL } from '../lib/config';

interface LiveGameSectionProps {
  entityType: 'player' | 'team';
  entityId: number;
  teamId?: number; // If known (player's team), skip roster lookup
}

// ---- Schedule cache (loaded once, shared across all LiveGameSection instances) ----
let schedulePromise: Promise<ScheduleGame[]> | null = null;
let cachedSchedule: ScheduleGame[] | null = null;
let scheduleFetchedAt = 0;
const SCHEDULE_CACHE_TTL = 5 * 60 * 1000; // 5 min client-side TTL

function loadSchedule(): Promise<ScheduleGame[]> {
  const now = Date.now();
  if (cachedSchedule && (now - scheduleFetchedAt) < SCHEDULE_CACHE_TTL) {
    return Promise.resolve(cachedSchedule);
  }
  if (schedulePromise) return schedulePromise;

  schedulePromise = fetch(`${API_BASE_URL}/api/schedule`)
    .then(res => res.json())
    .then((data: { games: ScheduleGame[] }) => {
      cachedSchedule = data.games || [];
      scheduleFetchedAt = Date.now();
      schedulePromise = null;
      return cachedSchedule;
    })
    .catch(err => {
      console.error('Failed to load schedule:', err);
      schedulePromise = null;
      return [] as ScheduleGame[];
    });

  return schedulePromise;
}

/** Check if a game belongs to today's calendar date (ET, approximated by local clock).
 *  The gameEt field is in the format "YYYY-MM-DDTHH:MM:SSZ" in Eastern time. */
function isGameToday(game: ScheduleGame): boolean {
  const gameEt = game.gameEt || game.gameTimeUTC || '';
  if (!gameEt) return true; // no date info — assume today to be safe
  const gameDate = gameEt.slice(0, 10); // "YYYY-MM-DD"
  // Get today in ET: UTC-5 (EST) or UTC-4 (EDT). Use a rough -5h offset;
  // the important thing is we don't show games from clearly different dates.
  const now = new Date();
  const etOffset = -5; // close enough for calendar-day comparison
  const etNow = new Date(now.getTime() + (now.getTimezoneOffset() + etOffset * 60) * 60000);
  const todayStr = etNow.toISOString().slice(0, 10);
  return gameDate === todayStr;
}

/** Check whether a game's start time has passed (using gameTimeUTC). */
function hasGameStarted(game: ScheduleGame): boolean {
  if (game.status >= 2) return true; // Already live or final
  if (!game.gameTimeUTC) return false;
  try {
    const startTime = new Date(game.gameTimeUTC).getTime();
    return Date.now() >= startTime;
  } catch {
    return false;
  }
}

const formatLiveMinutes = (isoMinutes: string): string => {
  if (!isoMinutes) return '0:00';
  const match = isoMinutes.match(/PT(\d+)M([\d.]+)S/);
  if (match) {
    const mins = parseInt(match[1]);
    const secs = Math.floor(parseFloat(match[2]));
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return isoMinutes;
};

export default function LiveGameSection({ entityType, entityId, teamId }: LiveGameSectionProps) {
  // Phase 1: schedule check (cheap, from cache)
  const [scheduleGame, setScheduleGame] = useState<ScheduleGame | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [noGame, setNoGame] = useState(false);

  // Phase 2: live data (only fetched after game has started)
  const [data, setData] = useState<LiveGameData | null>(null);
  const [liveActive, setLiveActive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve which team ID to look up in the schedule.
  // For team entities, entityId IS the team ID.
  // For player entities, we need the teamId prop or fall back to roster lookup.
  const resolvedTeamId = entityType === 'team' ? entityId : teamId;

  // ---- PHASE 1: Check the cached schedule ----
  useEffect(() => {
    let cancelled = false;
    setScheduleLoading(true);
    setNoGame(false);
    setScheduleGame(null);
    setData(null);
    setLiveActive(false);

    loadSchedule().then(games => {
      if (cancelled) return;

      // Filter to only games actually on today's calendar date
      const todaysGames = games.filter(isGameToday);

      let found: ScheduleGame | null = null;

      if (entityType === 'team') {
        found = todaysGames.find(g =>
          g.homeTeam.teamId === entityId || g.awayTeam.teamId === entityId
        ) || null;
      } else if (resolvedTeamId) {
        found = todaysGames.find(g =>
          g.homeTeam.teamId === resolvedTeamId || g.awayTeam.teamId === resolvedTeamId
        ) || null;
      }

      if (!found) {
        // No game today — if player and we don't have teamId, try the live endpoint
        // as a fallback (handles case where teamId wasn't provided)
        if (entityType === 'player' && !resolvedTeamId) {
          setScheduleLoading(false);
          // Fall back to the live endpoint which does its own team lookup
          setLiveActive(true);
        } else {
          setNoGame(true);
          setScheduleLoading(false);
        }
        return;
      }

      setScheduleGame(found);
      setScheduleLoading(false);

      // If game has already started or is final, immediately go to live mode
      if (hasGameStarted(found)) {
        setLiveActive(true);
      }
    });

    return () => { cancelled = true; };
  }, [entityType, entityId, resolvedTeamId]);

  // ---- PHASE 1b: For scheduled games, poll to detect when start time arrives ----
  useEffect(() => {
    if (!scheduleGame || liveActive) return;
    if (scheduleGame.status >= 2) return; // Already started

    // Check every 60 seconds if game start time has arrived
    const checkStart = () => {
      if (hasGameStarted(scheduleGame)) {
        setLiveActive(true);
      }
    };

    startCheckIntervalRef.current = setInterval(checkStart, 60000);
    return () => {
      if (startCheckIntervalRef.current) clearInterval(startCheckIntervalRef.current);
    };
  }, [scheduleGame, liveActive]);

  // ---- PHASE 2: Live data fetching (only when liveActive is true) ----
  const fetchLiveData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/live/${entityType}/${entityId}`);
      if (!response.ok) throw new Error('Failed to fetch live data');
      const result: LiveGameData = await response.json();
      setData(result);
      setLastUpdated(new Date());

      // If the live endpoint says no game, update our state
      if (!result.hasGame) {
        setNoGame(true);
        setLiveActive(false);
      }
    } catch (err) {
      console.error('Error fetching live data:', err);
      setData({ live: false });
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!liveActive) return;

    // Fetch immediately
    fetchLiveData();

    // Set up polling based on game status
    const setupPolling = () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);

      // If we have live data, adjust interval based on status
      if (data?.game?.status === 2) {
        // Live game — poll every 30 seconds
        liveIntervalRef.current = setInterval(fetchLiveData, 30000);
      } else if (data?.game?.status === 1) {
        // Scheduled — poll every 2 minutes to catch tip-off
        liveIntervalRef.current = setInterval(fetchLiveData, 120000);
      } else if (data?.game?.status === 3) {
        // Final — no more polling needed
      } else {
        // Unknown / first load — poll every 60 seconds
        liveIntervalRef.current = setInterval(fetchLiveData, 60000);
      }
    };

    setupPolling();

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [liveActive, data?.game?.status, fetchLiveData]);

  // ---- RENDERING ----

  // Loading schedule check
  if (scheduleLoading) {
    return (
      <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl p-6 shadow-xl border-2 border-indigo-200 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-indigo-300 rounded-full" />
          <div className="h-6 w-48 bg-indigo-100 rounded" />
        </div>
      </div>
    );
  }

  // No game today — render nothing
  if (noGame && !scheduleGame) {
    return null;
  }

  // ---- PRE-GAME: Show schedule card before live data is available ----
  if (scheduleGame && !liveActive) {
    const isHome = entityType === 'team'
      ? scheduleGame.homeTeam.teamId === entityId
      : scheduleGame.homeTeam.teamId === resolvedTeamId;

    return (
      <div className="bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/30 rounded-2xl p-4 md:p-6 shadow-lg border-2 border-indigo-200 relative overflow-hidden">
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <Radio className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 text-indigo-500" />
              <h3 className="text-sm md:text-lg font-bold text-gray-900 truncate">Game Today</h3>
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
                <Calendar className="w-3 h-3 text-blue-500" />
                <span className="text-blue-600 font-bold text-xs uppercase tracking-wider">
                  {scheduleGame.statusText || 'Scheduled'}
                </span>
              </div>
            </div>
          </div>

          {/* Scoreboard preview */}
          <div className="flex items-center justify-center gap-4 md:gap-10 py-2 md:py-3">
            <div className={`flex flex-col items-center gap-0.5 ${!isHome ? 'scale-110' : 'opacity-70'} transition-all`}>
              <span className="text-xl md:text-2xl font-black text-indigo-700">
                {scheduleGame.awayTeam.tricode}
              </span>
              <span className="text-xs text-gray-400 font-semibold">
                {scheduleGame.awayTeam.wins}-{scheduleGame.awayTeam.losses}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-base font-bold">{scheduleGame.statusText}</span>
              </div>
            </div>

            <div className={`flex flex-col items-center gap-0.5 ${isHome ? 'scale-110' : 'opacity-70'} transition-all`}>
              <span className="text-xl md:text-2xl font-black text-indigo-700">
                {scheduleGame.homeTeam.tricode}
              </span>
              <span className="text-xs text-gray-400 font-semibold">
                {scheduleGame.homeTeam.wins}-{scheduleGame.homeTeam.losses}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- LIVE / FINAL: Waiting for live data to load ----
  if (liveActive && !data) {
    return (
      <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl p-6 shadow-xl border-2 border-indigo-200 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-indigo-300 rounded-full" />
          <div className="h-6 w-48 bg-indigo-100 rounded" />
        </div>
      </div>
    );
  }

  // If live data came back with no game, render nothing
  if (!data?.hasGame || !data.game) {
    return null;
  }

  // ---- FULL LIVE / FINAL RENDER ----
  const { game, playerStats, teamStats, matchupHistory } = data;
  const isLive = game.status === 2;
  const isFinal = game.status === 3;
  const isScheduled = game.status === 1;

  const StatusBadge = () => {
    if (isLive) {
      return (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-red-600 font-bold text-xs uppercase tracking-wider">Live</span>
        </div>
      );
    }
    if (isFinal) {
      return (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
          <Trophy className="w-3 h-3 text-amber-500" />
          <span className="text-amber-600 font-bold text-xs uppercase tracking-wider">Final</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
        <Calendar className="w-3 h-3 text-blue-500" />
        <span className="text-blue-600 font-bold text-xs uppercase tracking-wider">Today</span>
      </div>
    );
  };

  const ScoreBoard = ({ game }: { game: LiveGameInfo }) => {
    const awayHighlight = !game.isHome;
    const homeHighlight = game.isHome;

    return (
      <div className="flex items-center justify-center gap-4 md:gap-10 py-2 md:py-3">
        {/* Away Team */}
        <div className={`flex flex-col items-center gap-0.5 ${awayHighlight ? 'scale-110' : 'opacity-70'} transition-all`}>
          <span className="text-xl md:text-2xl font-black text-indigo-700">
            {game.awayTeam.tricode}
          </span>
          {!isScheduled && (
            <span className={`text-3xl md:text-4xl font-black ${awayHighlight ? 'text-gray-900' : 'text-gray-400'}`}>
              {game.awayTeam.score}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">
            {game.awayTeam.wins}-{game.awayTeam.losses}
          </span>
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center gap-1">
          {isScheduled ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="w-4 h-4" />
              <span className="text-base font-bold">{game.statusText}</span>
            </div>
          ) : (
            <>
              <span className="text-gray-300 text-lg font-bold">—</span>
              <span className="text-xs text-gray-400 font-semibold">
                {game.statusText}
              </span>
            </>
          )}
        </div>

        {/* Home Team */}
        <div className={`flex flex-col items-center gap-0.5 ${homeHighlight ? 'scale-110' : 'opacity-70'} transition-all`}>
          <span className="text-xl md:text-2xl font-black text-indigo-700">
            {game.homeTeam.tricode}
          </span>
          {!isScheduled && (
            <span className={`text-3xl md:text-4xl font-black ${homeHighlight ? 'text-gray-900' : 'text-gray-400'}`}>
              {game.homeTeam.score}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">
            {game.homeTeam.wins}-{game.homeTeam.losses}
          </span>
        </div>
      </div>
    );
  };

  const StatBox = ({ label, value, highlight, colored, subtle }: { label: string; value: string | number; highlight?: boolean; colored?: boolean; subtle?: boolean }) => {
    const valueStr = String(value);
    const isPositive = colored && typeof value === 'number' && value > 0;
    const isNegative = colored && typeof value === 'number' && value < 0;

    return (
      <div className={`flex flex-col items-center rounded-lg px-2 py-1.5 ${subtle ? 'opacity-60' : ''}`}>
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{label}</span>
        <span className={`text-base font-black ${
          highlight ? 'text-indigo-700' :
          isPositive ? 'text-emerald-600' :
          isNegative ? 'text-rose-600' :
          'text-gray-800'
        }`}>
          {colored && isPositive ? '+' : ''}{valueStr}
        </span>
      </div>
    );
  };

  const PlayerLiveStats = ({ stats }: { stats: LivePlayerStats }) => {
    const teamScore = game.isHome ? game.homeTeam.score : game.awayTeam.score;
    const oppScore = game.isHome ? game.awayTeam.score : game.homeTeam.score;
    return (
      <div className="mt-3 bg-indigo-50/60 rounded-xl p-3 md:p-4 border border-indigo-100">
        <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Current Game Stats</h4>
        <div className="grid grid-cols-4 md:grid-cols-9 gap-1">
          <StatBox label="MIN" value={formatLiveMinutes(stats.minutes)} highlight />
          <StatBox label="PTS" value={stats.points} highlight />
          <StatBox label="REB" value={stats.rebounds} />
          <StatBox label="AST" value={stats.assists} />
          <StatBox label="STL" value={stats.steals} />
          <StatBox label="FG" value={`${stats.fgm}-${stats.fga}`} />
          <StatBox label="3PT" value={`${stats.fg3m}-${stats.fg3a}`} />
          <StatBox label="FT" value={`${stats.ftm}-${stats.fta}`} />
          <StatBox label="TM" value={`${teamScore}-${oppScore}`} colored={false} subtle />
        </div>
      </div>
    );
  };

  const TeamLiveStats = ({ stats }: { stats: LiveTeamStats }) => (
    <div className="mt-3 bg-indigo-50/60 rounded-xl p-3 md:p-4 border border-indigo-100">
      <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Current Game Stats</h4>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-1">
        <StatBox label="PTS" value={stats.points} highlight />
        <StatBox label="REB" value={stats.rebounds} />
        <StatBox label="AST" value={stats.assists} />
        <StatBox label="FG" value={`${stats.fgm}-${stats.fga}`} />
        <StatBox label="3PT" value={`${stats.fg3m}-${stats.fg3a}`} />
        <StatBox label="STL" value={stats.steals} />
        <StatBox label="BLK" value={stats.blocks} />
      </div>
    </div>
  );

  const opponentTricode = game.isHome ? game.awayTeam.tricode : game.homeTeam.tricode;

  const MatchupHistory = ({ history }: { history: GameStats[] }) => {
    if (!history || history.length === 0) {
      return (
        <div className="mt-3 bg-indigo-50/40 rounded-xl p-4 border border-indigo-100">
          <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">
            Season Series vs {opponentTricode}
          </h4>
          <p className="text-gray-400 text-sm italic">No previous matchups this season</p>
        </div>
      );
    }

    return (
      <div className="mt-3 bg-indigo-50/40 rounded-xl p-3 md:p-4 border border-indigo-100">
        <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
          Season Series vs {opponentTricode}
          <span className="ml-2 text-xs text-gray-400 font-semibold normal-case">
            ({history.length} game{history.length !== 1 ? 's' : ''})
          </span>
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b border-indigo-200/60">
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-bold text-indigo-400 uppercase">Date</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-left text-xs font-bold text-indigo-400 uppercase">Matchup</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">W/L</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">PTS</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">OPP</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">REB</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">AST</th>
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-center text-xs font-bold text-indigo-400 uppercase">FG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-100/60">
              {history.map((game, idx) => {
                const gameDate = new Date(game.GAME_DATE);
                const formattedDate = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                <tr key={idx} className="hover:bg-indigo-50/60 transition-colors">
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-gray-700 font-semibold whitespace-nowrap">{formattedDate}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-gray-700 font-semibold whitespace-nowrap">{game.MATCHUP}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center">
                    <span className={`text-xs font-bold px-1.5 md:px-2 py-0.5 rounded ${
                      game.WL === 'W' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {game.WL}
                    </span>
                  </td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center text-gray-900 font-bold">{game.PTS}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center text-gray-700 font-semibold">{game.OPP_PTS || '-'}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center text-gray-700 font-semibold">{game.REB}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center text-gray-700 font-semibold">{game.AST}</td>
                  <td className="px-2 md:px-3 py-1.5 md:py-2 text-center text-gray-700 font-semibold">{game.FGM}-{game.FGA}</td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const borderColor = isLive ? 'border-red-200' : isFinal ? 'border-amber-200' : 'border-indigo-200';
  const bgAccent = isLive ? 'from-red-50/40 via-white to-indigo-50/30' : isFinal ? 'from-amber-50/30 via-white to-indigo-50/30' : 'from-blue-50/30 via-white to-indigo-50/30';

  return (
    <div className={`bg-gradient-to-br ${bgAccent} rounded-2xl p-4 md:p-6 shadow-lg border-2 ${borderColor} relative overflow-hidden`}>
      {/* Subtle accent stripe for live */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Radio className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 ${isLive ? 'text-red-500' : isFinal ? 'text-amber-500' : 'text-indigo-500'}`} />
            <h3 className="text-sm md:text-lg font-bold text-gray-900 truncate">
              {isLive ? 'Live Game' : isFinal ? "Today's Game" : 'Game Today'}
            </h3>
            <StatusBadge />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastUpdated && (
              <span className="text-xs text-gray-400 hidden md:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchLiveData}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Refresh live data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <ScoreBoard game={game} />

        {/* Live Player Stats */}
        {entityType === 'player' && playerStats && <PlayerLiveStats stats={playerStats} />}

        {/* Live Team Stats */}
        {entityType === 'team' && teamStats && <TeamLiveStats stats={teamStats} />}

        {/* Matchup History */}
        {matchupHistory && <MatchupHistory history={matchupHistory} />}
      </div>
    </div>
  );
}
