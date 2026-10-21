const campaignName = process.argv[2] ?? 'Legacy options compatibility';
process.stdout.write(JSON.stringify({
  campaignName,
  characters: [],
  customWeapons: [],
  customArmor: [],
}));
