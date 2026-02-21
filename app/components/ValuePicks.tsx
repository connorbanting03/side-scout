'use client';

import { useState, useEffect } from 'react';
import { Flame, Target, TrendingUp, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';

interface StatDetail {
  recent_avg: number;
  season_avg: number;
  baseline_avg: number;
  trend_diff: number;
  trend_pct: number;
  recent_std: number;
  cv: number;
}

interface ValuePick {
  rank: number;
  player_id: string;
  name: string;
  team: string;
  total_games: number;
  category: 'value' | 'consistent';
  value_score: number;
  consistency_score: number;
  best_trending_stat: string | null;
  top_trending_stats: string[];
  stats: {
    PTS: StatDetail;
    REB: StatDetail;
    AST: StatDetail;
    FG3M: StatDetail;
    PRA: StatDetail;
    STL: StatDetail;
    BLK: StatDetail;
  };
}

interface WindowData {
  best_value: ValuePick[];
  most_consistent: ValuePick[];
}

interface ValuePicksData {
  generated_at: string;
  min_games: number;
  windows: Record<string, WindowData>;
}

interface ValuePicksProps {
  onPlayerClick?: (playerId: string, playerName: string) => void;
  gameLimit: number;
}

const STAT_LABELS: Record<string, string> = {
  PTS: 'Points',
  REB: 'Rebounds',
  AST: 'Assists',
  FG3M: '3PM',
  PRA: 'PTS+REB+AST',
  STL: 'Steals',
  BLK: 'Blocks',
};

const STAT_SHORT: Record<string, string> = {
  PTS: 'PTS',
  REB: 'REB',
  AST: 'AST',
  FG3M: '3PM',
  PRA: 'PRA',
  STL: 'STL',
  BLK: 'BLK',
};

function formatTrend(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function StatBadge({ stat, detail }: { stat: string; detail: StatDetail }) {
  const isUp = detail.trend_diff > 0;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
      isUp 
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
        : 'bg-slate-50 text-slate-500 border border-slate-200'
    }`}>
      <span>{STAT_SHORT[stat]}</span>
      <span className="font-display text-sm">{detail.recent_avg}</span>
      {isUp && <TrendingUp className="w-3 h-3" />}
    </div>
  );
}

function PickCard({ pick, type, gameLimit, onPlayerClick }: { 
  pick: ValuePick; 
  type: 'value' | 'consistent';
  gameLimit: number;
  onPlayerClick?: (playerId: string, playerName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Dynamic window label: L5, L10, L20, or Season
  const windowLabel = gameLimit >= 100 ? 'Season' : `L${gameLimit}`;

  // Sort top_trending_stats so the card always shows highest trend first
  const topStats = pick.top_trending_stats ?? ['PTS', 'REB', 'AST'];

  return (
    <div
      className="bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-3 md:p-4">
        <div className="flex items-start justify-between mb-2">
          <div
            className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onPlayerClick?.(pick.player_id, pick.name)}
          >
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black text-white ${
              type === 'value'
                ? 'bg-gradient-to-br from-orange-500 to-red-500'
                : 'bg-gradient-to-br from-blue-500 to-indigo-500'
            }`}>
              {pick.rank}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base md:text-lg font-bold text-gray-900 truncate leading-tight">
                {pick.name}
              </h3>
              <span className="text-xs font-semibold text-gray-400">{pick.team}</span>
            </div>
          </div>
          {type === 'value' && pick.best_trending_stat && (
            <div className="flex-shrink-0 ml-2 px-2 py-0.5 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                {STAT_LABELS[pick.best_trending_stat]} ↑
              </span>
            </div>
          )}
          {type === 'consistent' && (
            <div className="flex-shrink-0 ml-2 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                CV {pick.consistency_score.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Top trending stat badges — dynamic, sorted by trend */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {topStats.map(stat => (
            pick.stats[stat as keyof typeof pick.stats] && (
              <StatBadge key={stat} stat={stat} detail={pick.stats[stat as keyof typeof pick.stats]} />
            )
          ))}
        </div>

        {/* PRA combo line */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-gray-500">
            <BarChart3 className="w-3 h-3" />
            <span>PRA: <span className="font-display font-bold text-gray-800">{pick.stats.PRA.recent_avg}</span></span>
            <span className={`font-bold ${pick.stats.PRA.trend_diff > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              ({formatTrend(pick.stats.PRA.trend_pct)})
            </span>
          </div>
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
          >
            {expanded ? 'Less' : 'Details'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t-2 border-slate-100 bg-slate-50 px-3 md:px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 font-semibold uppercase tracking-wider">
                <th className="text-left pb-1.5">Stat</th>
                <th className="text-right pb-1.5">{windowLabel}</th>
                <th className="text-right pb-1.5">Season</th>
                <th className="text-right pb-1.5">Trend</th>
                <th className="text-right pb-1.5">Std Dev</th>
                <th className="text-right pb-1.5">CV</th>
              </tr>
            </thead>
            <tbody className="font-display">
              {(['PTS', 'REB', 'AST', 'FG3M', 'PRA', 'STL', 'BLK'] as const).map(stat => {
                const d = pick.stats[stat];
                if (!d || (d.recent_avg < 0.5 && stat !== 'PRA')) return null;
                return (
                  <tr key={stat} className="border-t border-slate-200">
                    <td className="py-1 font-sans font-semibold text-gray-600">{STAT_SHORT[stat]}</td>
                    <td className="py-1 text-right font-bold text-gray-900">{d.recent_avg}</td>
                    <td className="py-1 text-right text-gray-500">{d.season_avg}</td>
                    <td className={`py-1 text-right font-bold ${d.trend_diff > 0 ? 'text-emerald-600' : d.trend_diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {formatTrend(d.trend_pct)}
                    </td>
                    <td className="py-1 text-right text-gray-500">{d.recent_std}</td>
                    <td className={`py-1 text-right font-bold ${d.cv < 0.3 ? 'text-blue-600' : d.cv < 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                      {d.cv < 90 ? d.cv.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">
            CV (Coefficient of Variation) = Std Dev ÷ Mean — lower = more consistent.
            {windowLabel} = Last {gameLimit >= 100 ? 'full season' : `${gameLimit} games`}. Trend = {windowLabel} vs rest of season.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ValuePicks({ onPlayerClick, gameLimit }: ValuePicksProps) {
  const [data, setData] = useState<ValuePicksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'value' | 'consistent'>('value');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/value-picks`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Value picks load error:', err);
        setError('Could not load value picks');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-slate-200 rounded-lg w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl border-2 border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently hide if no data available
  }

  const windowKey = gameLimit >= 100 ? 'season' : String(gameLimit);
  const windowData = data.windows[windowKey] ?? data.windows['10'] ?? { best_value: [], most_consistent: [] };
  const picks = activeSection === 'value' ? windowData.best_value : windowData.most_consistent;

  return (
    <div className="w-full">
      {/* Section toggle */}
      <div className="flex flex-col items-center gap-3 mb-4">
        <div className="flex bg-slate-100 rounded-xl p-1 border-2 border-slate-200">
          <button
            onClick={() => setActiveSection('value')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
              activeSection === 'value'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Flame className="w-4 h-4" />
            Best Value
          </button>
          <button
            onClick={() => setActiveSection('consistent')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
              activeSection === 'consistent'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target className="w-4 h-4" />
            Most Consistent
          </button>
        </div>
        <p className="text-xs text-gray-400 font-medium">
          {gameLimit >= 100 ? 'Full season performance' : `Last ${gameLimit} games vs season avg`} • Min {data.min_games} GP
        </p>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 text-center">
        {activeSection === 'value'
          ? gameLimit >= 100
            ? "🔥 Season's best volume performers weighted by consistency — the most bankable full-season bets."
            : `🔥 Players trending up over the last ${gameLimit} games with low variance — hot AND reliable.`
          : gameLimit >= 100
            ? '🎯 Lowest CV over the full season — the most reliably consistent player props.'
            : `🎯 Lowest CV over the last ${gameLimit} games across PTS, REB, AST — most predictable props.`}
      </p>

      {/* Cards — independent columns on desktop so expanding one card doesn't push others */}
      {/* Mobile: single column stack */}
      <div className="md:hidden flex flex-col gap-3">
        {picks.map(pick => (
          <PickCard
            key={pick.player_id}
            pick={pick}
            type={activeSection}
            gameLimit={gameLimit}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </div>
      {/* Desktop: 3 independent flex columns (masonry-style) */}
      <div className="hidden md:flex gap-3 items-start">
        {[0, 1, 2].map(col => (
          <div key={col} className="flex-1 flex flex-col gap-3">
            {picks
              .filter((_, i) => i % 3 === col)
              .map(pick => (
                <PickCard
                  key={pick.player_id}
                  pick={pick}
                  type={activeSection}
                  gameLimit={gameLimit}
                  onPlayerClick={onPlayerClick}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
