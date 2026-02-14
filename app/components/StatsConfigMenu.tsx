'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import Cookies from 'js-cookie';

export interface StatsConfig {
  // Player/Team Basic Stats
  ppg: boolean;
  rpg: boolean;
  apg: boolean;
  mpg: boolean;
  fgPct: boolean;
  fg3Pct: boolean;
  steals: boolean;
  blocks: boolean;
  plusMinus: boolean;
  fg3m: boolean;
  fgm: boolean;
  ftm: boolean;
  turnovers: boolean;
  
  // Team-specific
  oppPpg?: boolean;
  winPct?: boolean;
  
  // Charts
  scoringTrend: boolean;
  statsDistribution: boolean;
  shootingEfficiency: boolean;
  recentGamesTable: boolean;
  
  // Trends
  performanceTrends: boolean;
  
  // Live Game
  liveGame: boolean;
  
  // Display Options
  showStdDev: boolean;
}

const DEFAULT_CONFIG: StatsConfig = {
  ppg: true,
  rpg: true,
  apg: true,
  mpg: true,
  fgPct: true,
  fg3Pct: true,
  steals: true,
  blocks: true,
  plusMinus: true,
  fg3m: true,
  fgm: true,
  ftm: true,
  turnovers: true,
  oppPpg: true,
  winPct: true,
  scoringTrend: true,
  statsDistribution: false,
  shootingEfficiency: false,
  recentGamesTable: true,
  performanceTrends: true,
  liveGame: true,
  showStdDev: true,
};

interface StatsConfigMenuProps {
  isOpen: boolean;
  onClose: () => void;
  config: StatsConfig;
  onConfigChange: (config: StatsConfig) => void;
  isTeam?: boolean;
}

export default function StatsConfigMenu({ isOpen, onClose, config, onConfigChange, isTeam = false }: StatsConfigMenuProps) {
  const [localConfig, setLocalConfig] = useState<StatsConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof StatsConfig) => {
    const newConfig = { ...localConfig, [key]: !localConfig[key] };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleSelectAll = () => {
    const allTrue = Object.keys(localConfig).reduce((acc, key) => {
      acc[key as keyof StatsConfig] = true;
      return acc;
    }, {} as StatsConfig);
    setLocalConfig(allTrue);
    onConfigChange(allTrue);
  };

  const handleDeselectAll = () => {
    const allFalse = Object.keys(localConfig).reduce((acc, key) => {
      acc[key as keyof StatsConfig] = false;
      return acc;
    }, {} as StatsConfig);
    setLocalConfig(allFalse);
    onConfigChange(allFalse);
  };

  const CheckboxItem = ({ label, configKey }: { label: string; configKey: keyof StatsConfig }) => (
    <label className="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={localConfig[configKey] || false}
        onChange={() => handleToggle(configKey)}
        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-2xl max-h-[92vh] md:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 md:p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 md:w-6 md:h-6" />
            <h2 className="text-xl md:text-2xl font-bold">Stats Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(92vh-140px)] md:max-h-[calc(90vh-180px)]">
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-200 transition-colors text-sm"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors text-sm"
            >
              Deselect All
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Stats */}
            <div className="border-2 border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
              <h3 className="text-base md:text-lg font-bold text-indigo-900 mb-3">Basic Stats</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2">
                <CheckboxItem label="Points Per Game (PPG)" configKey="ppg" />
                <CheckboxItem label="Rebounds Per Game (RPG)" configKey="rpg" />
                <CheckboxItem label="Assists Per Game (APG)" configKey="apg" />
                <CheckboxItem label="Minutes Per Game (MPG)" configKey="mpg" />
                <CheckboxItem label="Field Goal %" configKey="fgPct" />
                <CheckboxItem label="3-Point %" configKey="fg3Pct" />
                <CheckboxItem label="Steals" configKey="steals" />
                <CheckboxItem label="Blocks" configKey="blocks" />
                <CheckboxItem label="Plus/Minus (+/-)" configKey="plusMinus" />
              </div>
            </div>

            {/* Additional Stats */}
            <div className="border-2 border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
              <h3 className="text-base md:text-lg font-bold text-indigo-900 mb-3">Additional Stats</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2">
                <CheckboxItem label="3-Pointers Made (3PM)" configKey="fg3m" />
                <CheckboxItem label="Field Goals Made (FGM)" configKey="fgm" />
                <CheckboxItem label="Free Throws Made (FTM)" configKey="ftm" />
                <CheckboxItem label="Turnovers" configKey="turnovers" />
                {isTeam && (
                  <>
                    <CheckboxItem label="Opponent PPG" configKey="oppPpg" />
                    <CheckboxItem label="Win Percentage" configKey="winPct" />
                  </>
                )}
              </div>
            </div>

            {/* Live Game */}
            <div className="border-2 border-red-100 rounded-xl p-4 bg-gradient-to-br from-red-50 to-orange-50">
              <h3 className="text-lg font-bold text-red-900 mb-3">🔴 Live Game</h3>
              <div className="grid grid-cols-1 gap-2">
                <CheckboxItem label="Live Game & Matchup History" configKey="liveGame" />
              </div>
            </div>

            {/* Charts & Visualizations */}
            <div className="border-2 border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
              <h3 className="text-lg font-bold text-indigo-900 mb-3">Charts & Visualizations</h3>
              <div className="grid grid-cols-1 gap-2">
                <CheckboxItem label="Performance Trends" configKey="performanceTrends" />
                <CheckboxItem label="Scoring Trend Chart" configKey="scoringTrend" />
                <CheckboxItem label="Stats Distribution Chart" configKey="statsDistribution" />
                <CheckboxItem label="Shooting Efficiency Chart" configKey="shootingEfficiency" />
                <CheckboxItem label="Recent Games Table" configKey="recentGamesTable" />
              </div>
            </div>

            {/* Display Options */}
            <div className="border-2 border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-blue-50">
              <h3 className="text-lg font-bold text-indigo-900 mb-3">Display Options</h3>
              <div className="grid grid-cols-1 gap-2">
                <CheckboxItem label="Show Standard Deviation (±SD)" configKey="showStdDev" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function useStatsConfig(storageKey: string = 'statsConfig'): [StatsConfig, (config: StatsConfig) => void] {
  const [config, setConfig] = useState<StatsConfig>(() => {
    // Initialize from cookies
    if (typeof window !== 'undefined') {
      const stored = Cookies.get(storageKey);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored config:', e);
        }
      }
    }
    return DEFAULT_CONFIG;
  });

  const updateConfig = (newConfig: StatsConfig) => {
    setConfig(newConfig);
    if (typeof window !== 'undefined') {
      // Store in cookies with 1 year expiration
      Cookies.set(storageKey, JSON.stringify(newConfig), { expires: 365 });
    }
  };

  return [config, updateConfig];
}
