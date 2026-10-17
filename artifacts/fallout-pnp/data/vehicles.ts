import type {
  Character, DamageType, NaturalProtection, VehicleCategory, VehicleProfile, VehicleSystem,
} from '../context/types';

const DR = (normal: number, laser: number, fire: number, plasma: number, explosion: number) => ({
  normal, laser, fire, plasma, explosion,
});

function systems(
  structure: number,
  engine: number,
  controls: number,
  drive: number,
  tires: number,
  tireCount: number,
  tread = false,
): VehicleSystem[] {
  const result: VehicleSystem[] = [
    { id: 'structure', name: 'Structure', kind: 'structure', currentHp: structure, maxHp: structure },
    { id: 'engine', name: 'Engine', kind: 'engine', currentHp: engine, maxHp: engine },
    { id: 'controls', name: 'Controls', kind: 'controls', currentHp: controls, maxHp: controls },
    { id: 'drive', name: 'Drive system', kind: 'drive', currentHp: drive, maxHp: drive },
  ];
  for (let i = 0; i < tireCount; i++) {
    const name = `${tread ? 'Tread' : 'Tire'} ${i + 1}`;
    result.push({
      id: `${tread ? 'tread' : 'tire'}-${i + 1}`,
      name,
      kind: tread ? 'tread' : 'tire',
      currentHp: tires,
      maxHp: tires,
    });
  }
  return result;
}

function singleStructure(hp: number): VehicleSystem[] {
  return [{ id: 'structure', name: 'Structure', kind: 'structure', currentHp: hp, maxHp: hp }];
}

function vehicle(
  id: string,
  name: string,
  category: VehicleCategory,
  values: {
    speed: number | null; accel: number | null; brake: number | null; turn: number | null;
    range: number | null; passengers: string; cargo: string; fuel: number | null;
    armor: [number, number, number, number, number]; systems: VehicleSystem[];
    description?: string; weapons?: string[]; notes?: string[]; pilot?: number;
  },
): VehicleProfile {
  return {
    id, name, category, description: values.description ?? '', isCustom: false,
    topSpeedKph: values.speed, accelerationKphPerRound: values.accel,
    brakingKphPerRound: values.brake, turningRadiusMeters: values.turn,
    rangeKm: values.range, passengers: values.passengers,
    carryingWeightLb: values.cargo, fuelCharges: values.fuel, armorClass: 0,
    damageResistance: DR(...values.armor),
    systems: values.systems, mountedWeapons: values.weapons ?? [],
    enhancements: [], notes: values.notes ?? [], terrainPilotModifier: values.pilot ?? 0,
    inMotion: true,
  };
}

const vehicleWithSystems = (
  structure: number, engine: number, controls: number, drive: number, tireHp: number, tireCount: number, tread = false,
) => systems(structure, engine, controls, drive, tireHp, tireCount, tread);

export const BUILT_IN_VEHICLES: VehicleProfile[] = [
  vehicle('corvega_highwayman', 'Corvega “Highwayman”', 'car', {
    speed: 160, accel: 60, brake: 50, turn: 5, range: 480, passengers: '5', cargo: '2,500', fuel: 30,
    armor: [10, 0, 0, 0, 10], systems: vehicleWithSystems(175, 50, 40, 40, 10, 4),
    description: 'Roomy family/sports car. Basic model is not armed.',
  }),
  vehicle('canyonero_suv', 'Canyonero SUV', 'car', {
    speed: 140, accel: 40, brake: 50, turn: 7, range: 300, passengers: '5', cargo: '4,000', fuel: 50,
    armor: [10, 5, 0, 5, 10], systems: vehicleWithSystems(250, 70, 40, 40, 15, 4),
    description: 'Rugged SUV; sluggish but many survived.',
  }),
  vehicle('roadrunner_muscle_car', 'Roadrunner Muscle Car', 'car', {
    speed: 200, accel: 40, brake: 50, turn: 8, range: 300, passengers: '4', cargo: '2,500', fuel: 30,
    armor: [17, 5, 5, 5, 10], systems: vehicleWithSystems(200, 100, 40, 40, 10, 4),
    description: 'Often a custom build; no standard weapons.',
  }),
  vehicle('dune_buggy', 'Dune Buggy', 'car', {
    speed: 130, accel: 80, brake: 60, turn: 4, range: 100, passengers: '1', cargo: '500', fuel: 20,
    armor: [5, 0, 0, 0, 0], systems: vehicleWithSystems(50, 50, 30, 20, 10, 4),
    description: 'Light improvised vehicle with no standard weapons.',
    notes: ['Reduces terrain penalties to Pilot rolls by 10%.'], pilot: 10,
  }),
  vehicle('half_ton_truck', '½ Ton Truck', 'truck', {
    speed: 160, accel: 50, brake: 40, turn: 6, range: 400, passengers: '2 cab, 5 bed', cargo: '3,000', fuel: 30,
    armor: [10, 5, 0, 5, 10], systems: vehicleWithSystems(190, 60, 40, 40, 15, 4),
    notes: ['Manual scan lists top speed as “16”; the surrounding vehicle statistics use KPH. Interpreted as 160 KPH.'],
  }),
  vehicle('two_half_ton_truck', '2½ Ton Truck', 'truck', {
    speed: 130, accel: 30, brake: 30, turn: 15, range: 320, passengers: '2 cab, 15 back', cargo: '10,000', fuel: 50,
    armor: [30, 10, 7, 10, 28], systems: vehicleWithSystems(300, 100, 40, 40, 25, 6),
    description: 'Large freight/troop truck; generally road or flat-terrain use.',
  }),
  vehicle('truck_cab', 'Truck Cab', 'truck', {
    speed: 120, accel: 40, brake: 40, turn: 15, range: 320, passengers: '2–3', cargo: '50,000', fuel: 100,
    armor: [45, 15, 30, 15, 30], systems: vehicleWithSystems(300, 130, 50, 50, 30, 10),
    description: 'Truck cab profile; a trailer may be attached.',
  }),
  vehicle('truck_cab_trailer', 'Truck Cab + Trailer', 'trailer', {
    speed: 100, accel: 30, brake: 20, turn: 20, range: 200, passengers: '40–45', cargo: '50,000', fuel: null,
    armor: [45, 15, 30, 15, 30], systems: vehicleWithSystems(600, 130, 50, 50, 30, 18),
    description: 'Manual trailer statistics are for a truck cab and trailer together.',
  }),
  vehicle('humvee', 'Humvee', 'truck', {
    speed: 95, accel: 60, brake: 40, turn: 8, range: 600, passengers: '5', cargo: '2,500', fuel: 30,
    armor: [50, 30, 27, 30, 45], systems: vehicleWithSystems(300, 100, 50, 50, 40, 4),
    notes: ['Reduces terrain penalties to Pilot rolls by 20%.'], pilot: 20,
  }),
  vehicle('bus', 'Bus', 'truck', {
    speed: 100, accel: 30, brake: 30, turn: 20, range: 300, passengers: '60–70', cargo: '50,000', fuel: 100,
    armor: [25, 10, 0, 10, 20], systems: vehicleWithSystems(550, 175, 50, 50, 25, 6),
    description: 'No standard weapons; passenger seats may be removed for cargo.',
  }),
  vehicle('sport_hawg', 'Sport Hawg', 'motorcycle', {
    speed: 200, accel: 80, brake: 40, turn: 6, range: 300, passengers: '1', cargo: '400', fuel: 20,
    armor: [10, 0, 0, 0, 0], systems: vehicleWithSystems(50, 30, 10, 10, 5, 2),
    notes: ['Motorcycles take a −10% Pilot penalty.'],
  }),
  vehicle('crotchrocket', 'Crotchrocket', 'motorcycle', {
    speed: 300, accel: 120, brake: 60, turn: 4, range: 100, passengers: '1', cargo: '300', fuel: 20,
    armor: [0, 0, 0, 0, 0], systems: vehicleWithSystems(40, 35, 10, 10, 8, 2),
    notes: ['Motorcycles take a −10% Pilot penalty; this model adds another −10% terrain penalty.'],
    pilot: -10,
  }),
  vehicle('chopper', 'Chopper', 'motorcycle', {
    speed: 220, accel: 80, brake: 40, turn: 5, range: 280, passengers: '1', cargo: '400', fuel: 20,
    armor: [10, 0, 0, 0, 0], systems: vehicleWithSystems(60, 40, 15, 15, 9, 2),
    notes: ['Motorcycles take a −10% Pilot penalty.'],
  }),
  vehicle('indian_chief', 'Indian Chief', 'motorcycle', {
    speed: 230, accel: 100, brake: 40, turn: 6, range: 200, passengers: '1', cargo: '500', fuel: 20,
    armor: [15, 0, 0, 0, 15], systems: vehicleWithSystems(55, 40, 15, 15, 14, 2),
    notes: ['Motorcycles take a −10% Pilot penalty.'],
  }),
  vehicle('canoe', 'Canoe', 'boat', {
    speed: 10, accel: 10, brake: 10, turn: 1, range: null, passengers: '3', cargo: '1,200', fuel: null,
    armor: [0, 0, 0, 0, 0], systems: singleStructure(40),
    description: 'Paddle-powered; restricted to smaller water and may capsize in high waves.',
  }),
  vehicle('catamaran', 'Catamaran', 'boat', {
    speed: 70, accel: 30, brake: 30, turn: 20, range: null, passengers: '4–20', cargo: '4,000–50,000', fuel: null,
    armor: [0, 0, 0, 0, 0], systems: singleStructure(290),
    description: 'Sail-powered; statistics assume average winds.',
  }),
  vehicle('hot_air_balloon', 'Hot Air Balloon', 'aircraft', {
    speed: 40, accel: null, brake: null, turn: null, range: 60, passengers: '4', cargo: '2,000', fuel: 20,
    armor: [0, 0, 0, 0, 0], systems: singleStructure(20),
    description: 'Burner-powered and not steerable; heat controls altitude.',
  }),
  vehicle('ultralight', 'Ultralight', 'aircraft', {
    speed: 180, accel: 40, brake: 40, turn: 30, range: 150, passengers: '1', cargo: '600', fuel: 30,
    armor: [0, 0, 0, 0, 0], systems: singleStructure(90),
    description: 'Pilot rolls take a −50% penalty.',
  }),
  vehicle('bradley_m2_ifv', 'Bradley M2 IFV', 'apc', {
    speed: 66, accel: 40, brake: 30, turn: 8, range: 70, passengers: '10', cargo: '10,000', fuel: 30,
    armor: [75, 45, 90, 45, 60], systems: vehicleWithSystems(350, 75, 30, 30, 60, 2, true),
    weapons: ['TOW-II missile launcher', 'MG3', '25mm Cannon', 'Infantry firing slots'],
    notes: ['The manual prints the braking and range labels as “DR”; interpreted as BR 30 and range 70.'],
  }),
  vehicle('dragoon_apc', 'Dragoon APC', 'apc', {
    speed: 116, accel: 60, brake: 30, turn: 9, range: 885, passengers: '8', cargo: '8,000', fuel: 40,
    armor: [75, 45, 60, 45, 60], systems: vehicleWithSystems(300, 75, 30, 30, 50, 4),
    weapons: ['AGS-17 grenade launcher or MG3 turret'],
    description: 'Fully amphibious; designed for flatter ground or water operations.',
  }),
  vehicle('lav_150_st', 'Cadillac-Gage LAV-150 ST', 'apc', {
    speed: 112, accel: 60, brake: 50, turn: 7, range: 800, passengers: '9', cargo: '10,000', fuel: 40,
    armor: [75, 45, 70, 45, 60], systems: vehicleWithSystems(400, 75, 30, 30, 60, 4),
    weapons: ['20mm Cannon', 'MG3'],
  }),
  vehicle('m60a2', 'M60A2 Main Battle Tank', 'tank', {
    speed: 60, accel: 30, brake: 60, turn: 2, range: 100, passengers: '5', cargo: '4,000', fuel: 60,
    armor: [95, 60, 98, 60, 85], systems: vehicleWithSystems(500, 75, 30, 30, 60, 2, true),
    weapons: ['M68 105mm Cannon', 'MG3 ×2'],
  }),
  vehicle('m551_sheridan', 'M551 Sheridan', 'tank', {
    speed: 60, accel: 30, brake: 60, turn: 2, range: 120, passengers: '5', cargo: '2,000', fuel: 60,
    armor: [90, 45, 95, 45, 75], systems: vehicleWithSystems(375, 70, 30, 30, 85, 2, true),
    weapons: ['152mm Shillelagh Missile System', 'MG3 ×2'],
  }),
  vehicle('m1a1_abrams', 'M1A1 Abrams', 'tank', {
    speed: 50, accel: 20, brake: 50, turn: 2, range: 100, passengers: '4', cargo: '3,000', fuel: 70,
    armor: [85, 45, 95, 45, 70], systems: vehicleWithSystems(400, 75, 30, 30, 90, 2, true),
    weapons: ['Rheinmetall 120mm Gun', 'M2HB ×2', 'TOW-II'],
  }),
];

export const VEHICLE_CATEGORIES: Record<VehicleCategory, string> = {
  car: 'Cars',
  truck: 'Trucks & buses',
  motorcycle: 'Motorcycles',
  boat: 'Boats',
  aircraft: 'Aircraft',
  apc: 'APCs',
  tank: 'Tanks',
  trailer: 'Trailers',
  artillery: 'Mobile artillery',
};

export const VEHICLE_ENHANCEMENTS = [
  { id: 'slicks', name: 'Slicks', cost: 2000, description: 'AR +10 KPH; top speed +20%; braking −10 KPH; turn radius +5m; Pilot −10%; tire HP 5 each.' },
  { id: 'noz_booster', name: 'NOz Booster', cost: 5000, description: 'Reach top speed in one round; each use deals 5 HP to the engine.' },
  { id: 'reinforced_struts', name: 'Reinforced Struts', cost: 9000, description: 'Carrying capacity +50%.' },
  { id: 'fuel_cell_converter', name: 'Fuel Cell Converter', cost: 10000, description: 'Driving range +50%.' },
  { id: 'antigrav_plates', name: 'Antigrav Plates', cost: 25000, description: 'Removes most terrain restrictions and adds 50 mph top speed; ineffective over water.' },
] as const;

export function vehicleWithDefaults(vehicle: VehicleProfile): VehicleProfile {
  return {
    ...vehicle,
    damageResistance: { ...vehicle.damageResistance },
    systems: vehicle.systems.map(system => ({ ...system })),
    mountedWeapons: [...vehicle.mountedWeapons],
    enhancements: [...vehicle.enhancements],
    notes: [...vehicle.notes],
  };
}

export function spawnVehicleCharacter(vehicle: VehicleProfile, id: string): Character {
  const snapshot = vehicleWithDefaults(vehicle);
  snapshot.id = `vehicle-${id}`;
  snapshot.systems = snapshot.systems.map(system => ({ ...system, currentHp: system.maxHp }));
  const structure = snapshot.systems.find(system => system.kind === 'structure') ?? snapshot.systems[0];
  const emptyProtection: NaturalProtection = {
    armorClass: 0,
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: snapshot.damageResistance.normal,
    drLaser: snapshot.damageResistance.laser,
    drFire: snapshot.damageResistance.fire,
    drPlasma: snapshot.damageResistance.plasma,
    drExplosion: snapshot.damageResistance.explosion,
  };
  return {
    id,
    name: snapshot.name,
    type: 'npc',
    race: 'customRace',
    level: 1,
    xp: 0,
    special: { strength: 0, perception: 0, endurance: 0, charisma: 0, intelligence: 0, agility: 0, luck: 0 },
    maxHp: structure?.maxHp ?? 1,
    currentHp: structure?.currentHp ?? 1,
    armorClass: snapshot.armorClass,
    tempAC: 0,
    maxAP: 0,
    currentAP: 0,
    position: 'standing',
    sequence: 0,
    manualDerivedStats: { armorClass: snapshot.armorClass, maxAP: 0, sequence: 0 },
    skills: {
      smallGuns: 0, bigGuns: 0, energyWeapons: 0, meleeWeapons: 0, unarmed: 0, throwing: 0,
      firstAid: 0, doctor: 0, sneak: 0, lockpick: 0, steal: 0, traps: 0, science: 0,
      repair: 0, speech: 0, barter: 0, gambling: 0, outdoorsman: 0, pilot: 0,
    },
    taggedSkills: [],
    unspentSkillPoints: 0,
    perks: [],
    weaponAmmoStates: [],
    injuries: [],
    isKnockedOut: false,
    knockOutRoundsLeft: 0,
    conditions: [],
    biography: snapshot.description,
    naturalProtection: emptyProtection,
    radiationResistance: 0,
    gasResistance: 0,
    electricityResistance: 0,
    portrait: snapshot.portrait,
    vehicle: snapshot,
  };
}

export function vehicleProtectionForDamageType(
  vehicle: VehicleProfile,
  damageType: DamageType,
): { dt: 0; dr: number } {
  return { dt: 0, dr: Math.max(0, Math.min(100, vehicle.damageResistance[damageType])) };
}

export function vehicleSystemStatus(system: VehicleSystem): 'destroyed' | 'disabled' | 'operational' {
  if (system.currentHp <= 0) return 'destroyed';
  if ((system.maxHp - system.currentHp) / Math.max(1, system.maxHp) > 0.66) return 'disabled';
  return 'operational';
}

export function applyVehicleSystemDamage(
  vehicle: VehicleProfile,
  systemId: string,
  damage: number,
): VehicleProfile {
  if (!Number.isFinite(damage) || damage <= 0) return vehicle;
  return {
    ...vehicle,
    systems: vehicle.systems.map(system => system.id === systemId
      ? { ...system, currentHp: Math.max(0, system.currentHp - Math.floor(damage)) }
      : system),
  };
}

