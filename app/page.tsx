'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Menu, TrendingUp, Activity, Target, Users } from 'lucide-react';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 border-b border-indigo-700 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-4">
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <div className="min-w-0 flex items-center">
              <img src="/logo.png" alt="" className="h-14 w-auto md:h-14 drop-shadow-lg flex-shrink-0" />
              <div className="-ml-5 md:ml-0 md:pl-2">
                <h1 className="text-xl md:text-3xl font-bold text-white drop-shadow-lg leading-tight">Side Scout</h1>
                <p className="text-xs md:text-sm text-white font-semibold drop-shadow hidden sm:block">NBA Stats Tracking & Live Game Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <label className="text-sm md:text-base text-white font-bold drop-shadow">Last</label>
              <select
                value={gameLimit}
                onChange={(e) => setGameLimit(Number(e.target.value))}
                className="px-2 md:px-4 py-2 md:py-2.5 bg-white border-2 border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg font-bold text-gray-900 text-sm md:text-base"
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

      <div className="flex h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] relative">
        {/* Mobile sidebar backdrop */}
        {tabs.length > 0 && mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Mobile floating toggle button */}
        {tabs.length > 0 && (
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="fixed bottom-5 left-4 z-50 md:hidden bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-lg">{tabs.length}</span>
          </button>
        )}

        {/* Desktop collapse button */}
        {tabs.length > 0 && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:block fixed left-0 top-36 bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-full p-2 shadow-lg transition-all z-50"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}

        {/* Sidebar with player tabs */}
        {tabs.length > 0 && (
          <aside className={`fixed top-0 bottom-0 left-0 z-40 w-[280px] transform transition-all duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:z-auto ${sidebarCollapsed ? 'md:w-16' : 'md:w-72'} bg-gradient-to-b from-white to-slate-50 border-r-4 border-indigo-300 overflow-y-auto shadow-2xl flex-shrink-0`}>

            <div className="px-4 pt-10 pb-24 md:py-4">
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
                          setMobileSidebarOpen(false);
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
                          onClick={() => { setActiveTab(tab.id); setMobileSidebarOpen(false); }}
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
          <div className="max-w-7xl mx-auto p-3 md:p-8">
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
              <div className="flex flex-col items-center justify-center h-full">
                <div className="max-w-xl w-full mx-4 md:mx-0">
                  {/* Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-10 md:mb-12">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Trend Analysis</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Track performance patterns across any game range</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Live Game Tracking</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Real-time stats and updates during games</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Matchup History</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Head-to-head stats and shooting splits</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Multi-Player Compare</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Analyze multiple players side-by-side</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Performance Insights</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Understand exactly how players are trending</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-0.5">Parlay Confidence</h3>
                        <p className="text-xs md:text-sm text-gray-500 leading-relaxed">Make informed decisions before placing bets</p>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="text-center">
                    <p className="text-xs md:text-sm text-gray-400 font-medium">
                      Search a player or team above to get started
                    </p>
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
