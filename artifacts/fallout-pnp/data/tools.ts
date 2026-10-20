export interface ToolProfile {
  id: string;
  name: string;
  weight?: number;
}

/** Non-weapon, non-armor equipment listed in Part VI of the manual. */
export const BUILT_IN_TOOLS: ToolProfile[] = [
  { id: 'flare', name: 'Flare', weight: 1 },
  { id: 'lighter', name: 'Lighter', weight: 1 },
  { id: 'flashlight', name: 'Flashlight', weight: 1 },
  { id: 'rope', name: 'Rope', weight: 10 },
  { id: 'shovel', name: 'Shovel', weight: 15 },
  { id: 'claw_hammer', name: 'Claw Hammer', weight: 4 },
  { id: 'lockpick', name: 'Lockpick', weight: 1 },
  { id: 'tool_set', name: 'Tool Set', weight: 15 },
  { id: 'boots', name: 'Boots', weight: 5 },
  { id: 'scalpel', name: 'Scalpel', weight: 1 },
  { id: 'gas_mask', name: 'Gas Mask', weight: 3 },
  { id: 'expanded_lockpick_set', name: 'Expanded Lockpick Set', weight: 1 },
  { id: 'safecracking_kit', name: 'Safecracking Kit', weight: 5 },
  { id: 'electronic_lockpick', name: 'Electronic Lockpick', weight: 3 },
  { id: 'dynamite' , name: 'Dynamite' },
  { id: 'medical_kit', name: 'Medical Kit', weight: 4 },
  { id: 'geiger_counter', name: 'Geiger Counter', weight: 5 },
  { id: 'plastique', name: 'Plastique (C-14 Plastic Explosive)', weight: 2 },
  { id: 'doctors_bag', name: "Doctor's Bag", weight: 10 },
  { id: 'electronic_lockpick_mk_ii', name: 'Electronic Lockpick Mark II', weight: 5 },
  { id: 'vehicle_repair_kit', name: 'Vehicle Repair Kit', weight: 20 },
];
