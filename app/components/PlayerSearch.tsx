'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Users, User, Plus } from 'lucide-react';
import { Player, Team, SearchResult, isPlayer, isTeam } from '../types';

interface PlayerSearchProps {
  onSelectPlayer: (player: Player) => void;
  onSelectTeam: (team: Team) => void;
}

export default function PlayerSearch({ onSelectPlayer, onSelectTeam }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [teamPlayersMap, setTeamPlayersMap] = useState<Map<number, Player[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'players' | 'teams'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const searchAll = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setPlayerResults([]);
      setTeamResults([]);
      return;
    }

    setLoading(true);
    try {
      const promises = [];
      
      if (searchType === 'all' || searchType === 'players') {
        promises.push(
          fetch(`http://localhost:5000/api/player/search?name=${encodeURIComponent(searchQuery)}`)
            .then(res => res.json())
            .then(data => data.players || [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (searchType === 'all' || searchType === 'teams') {
        promises.push(
          fetch(`http://localhost:5000/api/team/search?name=${encodeURIComponent(searchQuery)}`)
            .then(res => res.json())
            .then(data => data.teams || [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      const [players, teams] = await Promise.all(promises);
      
      setPlayerResults(players);
      setTeamResults(teams);
      
      // Fetch players for each team found
      if (teams.length > 0) {
        const teamPlayersPromises = teams.map(async (team: Team) => {
          try {
            const response = await fetch(`http://localhost:5000/api/team/${team.id}/players`);
            const data = await response.json();
            return { teamId: team.id, players: data.players || [] };
          } catch (error) {
            console.error(`Error fetching players for team ${team.id}:`, error);
            return { teamId: team.id, players: [] };
          }
        });
        
        const teamPlayersResults = await Promise.all(teamPlayersPromises);
        const newTeamPlayersMap = new Map();
        teamPlayersResults.forEach(({ teamId, players }) => {
          newTeamPlayersMap.set(teamId, players);
        });
        setTeamPlayersMap(newTeamPlayersMap);
      } else {
        setTeamPlayersMap(new Map());
      }
      
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setPlayerResults([]);
      setTeamResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (player: Player, keepOpen: boolean = false) => {
    onSelectPlayer(player);
    if (!keepOpen) {
      setQuery('');
      setPlayerResults([]);
      setTeamResults([]);
      setTeamPlayersMap(new Map());
      setShowResults(false);
    }
  };

  const handleSelectTeam = (team: Team, keepOpen: boolean = false) => {
    onSelectTeam(team);
    if (!keepOpen) {
      setQuery('');
      setPlayerResults([]);
      setTeamResults([]);
      setTeamPlayersMap(new Map());
      setShowResults(false);
    }
  };

  const hasResults = playerResults.length > 0 || teamResults.length > 0;

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setSearchType('all')}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
            searchType === 'all' 
              ? 'bg-white text-indigo-600 shadow-md' 
              : 'bg-white/50 text-white hover:bg-white/70'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setSearchType('players')}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
            searchType === 'players' 
              ? 'bg-white text-indigo-600 shadow-md' 
              : 'bg-white/50 text-white hover:bg-white/70'
          }`}
        >
          <User className="w-3 h-3" /> Players
        </button>
        <button
          onClick={() => setSearchType('teams')}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
            searchType === 'teams' 
              ? 'bg-white text-indigo-600 shadow-md' 
              : 'bg-white/50 text-white hover:bg-white/70'
          }`}
        >
          <Users className="w-3 h-3" /> Teams
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            searchAll(e.target.value);
          }}
          onFocus={() => hasResults && setShowResults(true)}
          placeholder={`Search ${searchType === 'all' ? 'players & teams' : searchType}...`}
          className="w-full pl-10 pr-4 py-3.5 rounded-lg bg-white border-2 border-white focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg placeholder-gray-400 text-gray-900 font-semibold text-base"
        />
      </div>

      {showResults && hasResults && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-2xl border border-indigo-200 max-h-96 overflow-y-auto">
          {teamResults.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-200 sticky top-0">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" /> Teams ({teamResults.length})
                </span>
              </div>
              {teamResults.map((team) => (
                <div
                  key={team.id}
                  className="w-full px-4 py-3 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 flex justify-between items-center border-b border-gray-100 transition-all group"
                >
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleSelectTeam(team)}
                  >
                    <span className="font-bold text-gray-900">{team.full_name}</span>
                    <span className="ml-2 text-xs text-gray-500">({team.abbreviation})</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTeam(team, true);
                    }}
                    className="ml-2 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Add to list"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Show team players sections */}
          {teamResults.map((team) => {
            const teamPlayers = teamPlayersMap.get(team.id) || [];
            if (teamPlayers.length === 0) return null;
            
            return (
              <div key={`team-players-${team.id}`}>
                <div className="px-4 py-2 bg-blue-50/50 border-t border-indigo-200 sticky top-0">
                  <span className="text-xs text-gray-600 font-bold italic">
                    {team.abbreviation} Roster ({teamPlayers.length} players)
                  </span>
                </div>
                {teamPlayers.map((player) => (
                  <div
                    key={`team-player-${team.id}-${player.id}`}
                    className="w-full px-6 py-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 flex justify-between items-center border-b border-gray-100 transition-all group"
                  >
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSelectPlayer(player)}
                    >
                      <span className="font-medium text-gray-800 text-sm">{player.full_name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPlayer(player, true);
                      }}
                      className="ml-2 p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                      title="Add to list"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          
          {playerResults.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" /> Players ({playerResults.length})
                </span>
              </div>
              {playerResults.map((player) => (
                <div
                  key={player.id}
                  className="w-full px-4 py-3 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-all group"
                >
                  <div 
                    className="flex-1 cursor-pointer flex items-center justify-between"
                    onClick={() => handleSelectPlayer(player)}
                  >
                    <span className="font-medium text-gray-900">{player.full_name}</span>
                    {player.is_active && (
                      <span className="text-xs bg-gradient-to-r from-emerald-500 to-green-500 text-white px-2 py-1 rounded-full font-semibold shadow-sm">Active</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlayer(player, true);
                    }}
                    className="ml-2 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    title="Add to list"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500">
          Searching...
        </div>
      )}
    </div>
  );
}
