'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Users, User, Plus, X, Loader2 } from 'lucide-react';
import { Player, Team } from '../types';
import { API_BASE_URL } from '../lib/config';

interface PlayerSearchProps {
  onSelectPlayer: (player: Player) => void;
  onSelectTeam: (team: Team) => void;
}

// ---- Directory cache (loaded once, used for all searches) ----
interface Directory {
  players: Player[];
  teams: Team[];
  rosters: Record<string, Player[]>; // keyed by team_id
}

let directoryPromise: Promise<Directory> | null = null;
let cachedDirectory: Directory | null = null;

function loadDirectory(): Promise<Directory> {
  if (cachedDirectory) return Promise.resolve(cachedDirectory);
  if (directoryPromise) return directoryPromise;

  directoryPromise = fetch(`${API_BASE_URL}/api/directory`)
    .then(res => res.json())
    .then((data: Directory) => {
      cachedDirectory = data;
      return data;
    })
    .catch(err => {
      console.error('Failed to load directory:', err);
      directoryPromise = null; // Allow retry
      return { players: [], teams: [], rosters: {} } as Directory;
    });

  return directoryPromise;
}

export default function PlayerSearch({ onSelectPlayer, onSelectTeam }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<Directory | null>(cachedDirectory);
  const [dirLoading, setDirLoading] = useState(!cachedDirectory);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'players' | 'teams'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Load directory once on mount
  useEffect(() => {
    let cancelled = false;
    if (!cachedDirectory) {
      loadDirectory().then(dir => {
        if (!cancelled) {
          setDirectory(dir);
          setDirLoading(false);
        }
      });
    }
    return () => { cancelled = true; };
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- CLIENT-SIDE filtering (no API calls!) ----
  const { playerResults, teamResults } = useMemo(() => {
    if (!directory || query.length < 2) {
      return { playerResults: [] as Player[], teamResults: [] as Team[] };
    }

    const q = query.toLowerCase();

    let players: Player[] = [];
    let teams: Team[] = [];

    if (searchType === 'all' || searchType === 'players') {
      players = directory.players
        .filter(p => p.full_name.toLowerCase().includes(q))
        .slice(0, 25); // Cap results for performance
    }

    if (searchType === 'all' || searchType === 'teams') {
      teams = directory.teams.filter(t =>
        t.full_name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.nickname.toLowerCase().includes(q) ||
        t.abbreviation.toLowerCase().includes(q)
      );
    }

    return { playerResults: players, teamResults: teams };
  }, [directory, query, searchType]);

  // Get roster for a team from cached directory (no API call)
  const getTeamPlayers = (teamId: number): Player[] => {
    if (!directory) return [];
    return directory.rosters[String(teamId)] || [];
  };

  const handleSelectPlayer = (player: Player, keepOpen: boolean = false) => {
    onSelectPlayer(player);
    if (!keepOpen) {
      setQuery('');
      setShowResults(false);
    }
  };

  const handleSelectTeam = (team: Team, keepOpen: boolean = false) => {
    onSelectTeam(team);
    if (!keepOpen) {
      setQuery('');
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
            if (e.target.value.length >= 2) setShowResults(true);
          }}
          onFocus={() => {
            if (query.length >= 2 && hasResults) setShowResults(true);
          }}
          placeholder={
            dirLoading
              ? 'Loading player directory...'
              : `Search ${searchType === 'all' ? 'players & teams' : searchType}...`
          }
          disabled={dirLoading}
          className="w-full pl-10 pr-12 py-2.5 md:py-3.5 rounded-lg bg-white border-2 border-white focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg placeholder-gray-400 text-gray-900 font-semibold text-sm md:text-base disabled:opacity-60"
        />
        {dirLoading && (
          <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-indigo-400 w-4 h-4 animate-spin" />
        )}
        {query && !dirLoading && (
          <button
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && hasResults && (
        <div className="absolute z-20 w-full mt-1 md:mt-2 bg-white rounded-lg shadow-2xl border border-indigo-200 max-h-[65vh] md:max-h-96 overflow-y-auto">
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
                    className="ml-2 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title="Add to list"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Show team players sections (from cached directory - no API call) */}
          {teamResults.map((team) => {
            const teamPlayers = getTeamPlayers(team.id);
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
                      className="ml-2 p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
                    className="ml-2 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
    </div>
  );
}
