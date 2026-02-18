'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Shield, Settings } from 'lucide-react';
import { Team, TeamGamesData } from '../types';
import StatsConfigMenu, { StatsConfig, useStatsConfig } from './StatsConfigMenu';
import LiveGameSection from './LiveGameSection';
import { API_BASE_URL } from '../lib/config';

interface TeamDashboardProps {
  team: Team;
  gameLimit: number;
}

export default function TeamDashboard({ team, gameLimit }: TeamDashboardProps) {
  const [data, setData] = useState<TeamGamesData | null>(null);
  const [standings, setStandings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useStatsConfig('teamStatsConfig');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [gamesResponse, standingsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/team/${team.id}/games?limit=${gameLimit}&season=2025-26`),
          fetch(`${API_BASE_URL}/api/team/${team.id}/standings`)
        ]);
        
        if (!gamesResponse.ok) throw new Error('Failed to fetch games data');
        const result = await gamesResponse.json();
        setData(result);
        
        if (standingsResponse.ok) {
          const standingsResult = await standingsResponse.json();
          setStandings(standingsResult);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [team.id, gameLimit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error: {error || 'No data available'}
      </div>
    );
  }

  // Calculate trends
  const calculateTrend = (games: any[], stat: string) => {
    if (games.length < 4) return { trend: 0, direction: 'stable' };
    
    const midpoint = Math.floor(games.length / 2);
    const recentGames = games.slice(0, midpoint);
    const olderGames = games.slice(midpoint);
    
    const recentAvg = recentGames.reduce((sum, g) => sum + (g[stat] || 0), 0) / recentGames.length;
    const olderAvg = olderGames.reduce((sum, g) => sum + (g[stat] || 0), 0) / olderGames.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (change > 5) direction = 'up';
    else if (change < -5) direction = 'down';
    
    return { trend: change, direction, recentAvg, olderAvg };
  };
  
  const scoringTrend = calculateTrend(data.games, 'PTS');
  const defenseTeam = calculateTrend(data.games, 'OPP_PTS');
  const plusMinusTrend = calculateTrend(data.games, 'PLUS_MINUS');
  const fgPctTrend = calculateTrend(data.games, 'FG_PCT');
  // Calculate standard deviation
  const calculateStdDev = (games: any[], stat: string) => {
    const values = games.map(g => g[stat]);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  };
  const chartData = data.games.slice().reverse().map((game, idx) => {
    let opponent = '';
    if (game.MATCHUP.includes('vs.')) {
      opponent = 'vs ' + game.MATCHUP.split('vs.')[1].trim();
    } else if (game.MATCHUP.includes('@')) {
      opponent = '@ ' + game.MATCHUP.split('@')[1].trim();
    } else {
      opponent = game.MATCHUP;
    }
    
    return {
      game: opponent,
      date: game.GAME_DATE,
      PTS: game.PTS,
      OPP_PTS: game.OPP_PTS || (game.PTS - game.PLUS_MINUS),
      REB: game.REB,
      AST: game.AST,
      FG_PCT: (game.FG_PCT * 100).toFixed(1),
      'FG3_PCT': (game.FG3_PCT * 100).toFixed(1),
      result: game.WL,
    };
  });

  const StatCard = ({ label, value, stdDev, trend }: { label: string; value: string | number; stdDev?: number; trend?: number }) => (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 md:p-5 shadow-md border-2 border-indigo-200 hover:shadow-lg transition-shadow">
      <div className="text-xs md:text-sm text-indigo-700 font-bold mb-1 md:mb-2 uppercase tracking-wide">{label}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl md:text-3xl font-black text-gray-900">{value}</div>
          {stdDev !== undefined && (
            <div className="text-xs text-gray-500 font-semibold mt-1">±{stdDev.toFixed(1)} SD</div>
          )}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm md:text-base font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4 md:w-5 md:h-5" /> : <TrendingDown className="w-4 h-4 md:w-5 md:h-5" />}
            <span className="ml-1">{Math.abs(trend).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const TrendCard = ({ 
    label, 
    trendData, 
    unit = '', 
    isPercentage = false,
    inverse = false
  }: { 
    label: string; 
    trendData: { trend: number; direction: string; recentAvg?: number; olderAvg?: number }; 
    unit?: string;
    isPercentage?: boolean;
    inverse?: boolean;
  }) => {
    const { trend, direction, recentAvg, olderAvg } = trendData;
    
    const getColorClass = () => {
      const isGood = inverse ? direction === 'down' : direction === 'up';
      if (isGood) return 'from-emerald-500 to-green-500';
      if (direction === 'stable') return 'from-slate-400 to-gray-400';
      return 'from-rose-500 to-red-500';
    };
    
    const getIcon = () => {
      if (direction === 'up') return <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />;
      if (direction === 'down') return <TrendingDown className="w-4 h-4 md:w-6 md:h-6" />;
      return <Activity className="w-4 h-4 md:w-6 md:h-6" />;
    };
    
    const formatValue = (val: number | undefined) => {
      if (val === undefined) return 'N/A';
      if (isPercentage) return `${(val * 100).toFixed(1)}%`;
      return val.toFixed(1);
    };
    
    const getTrendColor = () => {
      const isGood = inverse ? direction === 'down' : direction === 'up';
      if (isGood) return 'text-emerald-600';
      if (direction === 'stable') return 'text-gray-600';
      return 'text-rose-600';
    };
    
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 md:p-5 shadow-lg border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <h4 className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wide">{label}</h4>
          <div className={`p-1.5 md:p-2 rounded-lg bg-gradient-to-r ${getColorClass()} text-white`}>
            {getIcon()}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-baseline gap-0.5 md:gap-2">
            <span className={`text-lg md:text-3xl font-black leading-tight ${getTrendColor()}`}>
              {trend > 0 ? '+' : ''}{Math.abs(trend) >= 100 ? trend.toFixed(0) : trend.toFixed(1)}%
            </span>
            <span className="text-[10px] md:text-sm text-gray-500 font-bold uppercase tracking-wider">
              {direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'Stable'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 md:gap-3 pt-2 md:pt-3 border-t border-gray-200">
            <div>
              <div className="text-[10px] md:text-xs text-gray-500 font-semibold">Recent</div>
              <div className="text-sm md:text-lg font-bold text-gray-900">{formatValue(recentAvg)}{unit}</div>
            </div>
            <div>
              <div className="text-[10px] md:text-xs text-gray-400 font-medium">Earlier</div>
              <div className="text-sm md:text-lg font-bold text-gray-900">{formatValue(olderAvg)}{unit}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <StatsConfigMenu
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        onConfigChange={setConfig}
        isTeam={true}
      />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-4 md:p-6 text-white shadow-xl relative">
        <button
          onClick={() => setConfigOpen(true)}
          className="absolute top-3 right-3 md:top-4 md:right-4 p-2 md:p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all shadow-lg backdrop-blur-sm"
          title="Configure Stats"
        >
          <Settings className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 pr-12">
          <h2 className="text-2xl md:text-4xl font-bold drop-shadow-lg">{team.full_name}</h2>
          <span className="text-lg md:text-2xl font-bold bg-white/20 px-2 md:px-3 py-0.5 md:py-1 rounded-lg backdrop-blur">
            {team.abbreviation}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white font-semibold text-sm md:text-base drop-shadow mb-3">
          <Shield className="w-4 h-4 md:w-5 md:h-5" />
          <span>{gameLimit >= 100 ? 'Full Season' : `Last ${gameLimit} Games`} - 2025-26 Season</span>
        </div>
        {standings && standings.conference && (
          <div className="flex flex-wrap gap-2 md:gap-6 text-xs md:text-sm font-semibold drop-shadow">
            <div className="bg-white/15 px-2 md:px-3 py-1 rounded-lg backdrop-blur">
              <span className="opacity-75">{standings.conference}</span> #{standings.conference_rank}
            </div>
            {standings.division && (
              <div className="bg-white/15 px-2 md:px-3 py-1 rounded-lg backdrop-blur">
                <span className="opacity-75">{standings.division}</span> #{standings.division_rank}
              </div>
            )}
            <div className="bg-white/15 px-2 md:px-3 py-1 rounded-lg backdrop-blur">
              {standings.wins}-{standings.losses} ({standings.win_pct?.toFixed(3) || '0.000'})
            </div>
          </div>
        )}
      </div>

      {/* Trend Analysis Section */}
      {config.performanceTrends && (
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 md:p-6 shadow-xl border-2 border-indigo-300">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <TrendingUp className="w-5 h-5 md:w-7 md:h-7 text-indigo-600" />
          <h3 className="text-lg md:text-2xl font-bold text-gray-900">Team Performance Trends</h3>
        </div>
        <p className="text-xs md:text-sm text-gray-600 mb-4 md:mb-6 font-semibold">
          {gameLimit >= 100 
            ? `Comparing recent half of season vs earlier half` 
            : `Comparing recent ${Math.floor(gameLimit / 2)} games vs earlier ${Math.ceil(gameLimit / 2)} games`
          }
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <TrendCard 
            label="Points Per Game" 
            trendData={scoringTrend}
            unit=" pts"
          />
          <TrendCard 
            label="Points Against" 
            trendData={defenseTeam}
            unit=" pts"
            inverse={true}
          />
          <TrendCard 
            label="Point Differential" 
            trendData={plusMinusTrend}
          />
          <TrendCard 
            label="Field Goal %" 
            trendData={fgPctTrend}
            isPercentage={true}
          />
        </div>
      </div>
      )}

      {/* Live Game Section */}
      {config.liveGame && (
        <LiveGameSection entityType="team" entityId={team.id} />
      )}

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
        {config.ppg && <StatCard label="PPG" value={data.averages.PTS.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'PTS') : undefined} />}
        {config.oppPpg && <StatCard label="Opp PPG" value={data.averages.OPP_PTS.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'OPP_PTS') : undefined} />}
        {config.totalPoints && <StatCard label="Total Pts (O/U)" value={(data.averages.PTS + data.averages.OPP_PTS).toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games.map(g => ({ ...g, TOTAL: g.PTS + (g.OPP_PTS || 0) })), 'TOTAL') : undefined} />}
        {config.fgPct && <StatCard label="FG%" value={`${(data.averages.FG_PCT * 100).toFixed(1)}%`} stdDev={config.showStdDev ? calculateStdDev(data.games, 'FG_PCT') * 100 : undefined} />}
        {config.rpg && <StatCard label="RPG" value={data.averages.REB.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'REB') : undefined} />}
        {config.apg && <StatCard label="APG" value={data.averages.AST.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'AST') : undefined} />}
        {config.fg3Pct && <StatCard label="3P%" value={`${(data.averages.FG3_PCT * 100).toFixed(1)}%`} stdDev={config.showStdDev ? calculateStdDev(data.games, 'FG3_PCT') * 100 : undefined} />}
        {config.plusMinus && <StatCard label="+/-" value={data.averages.PLUS_MINUS.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'PLUS_MINUS') : undefined} />}
        {config.steals && <StatCard label="Steals" value={data.averages.STL.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'STL') : undefined} />}
        {config.blocks && <StatCard label="Blocks" value={data.averages.BLK.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'BLK') : undefined} />}
        {config.fg3m && <StatCard label="3PM" value={data.averages.FG3M.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'FG3M') : undefined} />}
        {config.turnovers && <StatCard label="Turnovers" value={data.averages.TOV.toFixed(1)} stdDev={config.showStdDev ? calculateStdDev(data.games, 'TOV') : undefined} />}
      </div>

      {/* Scoring Trend */}
      {config.scoringTrend && (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 md:p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gray-900">Offensive vs Defensive Performance</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" tick={{ fontSize: 8, fontWeight: 600 }} interval="preserveStartEnd" angle={0} height={20} />
            <YAxis tick={{ fontSize: 10 }} width={35} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="PTS" stroke="#3b82f6" strokeWidth={2} name="Points Scored" dot={false} />
            <Line type="monotone" dataKey="OPP_PTS" stroke="#ef4444" strokeWidth={2} name="Points Allowed" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Win/Loss Record */}
      {config.statsDistribution && (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 md:p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gray-900">Recent Games Record</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" tick={{ fontSize: 8, fontWeight: 600 }} interval="preserveStartEnd" angle={0} height={20} />
            <YAxis tick={{ fontSize: 10 }} width={35} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="PTS" fill="#3b82f6" name="Points" />
            <Bar dataKey="REB" fill="#10b981" name="Rebounds" />
            <Bar dataKey="AST" fill="#f59e0b" name="Assists" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Shooting Efficiency */}
      {config.shootingEfficiency && (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 md:p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gray-900">Shooting Efficiency</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" tick={{ fontSize: 8, fontWeight: 600 }} interval="preserveStartEnd" angle={0} height={20} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={35} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="FG_PCT" stroke="#8b5cf6" strokeWidth={2} name="FG%" dot={false} />
            <Line type="monotone" dataKey="FG3_PCT" stroke="#ec4899" strokeWidth={2} name="3PT%" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Recent Games Table */}
      {config.recentGamesTable && (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border-2 border-indigo-200 overflow-hidden">
        <h3 className="text-lg md:text-xl font-bold p-4 md:p-6 pb-3 md:pb-4 text-gray-900">Recent Games</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-indigo-50 to-blue-50 border-y border-indigo-200">
              <tr>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Date</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Matchup</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">W/L</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">PTS</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">OPP</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">REB</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">AST</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">FG%</th>
                <th className="px-2 md:px-6 py-2 md:py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">+/-</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {data.games.slice(0, 20).map((game, idx) => {
                const gameDate = new Date(game.GAME_DATE);
                const formattedDate = gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                <tr key={idx} className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-colors">
                  <td className="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-xs md:text-sm font-semibold text-gray-900">{formattedDate}</td>
                  <td className="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-xs md:text-sm font-semibold text-gray-900">{game.MATCHUP}</td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      game.WL === 'W' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {game.WL}
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-sm md:text-base text-center font-bold text-gray-900">{game.PTS}</td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-sm md:text-base text-center font-semibold text-gray-900">
                    {game.OPP_PTS || (game.PTS - game.PLUS_MINUS)}
                  </td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-sm md:text-base text-center font-semibold text-gray-900">{game.REB}</td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-sm md:text-base text-center font-semibold text-gray-900">{game.AST}</td>
                  <td className="px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-xs md:text-sm text-center font-semibold text-gray-900">
                    {(game.FG_PCT * 100).toFixed(1)}%
                  </td>
                  <td className={`px-2 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-sm md:text-base text-center font-bold ${
                    game.PLUS_MINUS >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {game.PLUS_MINUS > 0 ? '+' : ''}{game.PLUS_MINUS}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
