import type { WeaponCategory } from '../context/types.ts';

export type ManualCatalogDestination =
  | {
      screen: 'equipment';
      label: string;
      tab: 'weapons' | 'armor' | 'ammo';
      category?: WeaponCategory | 'all';
    }
  | {
      screen: 'bestiary';
      label: string;
      search?: string;
      allEntries?: boolean;
    };

const MANUAL_CATALOG_LINKS: Record<string, ManualCatalogDestination[]> = {
  'race-overview': [
    { screen: 'bestiary', label: 'Deathclaw', search: 'Deathclaw' },
    { screen: 'bestiary', label: 'Dog', search: 'Dog' },
    { screen: 'bestiary', label: 'Super Mutant', search: 'Super Mutant' },
  ],
  'bestiary-catalog-link': [
    { screen: 'bestiary', label: 'All creatures', allEntries: true },
  ],
  'equipment-weapons-rules': [
    { screen: 'equipment', label: 'Weapons', tab: 'weapons', category: 'all' },
    { screen: 'equipment', label: 'Ammunition', tab: 'ammo' },
  ],
  'equipment-hazards': [
    { screen: 'equipment', label: 'Mines & traps', tab: 'weapons', category: 'minesTraps' },
  ],
  'equipment-armor-rules': [
    { screen: 'equipment', label: 'Armor & helmets', tab: 'armor' },
  ],
};

export function getManualCatalogDestinations(ruleId: string): ManualCatalogDestination[] {
  return MANUAL_CATALOG_LINKS[ruleId] ?? [];
}
