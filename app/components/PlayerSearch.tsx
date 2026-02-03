'use client';

import { useState } from 'react';
import { Search, Users, User } from 'lucide-react';
import { Player, Team, SearchResult, isPlayer, isTeam } from '../types';

interface PlayerSearchProps {
  onSelectPlayer: (player: Player) => void;
  onSelectTeam: (team: Team) => void;
}

export default function PlayerSearch({ onSelectPlayer, onSelectTeam }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<Player[]>([]);
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'players' | 'teams'>('all');

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
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setPlayerResults([]);
      setTeamResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (player: Player) => {
    onSelectPlayer(player);
    setQuery('');
    setPlayerResults([]);
    setTeamResults([]);
    setShowResults(false);
  };

  const handleSelectTeam = (team: Team) => {
    onSelectTeam(team);
    setQuery('');
    setPlayerResults([]);
    setTeamResults([]);
    setShowResults(false);
  };

  const hasResults = playerResults.length > 0 || teamResults.length > 0;

  return (
    <div className="relative w-full max-w-md">
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
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 flex justify-between items-center border-b border-gray-100 transition-all"
                >
                  <div>
                    <span className="font-bold text-gray-900">{team.full_name}</span>
                    <span className="ml-2 text-xs text-gray-500">({team.abbreviation})</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {playerResults.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" /> Players ({playerResults.length})
                </span>
              </div>
              {playerResults.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-all"
                >
                  <span className="font-medium text-gray-900">{player.full_name}</span>
                  {player.is_active && (
                    <span className="text-xs bg-gradient-to-r from-emerald-500 to-green-500 text-white px-2 py-1 rounded-full font-semibold shadow-sm">Active</span>
                  )}
                </button>
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
