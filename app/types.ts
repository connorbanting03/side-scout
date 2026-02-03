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
