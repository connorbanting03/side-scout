export interface Player {
  id: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface GameStats {
  GAME_DATE: string;
  MATCHUP: string;
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
