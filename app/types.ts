export interface Player {
  id: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface Team {
  id: number;
  full_name: string;
  abbreviation: string;
  nickname: string;
  city: string;
  state: string;
  year_founded: number;
}

export interface GameStats {
  GAME_DATE: string;
  MATCHUP: string;
  WL?: string;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  FGM: number;
  FGA: number;
  FG_PCT: number;
  FG3M: number;
  FG3A: number;
  FG3_PCT: number;
  FTM: number;
  FTA: number;
  FT_PCT: number;
  PLUS_MINUS: number;
  MIN: string;
  PF: number;
  OPP_PTS?: number;
}

export interface PlayerGamesData {
  games: GameStats[];
  averages: {
    PTS: number;
    REB: number;
    AST: number;
    STL: number;
    BLK: number;
    TOV: number;
    FG_PCT: number;
    FG3_PCT: number;
    FT_PCT: number;
    PLUS_MINUS: number;
    MIN: number;
    [key: string]: number;
  };
  total_games: number;
  team?: string | null;
  jersey?: string | null;
}

export interface TeamGamesData {
  games: GameStats[];
  averages: {
    PTS: number;
    REB: number;
    AST: number;
    STL: number;
    BLK: number;
    TOV: number;
    FG_PCT: number;
    FG3_PCT: number;
    FT_PCT: number;
    PLUS_MINUS: number;
    OPP_PTS: number;
    DEF_RATING: number;
    WIN_PCT: number;
    [key: string]: number;
  };
  total_games: number;
  team_info: Team;
}

export type SearchResult = Player | Team;

export function isPlayer(result: SearchResult): result is Player {
  return 'full_name' in result && !('abbreviation' in result);
}

export function isTeam(result: SearchResult): result is Team {
  return 'abbreviation' in result;
}

// Live Game Types

export interface LiveTeamInfo {
  teamId: number;
  tricode: string;
  teamName: string;
  score: number;
  wins: number;
  losses: number;
}

export interface LiveGameInfo {
  gameId: string;
  status: number; // 1=scheduled, 2=in progress, 3=final
  statusText: string;
  period: number;
  clock: string;
  homeTeam: LiveTeamInfo;
  awayTeam: LiveTeamInfo;
  isHome: boolean;
}

export interface LivePlayerStats {
  name: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  plus_minus: number;
  fouls: number;
}

export interface LiveTeamStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
}

export interface LiveGameData {
  live: boolean;
  game?: LiveGameInfo;
  playerStats?: LivePlayerStats;
  teamStats?: LiveTeamStats;
  matchupHistory?: GameStats[];
  error?: string;
}
