'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Player, PlayerGamesData } from '../types';

interface PlayerDashboardProps {
  player: Player;
  gameLimit: number;
}

export default function PlayerDashboard({ player, gameLimit }: PlayerDashboardProps) {
  const [data, setData] = useState<PlayerGamesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:5000/api/player/${player.id}/games?limit=${gameLimit}&season=2025-26`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [player.id, gameLimit]);

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

  // Calculate trends by comparing first half vs second half of games
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
  const plusMinusTrend = calculateTrend(data.games, 'PLUS_MINUS');
  const fgPctTrend = calculateTrend(data.games, 'FG_PCT');
  const fg3PctTrend = calculateTrend(data.games, 'FG3_PCT');

  const chartData = data.games.slice().reverse().map((game, idx) => {
    // Extract opponent from MATCHUP (e.g., "GSW vs. LAL" -> "vs LAL" or "GSW @ LAL" -> "@ LAL")
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
      REB: game.REB,
      AST: game.AST,
      FG_PCT: (game.FG_PCT * 100).toFixed(1),
      'FG3_PCT': (game.FG3_PCT * 100).toFixed(1),
    };
  });

  const StatCard = ({ label, value, trend }: { label: string; value: string | number; trend?: number }) => (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-5 shadow-md border-2 border-indigo-200 hover:shadow-lg transition-shadow">
      <div className="text-sm text-indigo-700 font-bold mb-2 uppercase tracking-wide">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-black text-gray-900">{value}</div>
        {trend !== undefined && (
          <div className={`flex items-center text-base font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
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
    isPercentage = false 
  }: { 
    label: string; 
    trendData: { trend: number; direction: string; recentAvg?: number; olderAvg?: number }; 
    unit?: string;
    isPercentage?: boolean;
  }) => {
    const { trend, direction, recentAvg, olderAvg } = trendData;
    
    const getColorClass = () => {
      if (direction === 'up') return 'from-emerald-500 to-green-500';
      if (direction === 'down') return 'from-rose-500 to-red-500';
      return 'from-slate-400 to-gray-400';
    };
    
    const getIcon = () => {
      if (direction === 'up') return <TrendingUp className="w-6 h-6" />;
      if (direction === 'down') return <TrendingDown className="w-6 h-6" />;
      return <Activity className="w-6 h-6" />;
    };
    
    const formatValue = (val: number | undefined) => {
      if (val === undefined) return 'N/A';
      if (isPercentage) return `${(val * 100).toFixed(1)}%`;
      return val.toFixed(1);
    };
    
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-5 shadow-lg border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{label}</h4>
          <div className={`p-2 rounded-lg bg-gradient-to-r ${getColorClass()} text-white`}>
            {getIcon()}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${direction === 'up' ? 'text-emerald-600' : direction === 'down' ? 'text-rose-600' : 'text-gray-600'}`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-600 font-semibold">
              {direction === 'up' ? 'Trending Up' : direction === 'down' ? 'Trending Down' : 'Stable'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500 font-semibold">Recent Avg</div>
              <div className="text-lg font-bold text-gray-900">{formatValue(recentAvg)}{unit}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Earlier Avg</div>
              <div className="text-lg font-bold text-gray-900">{formatValue(olderAvg)}{unit}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-4xl font-bold drop-shadow-lg">{player.full_name}</h2>
          {data.team && (
            <span className="text-2xl font-bold bg-white/20 px-3 py-1 rounded-lg backdrop-blur">
              {data.team}
            </span>
          )}
          {data.jersey && (
            <span className="text-2xl font-bold bg-white/20 px-3 py-1 rounded-lg backdrop-blur">
              #{data.jersey}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-white font-semibold text-base drop-shadow">
          <Activity className="w-5 h-5" />
          <span>{gameLimit >= 100 ? 'Full Season' : `Last ${gameLimit} Games`} - 2025-26 Season</span>
        </div>
      </div>

      {/* Trend Analysis Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 shadow-xl border-2 border-indigo-300">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-7 h-7 text-indigo-600" />
          <h3 className="text-2xl font-bold text-gray-900">Performance Trends</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6 font-semibold">
          {gameLimit >= 100 
            ? `Comparing recent half of season vs earlier half` 
            : `Comparing recent ${Math.floor(gameLimit / 2)} games vs earlier ${Math.ceil(gameLimit / 2)} games`
          }
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TrendCard 
            label="Scoring" 
            trendData={scoringTrend}
            unit=" pts"
          />
          <TrendCard 
            label="Impact (+/-)" 
            trendData={plusMinusTrend}
          />
          <TrendCard 
            label="Field Goal %" 
            trendData={fgPctTrend}
            isPercentage={true}
          />
          <TrendCard 
            label="3-Point %" 
            trendData={fg3PctTrend}
            isPercentage={true}
          />
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="PPG" value={data.averages.PTS.toFixed(1)} />
        <StatCard label="RPG" value={data.averages.REB.toFixed(1)} />
        <StatCard label="APG" value={data.averages.AST.toFixed(1)} />
        <StatCard label="FG%" value={`${(data.averages.FG_PCT * 100).toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="3P%" value={`${(data.averages.FG3_PCT * 100).toFixed(1)}%`} />
        <StatCard label="Steals" value={data.averages.STL.toFixed(1)} />
        <StatCard label="Blocks" value={data.averages.BLK.toFixed(1)} />
        <StatCard label="+/-" value={data.averages.PLUS_MINUS.toFixed(1)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="3PM" value={data.averages.FG3M.toFixed(1)} />
        <StatCard label="FGM" value={data.averages.FGM.toFixed(1)} />
        <StatCard label="FTM" value={data.averages.FTM.toFixed(1)} />
        <StatCard label="Turnovers" value={data.averages.TOV.toFixed(1)} />
      </div>

      {/* Points Trend */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-xl font-bold mb-6 text-gray-900">Scoring Trend</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" height={60} style={{ fontSize: '11px', fontWeight: 600 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="PTS" stroke="#3b82f6" strokeWidth={2} name="Points" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Distribution */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-xl font-bold mb-6 text-gray-900">Per Game Stats</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" height={60} style={{ fontSize: '11px', fontWeight: 600 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="PTS" fill="#3b82f6" name="Points" />
            <Bar dataKey="REB" fill="#10b981" name="Rebounds" />
            <Bar dataKey="AST" fill="#f59e0b" name="Assists" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shooting Percentages */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border-2 border-indigo-200">
        <h3 className="text-xl font-bold mb-6 text-gray-900">Shooting Efficiency</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" height={60} style={{ fontSize: '11px', fontWeight: 600 }} interval={0} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="FG_PCT" stroke="#8b5cf6" strokeWidth={2} name="FG%" />
            <Line type="monotone" dataKey="FG3_PCT" stroke="#ec4899" strokeWidth={2} name="3PT%" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Games Table */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border-2 border-indigo-200 overflow-hidden">
        <h3 className="text-xl font-bold p-6 pb-4 text-gray-900">Recent Games</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-50 to-blue-50 border-y border-indigo-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Matchup</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">PTS</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">REB</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">AST</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">FG</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">3PT</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-indigo-700 uppercase tracking-wider">+/-</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {data.games.slice(0, 10).map((game, idx) => (
                <tr key={idx} className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{game.GAME_DATE}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{game.MATCHUP}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-center font-bold text-gray-900">{game.PTS}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-center font-semibold text-gray-900">{game.REB}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-center font-semibold text-gray-900">{game.AST}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">{game.FGM}-{game.FGA}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-900">{game.FG3M}-{game.FG3A}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-base text-center font-bold ${game.PLUS_MINUS >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {game.PLUS_MINUS > 0 ? '+' : ''}{game.PLUS_MINUS}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
