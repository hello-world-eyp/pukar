import React from 'react';
import { Meld, Team } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { Shield, Sparkles, CheckCircle2, PlusCircle } from 'lucide-react';

export interface TableMeldBoardProps {
  melds?: {
    A: Meld[];
    B: Meld[];
  };
  teamAMelds?: Meld[];
  teamBMelds?: Meld[];
  activeTeam?: Team;
  selectedMeldId?: string | null;
  onSelectMeld?: (meld: Meld) => void;
  className?: string;
}

export const TableMeldBoard: React.FC<TableMeldBoardProps> = ({
  melds,
  teamAMelds,
  teamBMelds,
  activeTeam,
  selectedMeldId,
  onSelectMeld,
  className = '',
}) => {
  const listA = melds?.A ?? teamAMelds ?? [];
  const listB = melds?.B ?? teamBMelds ?? [];

  const calculateTeamPoints = (teamMelds: Meld[]) => {
    return teamMelds.reduce((sum, m) => sum + evaluateMeldScore(m).points, 0);
  };

  const scoreA = calculateTeamPoints(listA);
  const scoreB = calculateTeamPoints(listB);

  return (
    <div className={`w-full flex flex-col gap-5 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* TEAM A MELDS COLUMN */}
        <TeamMeldColumn
          team="A"
          teamName="Team A"
          teamColor="blue"
          melds={listA}
          score={scoreA}
          isActive={activeTeam === 'A'}
          selectedMeldId={selectedMeldId}
          onSelectMeld={onSelectMeld}
        />

        {/* TEAM B MELDS COLUMN */}
        <TeamMeldColumn
          team="B"
          teamName="Team B"
          teamColor="amber"
          melds={listB}
          score={scoreB}
          isActive={activeTeam === 'B'}
          selectedMeldId={selectedMeldId}
          onSelectMeld={onSelectMeld}
        />
      </div>
    </div>
  );
};

interface TeamMeldColumnProps {
  team: Team;
  teamName: string;
  teamColor: 'blue' | 'amber';
  melds: Meld[];
  score: number;
  isActive: boolean;
  selectedMeldId?: string | null;
  onSelectMeld?: (meld: Meld) => void;
}

const TeamMeldColumn: React.FC<TeamMeldColumnProps> = ({
  team,
  teamName,
  teamColor,
  melds,
  score,
  isActive,
  selectedMeldId,
  onSelectMeld,
}) => {
  const isBlue = teamColor === 'blue';

  const headerBorder = isBlue ? 'border-blue-500/30' : 'border-amber-500/30';
  const headerBg = isBlue ? 'bg-blue-950/40' : 'bg-amber-950/40';
  const headerTextColor = isBlue ? 'text-blue-400' : 'text-amber-400';
  const activeRing = isBlue ? 'ring-2 ring-blue-500/50' : 'ring-2 ring-amber-500/50';

  return (
    <div
      data-team={team}
      className={`rounded-2xl border ${headerBorder} bg-slate-900/80 p-4 flex flex-col gap-4 shadow-xl backdrop-blur-sm transition-all ${
        isActive ? activeRing : ''
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${headerBg} border ${headerBorder}`}
      >
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${headerTextColor}`} />
          <h3 className={`font-bold text-sm tracking-wide ${headerTextColor}`}>
            {teamName}
          </h3>
          {isActive && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
              Active Turn
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            {`${melds.length} ${melds.length === 1 ? 'meld' : 'melds'}`}
          </span>
          <span className="font-extrabold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
            {`${score} pts`}
          </span>
        </div>
      </div>

      {/* Melds List */}
      <div className="flex flex-col gap-3 min-h-[160px]">
        {melds.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs text-center">
            <p className="font-medium">No melds placed yet</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {`Melds placed by ${teamName} will appear here.`}
            </p>
          </div>
        ) : (
          melds.map((meld) => {
            const isSelected = selectedMeldId === meld.id;
            const evaluation = evaluateMeldScore(meld);

            return (
              <MeldCardItem
                key={meld.id}
                meld={meld}
                evaluation={evaluation}
                isSelected={isSelected}
                onSelect={() => onSelectMeld?.(meld)}
                canSelect={Boolean(onSelectMeld)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

interface MeldCardItemProps {
  meld: Meld;
  evaluation: ReturnType<typeof evaluateMeldScore>;
  isSelected: boolean;
  onSelect: () => void;
  canSelect: boolean;
}

const MeldCardItem: React.FC<MeldCardItemProps> = ({
  meld,
  evaluation,
  isSelected,
  onSelect,
  canSelect,
}) => {
  const { isComplete7, isPure13 } = evaluation;

  // Determine Badge Styling & Text
  let badgeText = '';
  let badgeClass = '';

  if (isPure13) {
    badgeText = 'Pure 2-A Run - 500 pts';
    badgeClass =
      'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-extrabold border-yellow-300 shadow-sm';
  } else if (isComplete7) {
    if (meld.type === 'RUN') {
      const isClean = !meld.cards.some(
        (c) => c.isNaturalJoker || c.rank === 0 || c.rank === 2
      );
      if (isClean) {
        badgeText = 'Clean Run - 200 pts';
        badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        badgeText = 'Dirty Run - 100 pts';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      }
    } else {
      const isClean = !meld.cards.some(
        (c) => c.isNaturalJoker || c.rank === 0 || c.rank === 2
      );
      if (isClean) {
        badgeText = 'Clean 7-of-a-Kind - 200 pts';
        badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        badgeText = 'Dirty 7-of-a-Kind - 100 pts';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      }
    }
  } else {
    // Incomplete
    badgeText = `${meld.type === 'RUN' ? 'Run' : 'Set'} - ${meld.cards.length} cards`;
    badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
  }

  // Map slots for represented ranks and wildcard metadata
  const slotMap = new Map(meld.slots.map((s) => [s.card.id, s]));

  return (
    <div
      onClick={canSelect ? onSelect : undefined}
      className={`relative group rounded-xl p-3 border transition-all ${
        canSelect ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80'
      }`}
    >
      {/* Meld Header Bar */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeClass}`}
          >
            {isPure13 && <Sparkles className="w-3 h-3 text-amber-900" />}
            {isComplete7 && !isPure13 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            <span>{badgeText}</span>
          </span>

          {meld.suit && (
            <span className="text-xs font-semibold text-slate-400">
              {meld.suit}
            </span>
          )}
        </div>

        {canSelect && (
          <div className="flex items-center gap-1 text-[11px]">
            {isSelected ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span>Selected to add</span>
              </span>
            ) : (
              <span className="text-slate-500 group-hover:text-slate-300 flex items-center gap-1 transition-colors">
                <PlusCircle className="w-3 h-3" />
                <span>Select</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sequential Cards Layout (Overlapping for compact fit) */}
      <div className="flex items-center overflow-x-auto py-2 px-1 scrollbar-thin">
        {meld.cards.map((card, index) => {
          const slot = slotMap.get(card.id);
          const isSlotWild = slot ? slot.isWildcard : undefined;
          let wildLabel: string | undefined = undefined;

          if (isSlotWild && slot) {
            const repRank = getRankLabel(slot.representedRank);
            const repSuit = getSuitSymbol(slot.representedSuit ?? meld.suit ?? card.suit);
            wildLabel = `Wild (${repRank}${repSuit})`;
          } else if (isSlotWild === false) {
            // Natural 2 that slid down
            wildLabel = undefined;
          }

          return (
            <div
              key={`${card.id}-${index}`}
              style={{
                marginLeft: index === 0 ? 0 : '-18px',
                zIndex: index + 1,
              }}
              className="relative transition-transform hover:-translate-y-2 hover:!z-30"
            >
              <PlayingCard
                card={card}
                size="sm"
                isWild={isSlotWild}
                representedRank={slot?.representedRank}
                representedSuit={slot?.representedSuit}
                wildcardLabel={wildLabel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
