export type AppTourRoute =
  | '/(tabs)'
  | '/(tabs)/characters'
  | '/(tabs)/bestiary'
  | '/(tabs)/equipment'
  | '/(tabs)/campaign';

export interface AppTourStep {
  body: string;
}

export interface AppTourTopic {
  id: string;
  title: string;
  routes: { label: string; path: AppTourRoute }[];
  steps: AppTourStep[];
}

export const APP_TOUR_TOPICS: AppTourTopic[] = [
  {
    id: 'first-combat',
    title: 'Character Creation & Combat',
    routes: [
      { label: 'OPEN CHARACTERS', path: '/(tabs)/characters' },
      { label: 'OPEN BESTIARY', path: '/(tabs)/bestiary' },
      { label: 'OPEN COMBAT', path: '/(tabs)' },
    ],
    steps: [
      { body: 'Open Characters. Choose New Character to build a player character, or pick a premade character to get started quickly.' },
      { body: 'In the creator, set the character concept and race, then work through traits, SPECIAL, skills, equipment, and perks. Save to add the character to this campaign.' },
      { body: 'Open Bestiary, search or browse for an opponent, inspect its entry, then press Spawn. The NPC appears in the campaign character list.' },
      { body: 'Open Combat and choose the player character as attacker and the spawned NPC as defender. Use the Round Tracker for initiative; review weapon, target, movement, and situational modifiers.' },
      { body: 'Press Roll for Attack to resolve the roll. Review the hit and damage breakdown before applying the result. The Round Tracker manages action points and turns.' },
    ],
  },
  {
    id: 'characters',
    title: 'Characters',
    routes: [{ label: 'OPEN CHARACTERS', path: '/(tabs)/characters' }],
    steps: [
      { body: 'The Characters tab is the campaign roster for player characters, NPCs, and spawned vehicles. Select a character card to inspect or edit it.' },
      { body: 'Character panels track health, radiation, injuries, conditions, equipment wear, and active effects. Use the available actions to heal or record recovery.' },
      { body: 'Karma and faction reputation are separate trackers. Add described fame or infamy changes; shared thresholds produce dynamic titles, with an optional custom title for a role or rank.' },
    ],
  },
  {
    id: 'bestiary',
    title: 'Bestiary',
    routes: [{ label: 'OPEN BESTIARY', path: '/(tabs)/bestiary' }],
    steps: [
      { body: 'Search matches across all Bestiary entries, even when they are in another category. Category filters can narrow the results.' },
      { body: 'Select an entry to inspect its expanded stats and attacks. Create custom NPCs here; built-in entries can be edited and restored from Campaign Options.' },
      { body: 'Add a portrait to a creature before it is spawned. Spawn the entry to bring its configured stats and image into the active campaign.' },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment',
    routes: [{ label: 'OPEN EQUIPMENT', path: '/(tabs)/equipment' }],
    steps: [
      { body: 'Equipment contains weapons, armor, ammunition, and vehicles. Browse the categories or choose the custom-only filter to focus on campaign-made assets.' },
      { body: 'Create a custom weapon with its stats and multiple weapon tags. Built-in and campaign-specific tags let perks and mods recognize equipment types.' },
      { body: 'Use the weapon editor’s Mods area to attach or create mods. A mod can adjust range, damage types, or other weapon values, or provide a description-only tactical effect.' },
      { body: 'Create custom perks in the character editor’s Perks tab. Automatic perk effects can require weapon or armor tags, an action mode, or a status; roleplay-only perks can remain descriptive.' },
      { body: 'Customize armor protection and ammunition damage properties in their equipment sections. Spawned gear also tracks condition during play.' },
      { body: 'Vehicle entries support custom stats, parts, weapons, and portraits. Spawn a vehicle from Equipment to use it as a persistent combatant.' },
    ],
  },
  {
    id: 'campaign',
    title: 'Campaign',
    routes: [{ label: 'OPEN CAMPAIGN', path: '/(tabs)/campaign' }],
    steps: [
      { body: 'Load Campaign and Save Campaign open the campaign library, where named campaign snapshots can be saved, loaded, renamed, imported, exported, or deleted.' },
      { body: 'In Campaign Assets, expand a category to review its records and download individual JSON files for characters, NPCs, custom equipment, and vehicles.' },
      { body: 'Campaign Tools manage configurable loot and encounter tables, plus map records with an uploaded image, notes, party markers, and JSON export.' },
      { body: 'Campaign Options contains optional gameplay and sound settings. Change the interface language from the flag selector on the main menu.' },
    ],
  },
  {
    id: 'rules-options',
    title: 'Quick Rules & Options',
    routes: [{ label: 'OPEN CAMPAIGN', path: '/(tabs)/campaign' }],
    steps: [
      { body: 'The Campaign tab includes a Quick Rules reference based on the Fallout PnP 2.0 manual. Search filters out entries without your terms and highlights matching words.' },
      { body: 'Open a rule entry to read its details. Use the reference as a quick lookup while resolving a calculation or making a Game Master ruling.' },
      { body: 'Campaign Options hold optional gameplay rules and app settings. Review each rule’s explanation before enabling it for your table.' },
      { body: 'Vault Radio is optional music with its own volume and track controls. System Sounds control interface effects such as button sounds.' },
    ],
  },
];

export const APP_ABOUT_COPY = {
  descriptions: [
    'An unofficial tabletop companion for Fallout PnP 2.0. Build characters, run encounters, and manage campaigns with a Pip-Boy-inspired toolkit.',
    'The app automates core implemented rules for character calculations, attacks, damage, armor condition, injuries, radiation, initiative, and vehicle combat. The Game Master keeps control of narrative rulings and house rules.',
    'Create campaign-specific weapons, armor, ammo, mods, perks, tags, NPCs, vehicles, loot and encounter tables, and maps.',
  ],
  credits: [
    'Fallout PnP 2.0 rules: Jason Mical.',
    'Original Fallout game design: Tim Cain, Leonard Boyarsky, Jason D. Anderson, Christopher Taylor, Jason Taylor, and Scott Campbell.',
    'Game studios: Interplay Productions (Fallout); Black Isle Studios / Interplay (Fallout 2); Bethesda Game Studios (Fallout 3, Fallout 4, Fallout 76); Obsidian Entertainment (Fallout: New Vegas).',
    'Fallout and its characters are the property of their respective rights holders. This independent fan-made app is not affiliated with or endorsed by Bethesda Softworks.',
  ],
};
