'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import PlayerSearch from './components/PlayerSearch';
import PlayerDashboard from './components/PlayerDashboard';
import TeamDashboard from './components/TeamDashboard';
import { Player, Team } from './types';

interface PlayerTab {
  type: 'player';
  player: Player;
  id: string;
}

interface TeamTab {
  type: 'team';
  team: Team;
  id: string;
}

type Tab = PlayerTab | TeamTab;

export default function Home() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [gameLimit, setGameLimit] = useState(10);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addPlayer = (player: Player) => {
    const tabId = `player-${player.id}`;
    
    // Check if player is already in tabs
    const existingTab = tabs.find(tab => tab.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
      return;
    }

    const newTab: PlayerTab = { type: 'player', player, id: tabId };
    setTabs([...tabs, newTab]);
    setActiveTab(tabId);
  };

  const addTeam = (team: Team) => {
    const tabId = `team-${team.id}`;
    
    // Check if team is already in tabs
    const existingTab = tabs.find(tab => tab.id === tabId);
    if (existingTab) {
      setActiveTab(tabId);
      return;
    }

    const newTab: TeamTab = { type: 'team', team, id: tabId };
    setTabs([...tabs, newTab]);
    setActiveTab(tabId);
  };

  const removeTab = (tabId: string) => {
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTab === tabId) {
      setActiveTab(newTabs.length > 0 ? newTabs[0].id : null);
    }
  };

  const activePlayer = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 border-b border-indigo-700 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">🏀 Side Scout</h1>
              <p className="text-sm text-white font-semibold drop-shadow">NBA Player Analytics Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-base text-white font-bold drop-shadow">Last</label>
              <select
                value={gameLimit}
                onChange={(e) => setGameLimit(Number(e.target.value))}
                className="px-4 py-2.5 bg-white border-2 border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg font-bold text-gray-900 text-base"
              >
                <option value={5}>5 games</option>
                <option value={10}>10 games</option>
                <option value={15}>15 games</option>
                <option value={20}>20 games</option>
                <option value={100}>Season</option>
              </select>
            </div>
          </div>
          <PlayerSearch onSelectPlayer={addPlayer} onSelectTeam={addTeam} />
        </div>
      </header>

      <div className="flex h-[calc(100vh-140px)] relative">
        {/* Sidebar with player tabs */}
        {tabs.length > 0 && (
          <aside className={`${
            sidebarCollapsed ? 'w-16' : 'w-72'
          } bg-gradient-to-b from-white to-slate-50 border-r-4 border-indigo-300 overflow-y-auto shadow-2xl transition-all duration-300 flex-shrink-0 relative`}>
            {/* Collapse button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="sticky top-2 left-full ml-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 shadow-lg transition-all z-20"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className="p-4">
              {!sidebarCollapsed && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                      Active Players
                    </h3>
                    {tabs.length > 0 && (
                      <button
                        onClick={() => {
                          setTabs([]);
                          setActiveTab(null);
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                        title="Clear all tabs"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {tabs.map(tab => {
                      const displayName = tab.type === 'player' ? tab.player.full_name : tab.team.full_name;
                      const badge = tab.type === 'team' ? tab.team.abbreviation : null;
                      
                      return (
                        <div
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                            activeTab === tab.id
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 border-2 border-indigo-600 text-white shadow-md transform scale-105'
                              : 'bg-white border-2 border-slate-200 hover:border-indigo-300 hover:shadow-md text-gray-700'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pointer-events-none">
                            <div className="font-medium text-sm truncate">{displayName}</div>
                            {badge && (
                              <div className="text-xs opacity-75 mt-0.5">{badge}</div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTab(tab.id);
                            }}
                            className={`ml-2 p-1 rounded hover:bg-black/10 flex-shrink-0 transition-colors ${
                              activeTab === tab.id ? 'text-white' : 'text-gray-500'
                            }`}
                            aria-label="Remove tab"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}


        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          <div className="max-w-7xl mx-auto p-8">
            {activeTab ? (
              tabs.find(tab => tab.id === activeTab)?.type === 'player' ? (
                <PlayerDashboard 
                  player={(tabs.find(tab => tab.id === activeTab) as PlayerTab).player} 
                  gameLimit={gameLimit} 
                />
              ) : (
                <TeamDashboard 
                  team={(tabs.find(tab => tab.id === activeTab) as TeamTab).team} 
                  gameLimit={gameLimit} 
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-white rounded-2xl p-12 shadow-xl border-2 border-indigo-100 max-w-md">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-4">Welcome to Side Scout</h2>
                  <p className="text-gray-700 mb-6 text-lg">
                    Search for NBA players or teams to view stats, trends, and performance analytics.
                  </p>
                  <div className="text-sm text-gray-600 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4">
                    <p className="mb-3 font-semibold text-indigo-700">Features:</p>
                    <ul className="text-left space-y-2 inline-block">
                      <li className="flex items-center gap-2"><span className="text-lg">📊</span> Comprehensive stats breakdown</li>
                      <li className="flex items-center gap-2"><span className="text-lg">📈</span> Performance trends and charts</li>
                      <li className="flex items-center gap-2"><span className="text-lg">🏀</span> Game-by-game analysis</li>
                      <li className="flex items-center gap-2"><span className="text-lg">📑</span> Multi-player/team comparison tabs</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
