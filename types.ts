
export type DieType = 'hope' | 'fear';
export type StandardDieType = 4 | 6 | 8 | 10 | 12 | 20;

export type RollOutcome = 'hope' | 'fear' | 'critical' | 'standard';
export type RollMode = 'sheet' | 'abilities' | 'inventory' | 'duality' | 'standard' | 'notes';
export type RollLogic = 'sum' | 'keepHighest' | 'keepLowest';

export interface Experience {
  id: string;
  name: string;
  value: string;
}

export interface Ability {
  id: string;
  name: string;
  domain: string;
  cost: string;
  description: string;
  type: string;
  origin: string;
  castingFocus: string; // Foco de Conjuração
}

export type InventoryItemType = 'weapon_main' | 'weapon_sec' | 'armor' | 'general';

export interface InventoryItem {
  id: string;
  type: InventoryItemType;
  name: string;
  description: string;
  
  // Weapon Specific
  damage: string;
  attribute: string;
  ability: string; // Habilidade/Característica da arma
  
  // Armor Specific
  evasion: string;
  threshold: string;
  special: string;
}

export interface CharacterData {
  name: string;
  photo?: string; // Base64 string for character image
  ancestry1: string; // Ancestralidade Primária
  ancestry2: string; // Ancestralidade Secundária (Mista)
  class: string;
  subclass: string;
  level: number;
  proficiency: number;
  evasion: number; // Valor de Evasão
  hp: { current: number; max: number };
  fatigue: { current: number; max: number };
  hope: { current: number; max: number }; // Pontos de Esperança
  armor: {
    value: number; // Valor da Armadura (Redução)
    slots: { current: number; max: number }; // Slots de Armadura
  };
  thresholds: {
    major: number; // Limiar Maior
    severe: number; // Limiar Severo
  };
  attributes: {
    agility: number; // Agilidade
    strength: number; // Força
    finesse: number; // Acuidade
    instinct: number; // Instinto
    presence: number; // Presença
    knowledge: number; // Conhecimento
  };
  experiences: Experience[];
  abilities: Ability[];
  inventory: InventoryItem[];
}

export interface RollResult {
  id: string;
  timestamp: number;
  mode: RollMode;
  
  // Common
  modifier: number;
  total: number;
  
  // Duality Specific
  hopeValue?: number;
  fearValue?: number;
  outcome?: RollOutcome;

  // Standard Specific
  diceCount?: number;
  dieType?: StandardDieType;
  rolls?: number[]; // Individual results of standard dice
  rollLogic?: RollLogic; // Logic used for calculation
}