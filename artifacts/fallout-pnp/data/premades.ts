import { Character, CharacterSkills, NaturalProtection, SkillType, SPECIALStats } from '@/context/types';

// ─── Pre-made Player Characters (Appendix D of the Fallout PnP 2.0 manual) ─────
// Skill values are stored WITHOUT the tagged +20 bonus (added at display/combat time).

export interface PremadeCharacter {
  premadeId: string;
  name: string;
  title: string;
  race: Character['race'];
  special: SPECIALStats;
  maxHp: number;
  maxAP: number;
  sequence: number;
  armorClass: number;
  skills: CharacterSkills;
  taggedSkills: SkillType[];
  radiationResistance: number;
  gasResistance: number;
  electricityResistance: number;
  naturalProtection?: NaturalProtection;
  traits: string;
  biography: string;
  /** Primary weapon id (data/weapons.ts). */
  weaponId?: string;
  /** Carried weapon profile ids, including the primary weapon. */
  inventoryWeaponIds?: string[];
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;
}

const NP = (dt: number, dr: number, types: ('normal' | 'laser' | 'fire' | 'plasma' | 'explosion')[]): NaturalProtection => ({
  dtNormal: types.includes('normal') ? dt : 0, dtLaser: types.includes('laser') ? dt : 0,
  dtFire: types.includes('fire') ? dt : 0, dtPlasma: types.includes('plasma') ? dt : 0,
  dtExplosion: types.includes('explosion') ? dt : 0,
  drNormal: types.includes('normal') ? dr : 0, drLaser: types.includes('laser') ? dr : 0,
  drFire: types.includes('fire') ? dr : 0, drPlasma: types.includes('plasma') ? dr : 0,
  drExplosion: types.includes('explosion') ? dr : 0,
});

const ALL_TYPES: ('normal' | 'laser' | 'fire' | 'plasma' | 'explosion')[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];

export const PREMADE_CHARACTERS: PremadeCharacter[] = [
  {
    premadeId: 'harry', name: 'Harry', title: 'Mutant Warrior', race: 'superMutant',
    special: { strength: 7, perception: 5, endurance: 5, charisma: 4, intelligence: 5, agility: 8, luck: 6 },
    maxHp: 32, maxAP: 7, sequence: 10, armorClass: 8,
    skills: { smallGuns: 37, bigGuns: 16, energyWeapons: 16, meleeWeapons: 50, unarmed: 60, throwing: 32, firstAid: 26, doctor: 15, sneak: 29, lockpick: 23, steal: 24, traps: 23, science: 20, repair: 15, speech: 20, barter: 16, gambling: 24, outdoorsman: 20, pilot: 26 },
    taggedSkills: ['bigGuns', 'unarmed', 'throwing'],
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
    naturalProtection: NP(0, 25, ALL_TYPES),
    weaponId: 'minigun',
    inventoryWeaponIds: ['minigun', 'super_mutant_fist', 'frag_grenade'],
    traits: 'Heavy-Handed',
    biography: `Before the collapse of the Master's army, Harry was a basic grunt — a footsoldier. Dipped at a relatively young age, Harry was a recent addition to the Master's forces, joining only a year before He was killed.

When the Master died, Harry's squad was on operations in The Great Wastes to the east of Nevada. The chain of command broken, Harry's outfit weighed their chances against the Brotherhood mop-up squads and the harsh unknown to the east. They chose the east.

Attacks by mysterious tribes, lack of supplies, and choking dust and electrical storms took their toll, and Harry was the only squad member to stumble out of the Wastes into the swampy valleys of Louisiana. Half-dead and starving, Harry fell asleep in front of a mission hospital. The monks inside didn't recognize the strange creature, but knew Harry to be a mutated human and took pity on him. Nursing Harry back to health, the huge mutant was just getting better when the first squads of desperate super-mutants emerged, bloodthirsty, scared, and violent.

The battle at the mission was swift. The mutant squads' miniguns cut through the monks as they tried desperately to defend their meager supplies. Harry attempted to stand with the monks, but was wounded in the conflict and fled moments before the hospital's gates crashed inward.

Betrayed by the collapse of the mutant army's ideals, Harry no longer feels any connection to a dream he now realizes was misguided. Equally despondent of humans, Harry has become a mercenary, scrounging for supplies and food by selling his muscle to the highest bidder. If he's going to travel with a party, he better be getting a large share of the loot and some extra food to boot.

Current Sketch: Harry's gruff, outer demeanor is simply a mask for the pain and betrayal he feels inside. He no longer takes pleasure in killing, but feels he is in a position where he can no longer redeem himself for what he — and "his" army — did. Whenever he gets a chance, he tries to convince other mutants of his position, but more often than not they return his overtures with gunfire.`,
  },
  {
    premadeId: 'maverick', name: 'Maverick', title: 'Gambler With Attitude', race: 'human',
    special: { strength: 4, perception: 6, endurance: 4, charisma: 7, intelligence: 7, agility: 5, luck: 7 },
    maxHp: 27, maxAP: 7, sequence: 12, armorClass: 5,
    skills: { smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 38, unarmed: 48, throwing: 20, firstAid: 22, doctor: 16, sneak: 20, lockpick: 21, steal: 15, traps: 21, science: 28, repair: 21, speech: 55, barter: 28, gambling: 28, outdoorsman: 22, pilot: 22 },
    taggedSkills: ['barter', 'gambling'],
    radiationResistance: 8, gasResistance: 0, electricityResistance: 30,
    weaponId: '10mm_pistol',
    inventoryWeaponIds: ['10mm_pistol', 'combat_knife'],
    equippedBodyArmorId: 'leather_armor',
    traits: 'None',
    biography: `There are those that say you can't get by on looks and luck, especially in the Wastes. Maverick is actively trying to overturn that stereotype, and so far has done a good job of it.

There are two people in the world who know Maverick's real name: his mother and his sister. If you ask them, however, they'll just laugh and tell you to call him "Mav." After devising various schemes to get himself out of trouble as young as age 3, Maverick adopted the moniker of a popular 20th Century television character.

To call Maverick a card sharp is to call a priest a religious man; to him, poker isn't just a game, it's a way of life, and it's one he's done very well at. He maintains a jovial approach to life, drinking and gambling his way into the hearts and lives of countless women (and men), whom he bilks just as surely as the gamblers around the table at the local casino.

All this action has made Maverick his fair share of enemies, and he is constantly on the move, looking for the next great scheme or payoff. He dresses well, and you can always spot him in a crowd. Mothers tell their daughters that "he's the one I've been warning you about," but that doesn't seem to stop them from falling for him just the same.

Maverick's life is an exciting one, but he knows it's simply a matter of time before his luck runs out. He has been strongly considering settling down and establishing himself in a career with more of a future. There always seems to be some reason to keep going; another beautiful girl, or one last big payoff.

Current Sketch: Maverick travels around gambling and cheating his way into fame and fortune. He isn't evil, or even especially self-interested, but enjoys the thrill of a good challenge, and he considers people the biggest challenge of all. As his pappy used to say, "it's a better life than herding Brahmin." Maverick agrees.`,
  },
  {
    premadeId: 'needlepoint', name: 'Needlepoint', title: 'Seductive Sniper', race: 'human',
    special: { strength: 4, perception: 10, endurance: 4, charisma: 7, intelligence: 2, agility: 10, luck: 3 },
    maxHp: 27, maxAP: 10, sequence: 20, armorClass: 10,
    skills: { smallGuns: 45, bigGuns: 20, energyWeapons: 20, meleeWeapons: 48, unarmed: 58, throwing: 40, firstAid: 40, doctor: 19, sneak: 35, lockpick: 30, steal: 30, traps: 30, science: 8, repair: 6, speech: 35, barter: 28, gambling: 12, outdoorsman: 12, pilot: 40 },
    taggedSkills: ['smallGuns', 'energyWeapons', 'sneak'],
    radiationResistance: 8, gasResistance: 0, electricityResistance: 30,
    // STR 4 can't shoulder a sniper rifle (STR 5) — M1 Garand (STR 4) keeps the marksman role.
    weaponId: 'm1_garand_rifle',
    inventoryWeaponIds: ['m1_garand_rifle', '10mm_pistol', 'combat_knife'],
    equippedBodyArmorId: 'combat_armor',
    traits: 'None',
    biography: `It would be an error to call Needlepoint stupid, but she certainly isn't the sharpest knife in the drawer. Born into relative privilege in Vault City, Needlepoint was always popular in school, even if her grades were the lowest in the class and she could hardly form complete sentences.

When Needlepoint was 16, she picked up a gun that her friends were playing with. Ignoring their taunts about a "stupid girl," she proceeded to bullseye ten molerats in a row. After that, the taunts ceased and Needlepoint found her calling, enlisting in Vault City's guard corps.

Needlepoint quickly moved through the Vault City ranks, although promotion to an officer's position was limited by her failure on several simple tests. She was assigned to a crack tracking and attack squad, training on Vault City's arsenal of Energy Weapons, finding her innate skill nearly equal to her talent with a rifle.

Once, on an attack, Needlepoint's squad came across a party of ghouls. Her commanding officer ordered her to take the mutated scum out once and for all. Needlepoint was confused; the ghouls had done nothing wrong, and although she had been taught ghouls were less than human, she realized they felt pain. She followed the order — and that night, back at the barracks, she couldn't get the image of the dying ghouls out of her mind. She realized her talents were being utilized for something immoral. Without a word to anyone, Needlepoint left Vault City that night, never to return.

Current Sketch: Since leaving Vault City, Needlepoint has made her way slowly southward, eventually reaching the New California Republic. She picks up the occasional odd job guarding caravans when she needs food and transport, but otherwise stays as far from civilization as possible. She has spent a lot of time in Tribal villages, where she picked up her current nickname. The simple, non-judgmental lifestyle appeals to her; she prefers an environment where she isn't judged as much on intelligence as ability. Needlepoint is constantly on the move, trying to find a place untainted by the bigotry she fled in Vault City.`,
  },
  {
    premadeId: 'crystal', name: 'Crystal', title: 'Speed Demon Extraordinaire', race: 'ghoul',
    special: { strength: 3, perception: 13, endurance: 3, charisma: 2, intelligence: 9, agility: 6, luck: 5 },
    maxHp: 23, maxAP: 8, sequence: 26, armorClass: 6,
    skills: { smallGuns: 29, bigGuns: 12, energyWeapons: 12, meleeWeapons: 36, unarmed: 46, throwing: 24, firstAid: 38, doctor: 37, sneak: 20, lockpick: 29, steal: 18, traps: 29, science: 36, repair: 27, speech: 10, barter: 8, gambling: 20, outdoorsman: 24, pilot: 38 },
    taggedSkills: ['repair', 'pilot', 'gambling'],
    radiationResistance: 86, gasResistance: 0, electricityResistance: 0,
    weaponId: '10mm_pistol',
    // Crowbar needs STR 5 (Crystal has 3) — claw hammer fits the mechanic kit.
    inventoryWeaponIds: ['10mm_pistol', 'wrench', 'claw_hammer'],
    equippedBodyArmorId: 'leather_armor',
    traits: 'Fear the Reaper',
    biography: `Before the war, Crystal was a mechanic at a Daytona race track. Ever since she was a little girl, she loved the fast cars and excitement of the race whenever her mother took her to the tracks, and when Crystal was in school, she learned all she could about the operation of these mighty machines.

When Crystal was 15, she got a part-time job in an auto-body shop, learning everything she could about engines and mechanics. Once she exhausted that source, Crystal lied about her age to get a job at a local drag-race track. She quickly gained a reputation as the greatest mechanic in the circuit.

Although her services were always in demand, more than anything Crystal wanted to race the cars she worked on. Other drivers would only let her race in practice situations; although her times were on par with the best racers, Crystal was never allowed to enter, as she didn't have the sponsorship necessary to race with her own car.

Crystal happened to be in the wrong place at the wrong time when the bombs went off; she and a small group of others were transformed into ghouls when a nuke exploded almost directly over their heads. Thinking she was dying, Crystal made her way to her beloved car track, managing to hide several vehicles in a garage before the nuclear winter began in earnest.

Several other ghouls managed to find Crystal, and a small community sprung up at the race track. After the nuclear winter died down, Crystal took her meticulously-maintained vehicles out of storage and finally felt the exhilaration she missed before the war.

Before long, the community ran out of Micro Fusion cells to power the vehicles, and set out searching for more. Crystal was among this party. Having had very little contact with the rest of the world, they assumed the first people they encountered would be merchants. Unfortunately, these people were slavers. Crystal has since managed to escape, but is so far from home, she doesn't know what to do.

Current Sketch: Crystal is very much out of her element in the real world, and any communication skills she once had are quite rusty. She searches desperately for a way back to her race track, but has had several encounters with biker gangs that have whetted her appetite for high-speed adventure. Crystal is beginning to realize the potential for a skilled driver in the wastes, and is looking forward to utilizing her skills for the highest bidder.`,
  },
  {
    premadeId: 'cookie', name: 'Cookie', title: 'Mutant Hermit-Philosopher', race: 'superMutant',
    special: { strength: 5, perception: 8, endurance: 5, charisma: 5, intelligence: 7, agility: 8, luck: 2 },
    maxHp: 30, maxAP: 9, sequence: 16, armorClass: 8,
    skills: { smallGuns: 37, bigGuns: 16, energyWeapons: 16, meleeWeapons: 46, unarmed: 56, throwing: 32, firstAid: 32, doctor: 15, sneak: 29, lockpick: 26, steal: 24, traps: 26, science: 32, repair: 21, speech: 25, barter: 20, gambling: 8, outdoorsman: 24, pilot: 32 },
    taggedSkills: ['throwing', 'traps', 'outdoorsman'],
    radiationResistance: 60, gasResistance: 0, electricityResistance: 0,
    naturalProtection: NP(0, 25, ALL_TYPES),
    weaponId: 'spear',
    inventoryWeaponIds: ['spear', 'frag_grenade', 'super_mutant_fist'],
    traits: 'One-Hander',
    biography: `Cookie was one of the first people the Master turned into a super-mutant. Already middle-aged when dipped, Cookie is now getting on in years and beginning to feel his age a little.

Even before his experience with the FEV virus, Cookie was an intellectual instead of a fighter, choosing the pen instead of the sword. Cookie went along with the mutant armies not because he believed in their ideologies, but because he had no other choice and was interested in self-preservation. When the Master was killed, Cookie took the first chance he could and fled.

Disguising himself under a robe, Cookie wandered through ruins of cities, never staying long in one place. People were always suspicious, and outright hostile when Cookie revealed his mutant nature. Eventually, Cookie wound up in a city library. He had learned to read while serving the Master, and here were stacks of books at his disposal.

After a year of solid reading, armed with Plato, Nietzsche, Buddha, Thoreau, Gandhi, and countless other thinkers, Cookie decided a life of quiet contemplation was preferable to constant hiding and living on the fringes of society. Using skills learned while in the field, Cookie became proficient at hunting game and built himself a cabin high in the Sierra Nevada, choosing a small forest by a pond.

Having finished his books and filling hundreds of notebooks with scribblings, poems, essays, and random thoughts, Cookie realized he was at a bit of an impasse. He knew a great deal about the world, and had formulated his own personal philosophies, but he was unaware of the practicality of his ideas. What he needed, Cookie decided, was to re-enter society and put his notions into practice, taking them beyond book theory to everyday use.

Current Sketch: Cookie still dislikes crowds and civilization, but sees them as necessary evils to overcome if he is ever going to teach anyone his theories of life. So far, Cookie's notions have played out quite well, and his good luck has been encouraging. His Walden-like time on the mountain gave him skills for survival, so he is never at a loss for basic supplies, but Cookie enjoys traveling with groups in order to reach new places and teach more people about his philosophy.`,
  },
  {
    premadeId: 'shadow', name: 'Shadow', title: 'Half-Mutant Thief', race: 'halfMutant',
    special: { strength: 5, perception: 9, endurance: 4, charisma: 2, intelligence: 4, agility: 8, luck: 10 },
    maxHp: 28, maxAP: 9, sequence: 16, armorClass: 8,
    skills: { smallGuns: 37, bigGuns: 16, energyWeapons: 16, meleeWeapons: 46, unarmed: 56, throwing: 32, firstAid: 34, doctor: 18, sneak: 29, lockpick: 27, steal: 24, traps: 27, science: 16, repair: 12, speech: 10, barter: 8, gambling: 40, outdoorsman: 16, pilot: 34 },
    taggedSkills: ['sneak', 'lockpick', 'steal'],
    radiationResistance: 23, gasResistance: 0, electricityResistance: 0,
    weaponId: '10mm_pistol',
    inventoryWeaponIds: ['10mm_pistol', 'switchblade', 'throwing_knife'],
    equippedBodyArmorId: 'leather_armor',
    traits: 'Night Person',
    biography: `Born to a prostitute mother in New Reno, Shadow learned to loathe himself early in life. His off-color skin, pug-shaped face, and large hands were a constant reminder of his bastard lineage, and his mother's profession and lack of love were a constant reminder of the evil in the world.

Growing up in a whorehouse, Shadow soon learned to please the prostitutes and pimps by filching small items and money from unsuspecting customers. Honing his skills in the darkness of the brothel, Shadow's budding life of crime continued to blossom into his adolescence.

Somehow, the pimps that ran the brothel he lived in managed to upset the wrong gangsters, and one evening when Shadow was 15, he awoke to the sounds of gunfire and screaming. Hiding under a bed, Shadow watched as the people he knew all his life — people who loved him only for the things he stole, but the only family he had ever known — were gunned down ruthlessly. Taking careful note of the leader's face, Shadow vowed revenge.

Peddling his skills first to petty criminals, Shadow eventually managed to begin working for the same crime family that butchered his mother. By the time he was twenty years old, Shadow was considered a Made Man and one of the most trusted members of the family. His breaking and entering skills were in high demand, and he was living the good life in his own penthouse suite.

The constant specter of revenge hung over his life the entire time. One night, Shadow turned his skills against his adopted family, breaking into the bedroom his sworn enemy was occupying and brutally torturing and killing him unbeknownst to the other family members. Before his crime was discovered, Shadow was already hundreds of miles into the Wastes, never looking back at the stain of New Reno.

Current Sketch: Shadow is the consummate wanderer, always keeping to himself and dealing with other people only when absolutely necessary. He is overly paranoid, and sees plots against him that don't exist. Shadow has a difficult time trusting and relating to other people, and considers himself the only friend he ever needs. Lately, Shadow has realized that his life has very little meaning and direction, and is attempting to find a new cause worthy of his skills.

Note: Night Person trait — day stats are PE 7, IN 2 (listed stats are for night).`,
  },
  {
    premadeId: 'goanna', name: 'GoAnna', title: 'Deathclaw Huntress', race: 'deathclaw',
    special: { strength: 12, perception: 5, endurance: 5, charisma: 1, intelligence: 5, agility: 12, luck: 2 },
    maxHp: 37, maxAP: 8, sequence: 10, armorClass: 14,
    skills: { smallGuns: 48, bigGuns: 24, energyWeapons: 24, meleeWeapons: 48, unarmed: 58, throwing: 48, firstAid: 34, doctor: 15, sneak: 39, lockpick: 27, steal: 36, traps: 27, science: 20, repair: 15, speech: 5, barter: 4, gambling: 8, outdoorsman: 20, pilot: 34 },
    taggedSkills: ['unarmed', 'meleeWeapons', 'outdoorsman'],
    radiationResistance: 60, gasResistance: 40, electricityResistance: 0,
    naturalProtection: NP(4, 40, ['normal', 'fire', 'explosion']),
    weaponId: 'deathclaw_claw',
    inventoryWeaponIds: ['deathclaw_claw', 'deathclaw_bite', 'spear'],
    traits: 'Bruiser',
    biography: `GoAnna is a young member of a Deathclaw tribe that lives just east of the Great Wastes. Up to this point, her life has been fairly typical, although she is much more intelligent than most of her Deathclaw brethren.

GoAnna realizes that her options within the tribe are somewhat limited; she can either choose to be a warrior, or bear pups. The idea of spending her life tied to one place and caring for children does not appeal to her, so she opted to become a warrior. Her training is nearly complete, but GoAnna's tribe requires one last test before a member can be declared a full warrior: a brief quest into the outside world.

Bidding her parents and siblings goodbye, GoAnna recently set off on her quest: to venture into human civilization and, without killing anyone, bring back something indicating she had been there. GoAnna donned a robe and made for the nearest town, using her learned speech patterns to get along relatively well. GoAnna suddenly realized there is a much bigger world than her simple Deathclaw village.

Since that initial encounter with civilization, GoAnna has wandered from small town to small town, concealing her true nature from everyone, but utterly fascinated with everything she encounters. She feels that the world lies open before her like a book, and she is ready to begin turning the pages.

Current Sketch: Although GoAnna feels strong loyalties to her tribe and her family, the time has come to make a decision. She wants very much to experience the wider human world, and intends to do so at some point. She also knows that if she forsakes her village, she will forever be an outcast and an alien, denied the chance to see those she cares about the most. Unfortunately, GoAnna also knows that her charade cannot go on forever, and sooner or later someone will uncover her real identity. She knows that her strength is with people who will understand her for who she is, not the mask she puts on for civilization.`,
  },
  {
    premadeId: 'rufus', name: 'Rufus', title: 'Loyal Canine Companion', race: 'dog',
    special: { strength: 7, perception: 4, endurance: 4, charisma: 2, intelligence: 4, agility: 14, luck: 3 },
    maxHp: 30, maxAP: 10, sequence: 8, armorClass: 14,
    skills: { smallGuns: 59, bigGuns: 28, energyWeapons: 28, meleeWeapons: 82, unarmed: 72, throwing: 54, firstAid: 36, doctor: 13, sneak: 46, lockpick: 28, steal: 42, traps: 28, science: 16, repair: 12, speech: 10, barter: 8, gambling: 12, outdoorsman: 16, pilot: 36 },
    taggedSkills: ['unarmed', 'sneak', 'outdoorsman'],
    radiationResistance: 8, gasResistance: 0, electricityResistance: 50,
    weaponId: 'dog_bite',
    inventoryWeaponIds: ['dog_bite', 'dog_claw'],
    traits: 'Domesticated',
    biography: `Rufus began his days as a much-loved puppy in the household of a wealthy rancher in the New California Republic. Although he was a mutt rescued from the local humane society/sausage factory, Rufus was housetrained and loved like a member of the family.

Before he was a year old, Rufus's owners lost their entire fortune in a bad business deal. Knowing that food would be scarce, Rufus — who was always smarter than the average dog (and some humans he knew) — decided that a life on the streets might be preferable to a fate on the dinner table. Choosing instead to rely on his wits, Rufus began the life of a stray on the streets of Shady Sands.

Rufus found himself quite proficient at surviving, managing to stay low and out of sight while scavenging for scraps of food from passing children and garbage heaps. He learned the value of disappearing when the humane society came looking for more sausage ingredients, and discovered an entire underground population of dogs like himself.

Perhaps it was something natural inside of him, or perhaps it was memories of a better life, but Rufus longed for the touch of a human being behind his ears. His heart yearned for the praise he got when fetching a stick or a ball, or the little treats he used to get for doing something as simple as sitting or laying down. Although he was happy in his new life, he wasn't completely content.

Choosing for the second time to leave a family, Rufus returned to the streets, this time falling right into the clutches of the humane society. Unfortunately, Rufus grossly misjudged the number of people who wanted full-grown dogs, and was due to be turned into a "Real Beef Hot Dog!" when, by chance, he escaped from his cage in a moment of confusion.

Taking his chances in the Wastes, Rufus left the gated walls of the NCR behind and began utilizing his survival skills while traveling the wasteland, looking for a human who cared for him in ways other than as a main course.

Current Sketch: Rufus's encounter with the humane society left him very wary of human beings, and he is intelligent enough to differentiate between those who wish to eat him and those who wish to love him. The encounter did nothing to dampen his optimism, and Rufus is confident he will eventually find a master who will love and care for him in the same way that his family did so long ago.`,
  },
  {
    premadeId: 'vax', name: 'Vax', title: 'Outsider Looking In', race: 'robot',
    special: { strength: 7, perception: 7, endurance: 7, charisma: 1, intelligence: 12, agility: 1, luck: 5 },
    maxHp: 36, maxAP: 5, sequence: 14, armorClass: 1,
    skills: { smallGuns: 9, bigGuns: 2, energyWeapons: 2, meleeWeapons: 36, unarmed: 46, throwing: 4, firstAid: 16, doctor: 19, sneak: 8, lockpick: 18, steal: 3, traps: 18, science: 48, repair: 36, speech: 5, barter: 4, gambling: 20, outdoorsman: 38, pilot: 16 },
    taggedSkills: ['firstAid', 'science', 'repair'],
    radiationResistance: 100, gasResistance: 100, electricityResistance: 0,
    naturalProtection: NP(0, 80, ALL_TYPES),
    weaponId: 'wrench',
    inventoryWeaponIds: ['wrench', 'ripper'],
    traits: 'Tight Nuts',
    biography: `Vax has no idea how old he is, and knows very little about his past. In fact, Vax isn't sure he's even a he — he doesn't know what he is.

Vax is a Darwin Systems Model 3141-Admin robot, designed for human-cyborg relations. When the bombs hit, Vax was 99% complete on the assembly line. For years, he sat in darkness, semi-aware of his surroundings but running only the most basic functions.

Before long, a party of adventurers came along, broke into the Darwin Systems factory, and managed to re-activate Vax's assembly line. Within minutes, the mists of his previous existence rolled back and Vax's systems went completely online.

Unfortunately, the adventuring party that decanted Vax could not take him with them; when they left the robot factory, they left the new robot as well. Unsure what to do and expecting further programming instructions, Vax only knew that he didn't want to return to the state of semi-existence in the endless darkness of the factory. Vax searched through the factory to find useful resources, managed to locate a working information nodule, and uploaded several maintenance programs. Imbibed with a sense of purpose, Vax managed to repair the factory's main computer, opened the doors, and rolled off into the Wastes.

Vax's programming did not prepare him for the world that met him outside. He was made aware of the War through information databases, but didn't realize the conflict's devastating result. Vax felt no emotions one way or the other, but his processes came to the inevitable conclusion that he would not be able to serve in the capacity he was originally designed for. His programming didn't necessarily allow for this turn of events, so he defaulted to information-seeking, looking for new code that would allow him to be useful.

Current Sketch: Vax wanders the Wastes, moving from town to town in an attempt to seek new information. His treads are still new, but his once-shiny exoskeleton is now beginning to corrode with dirt and grime. Everywhere he's gone, Vax has encountered nothing but hostility. Luckily, he hasn't been attacked yet, but Vax does not understand the danger he's in. Many people consider the idea of a talking robot absurd, and are more interested in Vax for his obvious technological parts than in helping him "find himself."`,
  },
];

// Convert a premade template into a full Character object
export function createCharacterFromPremade(p: PremadeCharacter, id: string): Character {
  return {
    id,
    name: p.name,
    type: 'pc',
    race: p.race,
    level: 1,
    xp: 0,
    special: { ...p.special },
    maxHp: p.maxHp,
    currentHp: p.maxHp,
    armorClass: p.armorClass,
    tempAC: 0,
    maxAP: p.maxAP,
    currentAP: p.maxAP,
    position: 'standing',
    sequence: p.sequence,
    skills: { ...p.skills },
    taggedSkills: [...p.taggedSkills],
    unspentSkillPoints: 0,
    perks: [],
    radiationResistance: p.radiationResistance,
    gasResistance: p.gasResistance,
    electricityResistance: p.electricityResistance,
    equippedWeaponId: p.weaponId,
    inventoryWeaponIds: p.inventoryWeaponIds ? [...p.inventoryWeaponIds] : undefined,
    equippedBodyArmorId: p.equippedBodyArmorId,
    equippedHelmetId: p.equippedHelmetId,
    weaponAmmoStates: [],
    injuries: [],
    isKnockedOut: false,
    knockOutRoundsLeft: 0,
    conditions: [],
    biography: p.biography + (p.traits && p.traits !== 'None' ? `\n\nTraits: ${p.traits}` : ''),
    naturalProtection: p.naturalProtection ? { ...p.naturalProtection } : undefined,
    inStorage: false,
  };
}
