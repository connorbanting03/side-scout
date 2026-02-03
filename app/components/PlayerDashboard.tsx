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

  const chartData = data.games.slice().reverse().map((game, idx) => ({
    game: `G${idx + 1}`,
    date: game.GAME_DATE,
    PTS: game.PTS,
    REB: game.REB,
    AST: game.AST,
    FG_PCT: (game.FG_PCT * 100).toFixed(1),
    'FG3_PCT': (game.FG3_PCT * 100).toFixed(1),
  }));

  const StatCard = ({ label, value, trend }: { label: string; value: string | number; trend?: number }) => (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 shadow-md border border-indigo-100 hover:shadow-lg transition-shadow">
      <div className="text-sm text-indigo-600 font-semibold mb-1">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">{value}</div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="ml-1">{Math.abs(trend).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-3xl font-bold mb-2">{player.full_name}</h2>
        <div className="flex items-center gap-2 text-blue-100">
          <Activity className="w-5 h-5" />
          <span>Last {gameLimit} Games - 2025-26 Season</span>
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

      {/* Points Trend */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border border-indigo-100">
        <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Scoring Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="PTS" stroke="#3b82f6" strokeWidth={2} name="Points" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Distribution */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border border-indigo-100">
        <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Per Game Stats</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" />
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
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-6 shadow-lg border border-indigo-100">
        <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Shooting Efficiency</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="game" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="FG_PCT" stroke="#8b5cf6" strokeWidth={2} name="FG%" />
            <Line type="monotone" dataKey="FG3_PCT" stroke="#ec4899" strokeWidth={2} name="3PT%" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Games Table */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-indigo-100 overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-4 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Recent Games</h3>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.GAME_DATE}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.MATCHUP}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold">{game.PTS}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{game.REB}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{game.AST}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{game.FGM}-{game.FGA}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{game.FG3M}-{game.FG3A}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-medium ${game.PLUS_MINUS >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
