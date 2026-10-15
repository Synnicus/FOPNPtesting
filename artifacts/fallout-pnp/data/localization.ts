import fr from './locales/fr.json';
import it from './locales/it.json';
import de from './locales/de.json';
import esES from './locales/es-ES.json';
import esMX from './locales/es-MX.json';
import ja from './locales/ja.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import languageSettings from './locales/language-settings.json';
import patternsFr from './locales/patterns-fr.json';
import patternsIt from './locales/patterns-it.json';
import patternsDe from './locales/patterns-de.json';
import patternsEsES from './locales/patterns-es-ES.json';
import patternsEsMX from './locales/patterns-es-MX.json';
import patternsJa from './locales/patterns-ja.json';
import patternsPl from './locales/patterns-pl.json';
import patternsPtBR from './locales/patterns-pt-BR.json';
import patternsRu from './locales/patterns-ru.json';
import patternsZhHans from './locales/patterns-zh-Hans.json';
import patternsZhHant from './locales/patterns-zh-Hant.json';

export const APP_LANGUAGES = [
  { locale: 'en', label: 'English' },
  { locale: 'fr', label: 'Français' },
  { locale: 'it', label: 'Italiano' },
  { locale: 'de', label: 'Deutsch' },
  { locale: 'es-ES', label: 'Español (España)' },
  { locale: 'es-MX', label: 'Español (México)' },
  { locale: 'ja', label: '日本語' },
  { locale: 'pl', label: 'Polski' },
  { locale: 'pt-BR', label: 'Português (Brasil)' },
  { locale: 'ru', label: 'Русский' },
  { locale: 'zh-Hant', label: '繁體中文' },
  { locale: 'zh-Hans', label: '简体中文' },
] as const;

export type AppLocale = typeof APP_LANGUAGES[number]['locale'];

const translations: Partial<Record<AppLocale, Record<string, string>>> = {
  fr, it, de, 'es-ES': esES, 'es-MX': esMX, ja, pl, 'pt-BR': ptBR, ru,
  'zh-Hans': zhHans, 'zh-Hant': zhHant,
};
const supplementalTranslations: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: { 'No Armor': 'Aucune armure', 'No Weapon': 'Aucune arme' },
  it: { 'No Armor': 'Nessuna armatura', 'No Weapon': 'Nessuna arma' },
  de: { 'No Armor': 'Keine Rüstung', 'No Weapon': 'Keine Waffe' },
  'es-ES': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma' },
  'es-MX': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma' },
  ja: { 'No Armor': '防具なし', 'No Weapon': '武器なし' },
  pl: { 'No Armor': 'Brak pancerza', 'No Weapon': 'Brak broni' },
  'pt-BR': { 'No Armor': 'Sem armadura', 'No Weapon': 'Sem arma' },
  ru: { 'No Armor': 'Без брони', 'No Weapon': 'Без оружия' },
  'zh-Hans': { 'No Armor': '无护甲', 'No Weapon': '无武器' },
  'zh-Hant': { 'No Armor': '無護甲', 'No Weapon': '無武器' },
};
const dynamicPatterns: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: patternsFr, it: patternsIt, de: patternsDe, 'es-ES': patternsEsES,
  'es-MX': patternsEsMX, ja: patternsJa, pl: patternsPl, 'pt-BR': patternsPtBR,
  ru: patternsRu, 'zh-Hans': patternsZhHans, 'zh-Hant': patternsZhHant,
};
const languageSettingsTranslations = languageSettings as Record<string, Record<string, string>>;
const patternCache = new Map<AppLocale, Array<{ regex: RegExp; placeholderOrder: number[]; translated: string }>>();

let activeLocale: AppLocale = 'en';

export function isAppLocale(value: unknown): value is AppLocale {
  return APP_LANGUAGES.some(language => language.locale === value);
}

export function setActiveLocale(locale: AppLocale) {
  activeLocale = locale;
}

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compiledPatterns(locale: AppLocale) {
  const cached = patternCache.get(locale);
  if (cached) return cached;
  const patterns = Object.entries(dynamicPatterns[locale] ?? {})
    .filter(([pattern]) => /\{\d+\}/.test(pattern))
    .map(([pattern, translated]) => {
      const placeholderOrder: number[] = [];
      const source = pattern.split(/(\{\d+\})/g).map(part => {
        const placeholder = part.match(/^\{(\d+)\}$/);
        if (placeholder) {
          placeholderOrder.push(Number(placeholder[1]));
          return '([\\s\\S]*?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { regex: new RegExp(`^${source}$`, 'u'), placeholderOrder, translated };
    })
    .sort((a, b) => b.regex.source.length - a.regex.source.length);
  patternCache.set(locale, patterns);
  return patterns;
}

export function translateText(value: string, locale: AppLocale = activeLocale): string {
  if (locale === 'en') return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const endIndex = trailing.length > 0 ? value.length - trailing.length : value.length;
  const core = value.slice(leading.length, endIndex);
  const key = normalizeText(core);
  if (!key) return value;
  const legacyKey = key === 'Pipe Rifle' ? 'Pipe Rife' : undefined;
  const exact = translations[locale]?.[key]
    ?? supplementalTranslations[locale]?.[key]
    ?? languageSettingsTranslations[locale]?.[key]
    ?? (legacyKey ? translations[locale]?.[legacyKey] : undefined);
  if (exact !== undefined) return `${leading}${exact}${trailing}`;
  const capacity = translateWeaponCapacityLabel(key, locale);
  if (capacity !== undefined) return `${leading}${capacity}${trailing}`;
  const themeName = translateThemeName(key, locale);
  if (themeName !== undefined) return `${leading}${themeName}${trailing}`;
  const healingLabel = translateHealAllLabel(key, locale);
  if (healingLabel !== undefined) return `${leading}${healingLabel}${trailing}`;
  const cleanupLabel = translateStatusCleanupLabel(key, locale);
  if (cleanupLabel !== undefined) return `${leading}${cleanupLabel}${trailing}`;
  const trackerLabel = translateRoundTrackerLabel(key, locale);
  if (trackerLabel !== undefined) return `${leading}${trackerLabel}${trailing}`;
  for (const pattern of compiledPatterns(locale)) {
    const match = key.match(pattern.regex);
    if (!match) continue;
    const values = new Map<number, string>();
    pattern.placeholderOrder.forEach((placeholder, index) => values.set(placeholder, match[index + 1] ?? ''));
    const translated = pattern.translated.replace(/\{(\d+)\}/g, (_, index: string) => values.get(Number(index)) ?? `{${index}}`);
    return `${leading}${translated}${trailing}`;
  }
  return value;
}

const weaponCapacityLabels: Partial<Record<AppLocale, {
  fixed: (count: string) => string;
  variable: string;
  missing: string;
}>> = {
  fr: { fixed: count => `Contient ${count} cartouche${count === '1' ? '' : 's'}`, variable: 'La capacité varie selon le réservoir.', missing: 'Capacité non définie' },
  it: { fixed: count => `Contiene ${count} colpi`, variable: 'La capacità varia in base al serbatoio.', missing: 'Capacità non impostata' },
  de: { fixed: count => `Fasst ${count} Schuss`, variable: 'Die Kapazität variiert je nach Tank.', missing: 'Kapazität nicht festgelegt' },
  'es-ES': { fixed: count => `Contiene ${count} ${count === '1' ? 'cartucho' : 'cartuchos'}`, variable: 'La capacidad varía según el depósito.', missing: 'Capacidad no definida' },
  'es-MX': { fixed: count => `Contiene ${count} ${count === '1' ? 'cartucho' : 'cartuchos'}`, variable: 'La capacidad varía según el tanque.', missing: 'Capacidad no definida' },
  ja: { fixed: count => `${count}発装填`, variable: '装填数はタンクによって異なります。', missing: '容量未設定' },
  pl: { fixed: count => `Pojemność: ${count} szt.`, variable: 'Pojemność zależy od zbiornika.', missing: 'Pojemność nieustawiona' },
  'pt-BR': { fixed: count => `Contém ${count} ${count === '1' ? 'cartucho' : 'cartuchos'}`, variable: 'A capacidade varia conforme o tanque.', missing: 'Capacidade não definida' },
  ru: { fixed: count => `Вместимость: ${count} шт.`, variable: 'Вместимость зависит от бака.', missing: 'Вместимость не задана' },
  'zh-Hans': { fixed: count => `可容纳 ${count} 发`, variable: '容量因燃料罐而异。', missing: '容量未设置' },
  'zh-Hant': { fixed: count => `可容納 ${count} 發`, variable: '容量因燃料罐而異。', missing: '容量未設定' },
};

function translateWeaponCapacityLabel(key: string, locale: AppLocale): string | undefined {
  const labels = weaponCapacityLabels[locale];
  if (!labels) return undefined;
  if (key === 'Holds a variable number of rounds') return labels.variable;
  if (key === 'Capacity not set') return labels.missing;
  const fixedCapacity = key.match(/^Holds (\d+) Rounds?$/);
  return fixedCapacity ? labels.fixed(fixedCapacity[1]) : undefined;
}

const themeNames: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: { 'Western Amber': 'Ambre de l’Ouest', 'Eastern Green': 'Vert de l’Est' },
  it: { 'Western Amber': 'Ambra occidentale', 'Eastern Green': 'Verde orientale' },
  de: { 'Western Amber': 'Westliches Amber', 'Eastern Green': 'Östliches Grün' },
  'es-ES': { 'Western Amber': 'Ámbar occidental', 'Eastern Green': 'Verde oriental' },
  'es-MX': { 'Western Amber': 'Ámbar occidental', 'Eastern Green': 'Verde oriental' },
  ja: { 'Western Amber': '西部のアンバー', 'Eastern Green': '東部のグリーン' },
  pl: { 'Western Amber': 'Zachodni bursztyn', 'Eastern Green': 'Wschodnia zieleń' },
  'pt-BR': { 'Western Amber': 'Âmbar do Oeste', 'Eastern Green': 'Verde do Leste' },
  ru: { 'Western Amber': 'Западный янтарь', 'Eastern Green': 'Восточная зелень' },
  'zh-Hans': { 'Western Amber': '西部琥珀', 'Eastern Green': '东部绿色' },
  'zh-Hant': { 'Western Amber': '西部琥珀', 'Eastern Green': '東部綠色' },
};

function translateThemeName(key: string, locale: AppLocale): string | undefined {
  return themeNames[locale]?.[key];
}

const healAllLabels: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Heal All Characters': 'Soigner tous les personnages',
    'Are you sure?': 'Êtes-vous sûr ?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Tous les personnages actifs seront soignés au maximum de leurs PV. Les personnages en stockage ne seront pas modifiés.',
    'HEAL ALL': 'TOUT SOIGNER',
  },
  it: {
    'Heal All Characters': 'Cura tutti i personaggi',
    'Are you sure?': 'Sei sicuro?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Tutti i personaggi attivi torneranno ai PF massimi. I personaggi in deposito non verranno modificati.',
    'HEAL ALL': 'CURA TUTTI',
  },
  de: {
    'Heal All Characters': 'Alle Charaktere heilen',
    'Are you sure?': 'Bist du sicher?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Alle aktiven Charaktere werden auf ihre maximalen TP geheilt. Charaktere im Lager bleiben unverändert.',
    'HEAL ALL': 'ALLE HEILEN',
  },
  'es-ES': {
    'Heal All Characters': 'Curar a todos los personajes',
    'Are you sure?': '¿Estás seguro?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Todos los personajes activos recuperarán todos sus PV. Los personajes guardados no cambiarán.',
    'HEAL ALL': 'CURAR A TODOS',
  },
  'es-MX': {
    'Heal All Characters': 'Curar a todos los personajes',
    'Are you sure?': '¿Estás seguro?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Todos los personajes activos recuperarán todos sus PV. Los personajes guardados no cambiarán.',
    'HEAL ALL': 'CURAR A TODOS',
  },
  ja: {
    'Heal All Characters': '全キャラクターを回復',
    'Are you sure?': 'よろしいですか？',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': '有効なキャラクター全員のHPを最大まで回復します。保管中のキャラクターは変更されません。',
    'HEAL ALL': '全員を回復',
  },
  pl: {
    'Heal All Characters': 'Wylecz wszystkie postacie',
    'Are you sure?': 'Czy na pewno?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Wszystkie aktywne postacie odzyskają pełne PW. Postacie w magazynie pozostaną bez zmian.',
    'HEAL ALL': 'WYLECZ WSZYSTKICH',
  },
  'pt-BR': {
    'Heal All Characters': 'Curar todos os personagens',
    'Are you sure?': 'Tem certeza?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Todos os personagens ativos voltarão ao HP máximo. Os personagens no armazenamento não serão alterados.',
    'HEAL ALL': 'CURAR TODOS',
  },
  ru: {
    'Heal All Characters': 'Вылечить всех персонажей',
    'Are you sure?': 'Вы уверены?',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': 'Все активные персонажи восстановят здоровье до максимума. Персонажи в хранилище не изменятся.',
    'HEAL ALL': 'ВЫЛЕЧИТЬ ВСЕХ',
  },
  'zh-Hans': {
    'Heal All Characters': '治疗所有角色',
    'Are you sure?': '确定吗？',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': '所有启用角色的生命值将恢复至最大值。储存中的角色不会受到影响。',
    'HEAL ALL': '治疗全部',
  },
  'zh-Hant': {
    'Heal All Characters': '治療所有角色',
    'Are you sure?': '確定嗎？',
    'This will restore all active characters to full HP. Characters in storage will not be changed.': '所有啟用角色的生命值將恢復至最大值。儲存中的角色不會受到影響。',
    'HEAL ALL': '治療全部',
  },
};

function translateHealAllLabel(key: string, locale: AppLocale): string | undefined {
  return healAllLabels[locale]?.[key];
}

const statusCleanupLabels: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Remove All Status Effects': 'Supprimer tous les effets de statut',
    'Also Heal Injuries?': 'Soigner aussi les blessures ?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Faut-il aussi soigner les blessures, comme les membres cassés ? Elles resteront dans le dossier du personnage, mais seront marquées comme inactives.',
    'KEEP INJURIES': 'GARDER LES BLESSURES',
    'HEAL INJURIES': 'SOIGNER LES BLESSURES',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Cela supprime les effets temporaires (poison, inconscience, drogues, sevrage et dangers persistants) de tous les personnages actifs. Les personnages stockés, les PV, les radiations, l’armure et les effets des atouts restent inchangés.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Cela supprime les effets temporaires et désactive toutes les blessures des personnages actifs. Les personnages stockés, les PV, les radiations, l’armure et les effets des atouts restent inchangés.',
    'REMOVE ALL EFFECTS': 'SUPPRIMER TOUS LES EFFETS',
  },
  it: {
    'Remove All Status Effects': 'Rimuovi tutti gli effetti di stato',
    'Also Heal Injuries?': 'Curare anche le ferite?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Vuoi curare anche ferite come gli arti rotti? Le voci resteranno nella scheda del personaggio ma saranno contrassegnate come inattive.',
    'KEEP INJURIES': 'MANTIENI LE FERITE',
    'HEAL INJURIES': 'CURA LE FERITE',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Rimuove gli effetti temporanei (veleno, incoscienza, droghe, astinenza e pericoli persistenti) da tutti i personaggi attivi. Personaggi archiviati, PF, radiazioni, armatura ed effetti dei talenti non cambiano.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Rimuove gli effetti temporanei e disattiva tutte le ferite dei personaggi attivi. Personaggi archiviati, PF, radiazioni, armatura ed effetti dei talenti non cambiano.',
    'REMOVE ALL EFFECTS': 'RIMUOVI TUTTI GLI EFFETTI',
  },
  de: {
    'Remove All Status Effects': 'Alle Statuseffekte entfernen',
    'Also Heal Injuries?': 'Auch alle Verletzungen heilen?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Sollen auch Verletzungen wie gebrochene Gliedmaßen geheilt werden? Die Einträge bleiben erhalten, werden aber als inaktiv markiert.',
    'KEEP INJURIES': 'VERLETZUNGEN BEHALTEN',
    'HEAL INJURIES': 'VERLETZUNGEN HEILEN',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Dies entfernt vorübergehende Effekte (Gift, Bewusstlosigkeit, Drogenwirkungen, Entzug und anhaltende Gefahren) von allen aktiven Charakteren. Eingelagerte Charaktere, TP, Strahlung, Rüstung und Vorteile bleiben unverändert.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Dies entfernt vorübergehende Effekte und deaktiviert alle Verletzungen aktiver Charaktere. Eingelagerte Charaktere, TP, Strahlung, Rüstung und Vorteile bleiben unverändert.',
    'REMOVE ALL EFFECTS': 'ALLE EFFEKTE ENTFERNEN',
  },
  'es-ES': {
    'Remove All Status Effects': 'Eliminar todos los efectos de estado',
    'Also Heal Injuries?': '¿Curar también las heridas?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': '¿También quieres curar heridas como miembros rotos? Se conservarán en la ficha, pero quedarán marcadas como inactivas.',
    'KEEP INJURIES': 'MANTENER HERIDAS',
    'HEAL INJURIES': 'CURAR HERIDAS',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Elimina los efectos temporales (veneno, inconsciencia, drogas, abstinencia y peligros persistentes) de todos los personajes activos. Los personajes guardados, los PV, la radiación, la armadura y las ventajas no cambian.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Elimina los efectos temporales y desactiva todas las heridas de los personajes activos. Los personajes guardados, los PV, la radiación, la armadura y las ventajas no cambian.',
    'REMOVE ALL EFFECTS': 'ELIMINAR TODOS LOS EFECTOS',
  },
  'es-MX': {
    'Remove All Status Effects': 'Eliminar todos los efectos de estado',
    'Also Heal Injuries?': '¿Curar también las heridas?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': '¿También quieres curar heridas como extremidades rotas? Se conservarán en la ficha, pero quedarán marcadas como inactivas.',
    'KEEP INJURIES': 'CONSERVAR HERIDAS',
    'HEAL INJURIES': 'CURAR HERIDAS',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Elimina los efectos temporales (veneno, inconsciencia, drogas, abstinencia y peligros persistentes) de todos los personajes activos. Los personajes guardados, los PV, la radiación, la armadura y las ventajas no cambian.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Elimina los efectos temporales y desactiva todas las heridas de los personajes activos. Los personajes guardados, los PV, la radiación, la armadura y las ventajas no cambian.',
    'REMOVE ALL EFFECTS': 'ELIMINAR TODOS LOS EFECTOS',
  },
  ja: {
    'Remove All Status Effects': 'すべての状態効果を解除',
    'Also Heal Injuries?': '負傷も治しますか？',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': '骨折などの負傷も治しますか？記録は残り、非アクティブとして表示されます。',
    'KEEP INJURIES': '負傷を残す',
    'HEAL INJURIES': '負傷を治す',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'すべての使用中キャラクターから一時的な効果（毒、気絶、薬物効果、離脱症状、継続中の危険）を解除します。保管中のキャラクター、HP、放射線量、装備、Perkの効果は変更されません。',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': '使用中の全キャラクターから一時的な効果を解除し、負傷をすべて非アクティブにします。保管中のキャラクター、HP、放射線量、装備、Perkの効果は変更されません。',
    'REMOVE ALL EFFECTS': 'すべての効果を解除',
  },
  pl: {
    'Remove All Status Effects': 'Usuń wszystkie efekty statusu',
    'Also Heal Injuries?': 'Czy wyleczyć też rany?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Czy wyleczyć także rany, takie jak złamane kończyny? Wpisy pozostaną w karcie, ale zostaną oznaczone jako nieaktywne.',
    'KEEP INJURIES': 'ZOSTAW RANY',
    'HEAL INJURIES': 'WYLECZ RANY',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Usuwa tymczasowe efekty (truciznę, nieprzytomność, działanie narkotyków, odstawienie i trwające zagrożenia) ze wszystkich aktywnych postaci. Postacie w schowku, PW, promieniowanie, pancerz i efekty atutów pozostają bez zmian.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Usuwa tymczasowe efekty i dezaktywuje wszystkie rany aktywnych postaci. Postacie w schowku, PW, promieniowanie, pancerz i efekty atutów pozostają bez zmian.',
    'REMOVE ALL EFFECTS': 'USUŃ WSZYSTKIE EFEKTY',
  },
  'pt-BR': {
    'Remove All Status Effects': 'Remover todos os efeitos de status',
    'Also Heal Injuries?': 'Curar também os ferimentos?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Também deseja curar ferimentos como membros quebrados? Os registros serão mantidos, mas marcados como inativos.',
    'KEEP INJURIES': 'MANTER FERIMENTOS',
    'HEAL INJURIES': 'CURAR FERIMENTOS',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Remove os efeitos temporários (veneno, inconsciência, efeitos de drogas, abstinência e perigos contínuos) de todos os personagens ativos. Personagens armazenados, HP, radiação, armadura e efeitos de vantagens não serão alterados.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Remove os efeitos temporários e desativa todos os ferimentos dos personagens ativos. Personagens armazenados, HP, radiação, armadura e efeitos de vantagens não serão alterados.',
    'REMOVE ALL EFFECTS': 'REMOVER TODOS OS EFEITOS',
  },
  ru: {
    'Remove All Status Effects': 'Убрать все эффекты состояния',
    'Also Heal Injuries?': 'Также вылечить ранения?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': 'Вылечить также ранения, например переломы? Записи останутся, но будут помечены как неактивные.',
    'KEEP INJURIES': 'ОСТАВИТЬ РАНЕНИЯ',
    'HEAL INJURIES': 'ВЫЛЕЧИТЬ РАНЕНИЯ',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Удаляет временные эффекты (яд, потерю сознания, действие препаратов, абстиненцию и продолжающиеся опасности) у всех активных персонажей. Персонажи в хранилище, ОЗ, радиация, броня и эффекты перков не изменятся.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': 'Удаляет временные эффекты и отключает все ранения активных персонажей. Персонажи в хранилище, ОЗ, радиация, броня и эффекты перков не изменятся.',
    'REMOVE ALL EFFECTS': 'УБРАТЬ ВСЕ ЭФФЕКТЫ',
  },
  'zh-Hans': {
    'Remove All Status Effects': '移除所有状态效果',
    'Also Heal Injuries?': '同时治愈所有伤势？',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': '是否同时治愈骨折等伤势？记录会保留，但会标记为未生效。',
    'KEEP INJURIES': '保留伤势',
    'HEAL INJURIES': '治愈伤势',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': '移除所有启用角色的临时效果（中毒、昏迷、药物效果、戒断反应和持续危害）。储存角色、生命值、辐射值、护甲和专长效果不会改变。',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': '移除所有启用角色的临时效果，并将所有伤势标记为未生效。储存角色、生命值、辐射值、护甲和专长效果不会改变。',
    'REMOVE ALL EFFECTS': '移除所有效果',
  },
  'zh-Hant': {
    'Remove All Status Effects': '移除所有狀態效果',
    'Also Heal Injuries?': '同時治癒所有傷勢？',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.': '是否同時治癒骨折等傷勢？記錄會保留，但會標記為未生效。',
    'KEEP INJURIES': '保留傷勢',
    'HEAL INJURIES': '治癒傷勢',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': '移除所有啟用角色的暫時效果（中毒、昏迷、藥物效果、戒斷反應和持續危害）。儲存角色、生命值、輻射值、護甲和專長效果不會改變。',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.': '移除所有啟用角色的暫時效果，並將所有傷勢標記為未生效。儲存角色、生命值、輻射值、護甲和專長效果不會改變。',
    'REMOVE ALL EFFECTS': '移除所有效果',
  },
};

function translateStatusCleanupLabel(key: string, locale: AppLocale): string | undefined {
  return statusCleanupLabels[locale]?.[key];
}

const roundTrackerLabels: Partial<Record<AppLocale, string>> = {
  fr: 'INITIATIVE / SUIVI DES TOURS',
  it: 'INIZIATIVA / TRACCIATORE ROUND',
  de: 'INITIATIVE / RUNDENÜBERSICHT',
  'es-ES': 'INICIATIVA / SEGUIMIENTO DE RONDAS',
  'es-MX': 'INICIATIVA / SEGUIMIENTO DE RONDAS',
  ja: 'イニシアチブ / ラウンド管理',
  pl: 'INICJATYWA / ŚLEDZENIE RUND',
  'pt-BR': 'INICIATIVA / RASTREADOR DE RODADAS',
  ru: 'ИНИЦИАТИВА / ОТСЛЕЖИВАНИЕ РАУНДОВ',
  'zh-Hans': '先攻 / 回合追踪',
  'zh-Hant': '先攻 / 回合追蹤',
};

function translateRoundTrackerLabel(key: string, locale: AppLocale): string | undefined {
  return key === 'INITIATIVE / ROUND TRACKER' ? roundTrackerLabels[locale] : undefined;
}
