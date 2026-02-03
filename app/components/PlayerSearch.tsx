'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Player } from '../types';

interface PlayerSearchProps {
  onSelectPlayer: (player: Player) => void;
}

export default function PlayerSearch({ onSelectPlayer }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchPlayers = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/player/search?name=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResults(data.players || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = (player: Player) => {
    onSelectPlayer(player);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            searchPlayers(e.target.value);
          }}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search NBA players..."
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/90 backdrop-blur border-0 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-md placeholder-blue-300 text-gray-900 font-medium"
        />
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-2xl border border-indigo-200 max-h-96 overflow-y-auto">
          {results.map((player) => (
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

      {loading && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500">
          Searching...
        </div>
      )}
    </div>
  );
}
