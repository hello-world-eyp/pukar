import { useState } from 'react';
import { Meld } from '../../engine/types';
import { JokerOption } from '../../engine/meld-validator';

export interface JokerPromptData {
  isOpen: boolean;
  options: JokerOption[];
  cardIds: string[];
  targetMeldId?: string;
}

export function useGameModals() {
  const [isGodModeOpen, setIsGodModeOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [zoomedMeld, setZoomedMeld] = useState<Meld | null>(null);
  const [jokerPromptData, setJokerPromptData] = useState<JokerPromptData | null>(null);

  return {
    isGodModeOpen,
    setIsGodModeOpen,
    isDiscardModalOpen,
    setIsDiscardModalOpen,
    isRulesModalOpen,
    setIsRulesModalOpen,
    isSetupModalOpen,
    setIsSetupModalOpen,
    zoomedMeld,
    setZoomedMeld,
    jokerPromptData,
    setJokerPromptData,
  };
}
