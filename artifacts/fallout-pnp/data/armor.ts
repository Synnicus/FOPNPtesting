import { Armor } from '@/context/types';

export const BUILT_IN_ARMOR: Armor[] = [
  // ─── Body Armor ─────────────────────────────────────────────
  { id: 'a_clothing', name: 'Clothing', slot: 'body', dtNormal: 0, dtBio: 0, dtEnergy: 0, isCustom: false },
  { id: 'a_leather', name: 'Leather Armor', slot: 'body', dtNormal: 2, dtBio: 1, dtEnergy: 1, isCustom: false },
  { id: 'a_metal', name: 'Metal Armor', slot: 'body', dtNormal: 4, dtBio: 2, dtEnergy: 2, isCustom: false },
  { id: 'a_combat', name: 'Combat Armor', slot: 'body', dtNormal: 6, dtBio: 3, dtEnergy: 4, isCustom: false },
  { id: 'a_tesla', name: 'Tesla Armor', slot: 'body', dtNormal: 4, dtBio: 2, dtEnergy: 8, isCustom: false },
  { id: 'a_power', name: 'Power Armor', slot: 'body', dtNormal: 10, dtBio: 6, dtEnergy: 8, isCustom: false },
  { id: 'a_adv_power', name: 'Advanced Power Armor', slot: 'body', dtNormal: 12, dtBio: 8, dtEnergy: 10, isCustom: false },

  // ─── Helmets ────────────────────────────────────────────────
  { id: 'a_none_head', name: 'No Helmet', slot: 'helmet', dtNormal: 0, dtBio: 0, dtEnergy: 0, isCustom: false },
  { id: 'a_leather_helm', name: 'Leather Helmet', slot: 'helmet', dtNormal: 1, dtBio: 0, dtEnergy: 0, isCustom: false },
  { id: 'a_metal_helm', name: 'Metal Helmet', slot: 'helmet', dtNormal: 2, dtBio: 1, dtEnergy: 1, isCustom: false },
  { id: 'a_combat_helm', name: 'Combat Helmet', slot: 'helmet', dtNormal: 3, dtBio: 1, dtEnergy: 2, isCustom: false },
  { id: 'a_power_helm', name: 'Power Helmet', slot: 'helmet', dtNormal: 5, dtBio: 3, dtEnergy: 4, isCustom: false },
];
