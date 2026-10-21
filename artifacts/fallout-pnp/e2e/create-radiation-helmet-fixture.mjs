import { createEquipmentBundle } from '../data/portableExports.ts';

const [runId, name] = process.argv.slice(2);

if (!runId || !name) {
  throw new Error('Pass a unique run ID and display name.');
}

const helmet = {
  id: `native-radiation-helmet-${runId}`,
  name,
  slot: 'helmet',
  dtNormal: 0,
  dtLaser: 0,
  dtFire: 0,
  dtPlasma: 0,
  dtExplosion: 0,
  drNormal: 0,
  drLaser: 0,
  drFire: 0,
  drPlasma: 0,
  drExplosion: 0,
  acBonus: 0,
  weight: 1,
  isCustom: true,
  effects: { radiationResistance: 30 },
};

process.stdout.write(JSON.stringify(createEquipmentBundle('armor', helmet)));
