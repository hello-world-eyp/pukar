/**
 * Match Analytics & Awards Engine
 * Pure TypeScript module with zero DOM dependencies.
 * Computes Match MVP, Biggest Heist (most Jokers stolen), Longest Sequence,
 * Cards Fed to Opponents, and score progression timelines.
 */
import {
  Card,
  MatchStats,
  Player,
  PlayerMatchStats,
  SanitizedPlayer,
  Team,
} from './types';

export function createInitialPlayerStats(): PlayerMatchStats {
  return {
    pointsContributed: 0,
    jokersStolen: 0,
    cardsFedToOpponents: 0,
    pukarsClaimed: 0,
    meldsCreated: 0,
  };
}

export function createInitialMatchStats(playerCount: 4 | 6): MatchStats {
  const playerStats: Record<number, PlayerMatchStats> = {};
  for (let i = 0; i < playerCount; i++) {
    playerStats[i] = createInitialPlayerStats();
  }
  return {
    playerStats,
    scoreTimeline: [{ round: 0, scoreA: 0, scoreB: 0 }],
  };
}

export interface MatchMVPAward {
  playerIndex: number;
  playerName: string;
  team: Team;
  compositeScore: number;
  pointsContributed: number;
  jokersStolen: number;
  pukarsClaimed: number;
  cardsFedToOpponents: number;
  meldsCreated: number;
}

/**
 * Calculates the Match MVP based on points, Joker heists, Pukar bonuses, and avoiding feeding opponents.
 * Prioritizes the winning team if one exists.
 */
export function calculateMatchMVP(
  stats?: MatchStats,
  players?: Array<Player | SanitizedPlayer>,
  winnerTeam?: Team | 'TIE' | null
): MatchMVPAward | null {
  if (!stats || !players || players.length === 0) return null;

  const candidates: MatchMVPAward[] = [];

  players.forEach((player, idx) => {
    const pStats = stats.playerStats[idx] || createInitialPlayerStats();
    // Formula: points contributed + 100 per Joker stolen + 75 per Pukar claimed - 25 per card fed to opponent
    const compositeScore =
      pStats.pointsContributed +
      pStats.jokersStolen * 100 +
      pStats.pukarsClaimed * 75 -
      pStats.cardsFedToOpponents * 25;

    candidates.push({
      playerIndex: idx,
      playerName: player.name || `Player ${idx + 1}`,
      team: player.team,
      compositeScore,
      pointsContributed: pStats.pointsContributed,
      jokersStolen: pStats.jokersStolen,
      pukarsClaimed: pStats.pukarsClaimed,
      cardsFedToOpponents: pStats.cardsFedToOpponents,
      meldsCreated: pStats.meldsCreated,
    });
  });

  if (candidates.length === 0) return null;

  // If there is an explicit winning team, filter to winning team candidates first
  if (winnerTeam && winnerTeam !== 'TIE') {
    const winningCandidates = candidates.filter((c) => c.team === winnerTeam);
    if (winningCandidates.length > 0) {
      winningCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
      return winningCandidates[0];
    }
  }

  // Otherwise, highest composite score overall
  candidates.sort((a, b) => b.compositeScore - a.compositeScore);
  return candidates[0] || null;
}

export interface HeistAward {
  playerIndex: number;
  playerName: string;
  team: Team;
  jokersStolen: number;
}

/**
 * Awards player who snatched the most Natural Jokers from table sequences.
 */
export function getBiggestHeistAward(
  stats?: MatchStats,
  players?: Array<Player | SanitizedPlayer>
): HeistAward | null {
  if (!stats || !players || players.length === 0) return null;

  let best: HeistAward | null = null;

  players.forEach((player, idx) => {
    const pStats = stats.playerStats[idx];
    const stolen = pStats?.jokersStolen ?? 0;
    if (stolen > 0 && (!best || stolen > best.jokersStolen)) {
      best = {
        playerIndex: idx,
        playerName: player.name || `Player ${idx + 1}`,
        team: player.team,
        jokersStolen: stolen,
      };
    }
  });

  return best;
}

export interface FeederAward {
  playerIndex: number;
  playerName: string;
  team: Team;
  cardsFed: number;
}

/**
 * Awards player who fed the most discards to opposing players.
 */
export function getChiefFeederAward(
  stats?: MatchStats,
  players?: Array<Player | SanitizedPlayer>
): FeederAward | null {
  if (!stats || !players || players.length === 0) return null;

  let topFeeder: FeederAward | null = null;

  players.forEach((player, idx) => {
    const pStats = stats.playerStats[idx];
    const fed = pStats?.cardsFedToOpponents ?? 0;
    if (fed > 0 && (!topFeeder || fed > topFeeder.cardsFed)) {
      topFeeder = {
        playerIndex: idx,
        playerName: player.name || `Player ${idx + 1}`,
        team: player.team,
        cardsFed: fed,
      };
    }
  });

  return topFeeder;
}

/**
 * Formats a clean descriptive label for a run sequence (e.g. "9-Card Spades Run" or "13-Card Pure Run").
 */
export function describeSequence(cards: Card[]): string {
  const count = cards.length;
  const nonWildcard = cards.find((c) => c.suit !== null && c.rank !== 2 && c.rank !== 0);
  const suitName = nonWildcard?.suit
    ? nonWildcard.suit.charAt(0).toUpperCase() + nonWildcard.suit.slice(1).toLowerCase()
    : 'Mixed';
  return `${count}-Card ${suitName} Run`;
}
