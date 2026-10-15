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
  fr: { 'No Armor': 'Aucune armure', 'No Weapon': 'Aucune arme', 'NEW CHARACTER': 'NOUVEAU PERSONNAGE' },
  it: { 'No Armor': 'Nessuna armatura', 'No Weapon': 'Nessuna arma', 'NEW CHARACTER': 'NUOVO PERSONAGGIO' },
  de: { 'No Armor': 'Keine Rüstung', 'No Weapon': 'Keine Waffe', 'NEW CHARACTER': 'NEUER CHARAKTER' },
  'es-ES': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma', 'NEW CHARACTER': 'NUEVO PERSONAJE' },
  'es-MX': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma', 'NEW CHARACTER': 'NUEVO PERSONAJE' },
  ja: { 'No Armor': '防具なし', 'No Weapon': '武器なし', 'NEW CHARACTER': '新しいキャラクター' },
  pl: { 'No Armor': 'Brak pancerza', 'No Weapon': 'Brak broni', 'NEW CHARACTER': 'NOWA POSTAĆ' },
  'pt-BR': { 'No Armor': 'Sem armadura', 'No Weapon': 'Sem arma', 'NEW CHARACTER': 'NOVO PERSONAGEM' },
  ru: { 'No Armor': 'Без брони', 'No Weapon': 'Без оружия', 'NEW CHARACTER': 'НОВЫЙ ПЕРСОНАЖ' },
  'zh-Hans': { 'No Armor': '无护甲', 'No Weapon': '无武器', 'NEW CHARACTER': '新角色' },
  'zh-Hant': { 'No Armor': '無護甲', 'No Weapon': '無武器', 'NEW CHARACTER': '新角色' },
};
const campaignMenuTranslations: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    Continue: 'Continuer', 'Main Menu': 'Menu principal', 'New Campaign': 'Nouvelle campagne', 'Load Campaign': 'Charger une campagne',
    Options: 'Options', 'Campaign management system': 'Système de gestion de campagne',
    'Choose a language': 'Choisir une langue', 'Campaign Library': 'Bibliothèque de campagnes',
    'Saved JSON campaigns stay on this device.': 'Les campagnes JSON enregistrées restent sur cet appareil.',
    'Save Current Campaign': 'Enregistrer la campagne actuelle', 'Upload JSON': 'Importer un fichier JSON',
    'Campaign name': 'Nom de la campagne', 'Description (optional)': 'Description (facultative)',
    'Add a campaign description': 'Ajouter une description à la campagne', Save: 'Enregistrer', Cancel: 'Annuler',
    'Save description': 'Enregistrer la description', Characters: 'Personnages', 'Custom NPCs': 'PNJ personnalisés',
    Equipment: 'Équipement', Description: 'Description', Load: 'Charger', Export: 'Exporter', Delete: 'Supprimer',
    'Rename campaign': 'Renommer la campagne', 'Are you sure?': 'Êtes-vous sûr ?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Cela remplace la campagne actuelle. Enregistrez-la d’abord pour la conserver et pouvoir la recharger plus tard.',
    'Loading will replace unsaved changes in the current campaign.': 'Le chargement remplacera les modifications non enregistrées de la campagne actuelle.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Supprimer cette campagne enregistrée de cet appareil ? Cette action est irréversible.',
    'Campaign saved.': 'Campagne enregistrée.', 'Campaign imported.': 'Campagne importée.',
    'Campaign exported.': 'Campagne exportée.',
    'Campaign deleted.': 'Campagne supprimée.', 'Description saved.': 'Description enregistrée.',
    'Campaign renamed.': 'Campagne renommée.', 'Campaign name is required.': 'Le nom de la campagne est obligatoire.',
    'Could not save campaign.': 'Impossible d’enregistrer la campagne.', 'Could not open JSON file.': 'Impossible d’ouvrir le fichier JSON.',
    'Could not delete campaign.': 'Impossible de supprimer la campagne.', 'Could not rename campaign.': 'Impossible de renommer la campagne.',
    'Could not save description.': 'Impossible d’enregistrer la description.', 'Could not export campaign.': 'Impossible d’exporter la campagne.',
    'Campaign could not be read.': 'Impossible de lire la campagne.', 'Campaign could not be loaded.': 'Impossible de charger la campagne.',
    'Loading current campaign…': 'Chargement de la campagne actuelle…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Aucune campagne enregistrée. Enregistrez la campagne actuelle ou importez un fichier JSON.',
    'Start New Campaign': 'Commencer une nouvelle campagne',
  },
  it: {
    Continue: 'Continua', 'Main Menu': 'Menu principale', 'New Campaign': 'Nuova campagna', 'Load Campaign': 'Carica campagna',
    Options: 'Opzioni', 'Campaign management system': 'Sistema di gestione delle campagne',
    'Choose a language': 'Scegli una lingua', 'Campaign Library': 'Archivio campagne',
    'Saved JSON campaigns stay on this device.': 'Le campagne JSON salvate restano su questo dispositivo.',
    'Save Current Campaign': 'Salva campagna corrente', 'Upload JSON': 'Carica file JSON',
    'Campaign name': 'Nome campagna', 'Description (optional)': 'Descrizione (facoltativa)',
    'Add a campaign description': 'Aggiungi una descrizione alla campagna', Save: 'Salva', Cancel: 'Annulla',
    'Save description': 'Salva descrizione', Characters: 'Personaggi', 'Custom NPCs': 'PNG personalizzati',
    Equipment: 'Equipaggiamento', Description: 'Descrizione', Load: 'Carica', Export: 'Esporta', Delete: 'Elimina',
    'Rename campaign': 'Rinomina campagna', 'Are you sure?': 'Sei sicuro?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Questa operazione sostituisce la campagna caricata. Salvala prima per conservarla e poterla ricaricare in seguito.',
    'Loading will replace unsaved changes in the current campaign.': 'Il caricamento sostituirà le modifiche non salvate alla campagna corrente.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Eliminare questa campagna salvata dal dispositivo? L’operazione non può essere annullata.',
    'Campaign saved.': 'Campagna salvata.', 'Campaign imported.': 'Campagna importata.',
    'Campaign exported.': 'Campagna esportata.',
    'Campaign deleted.': 'Campagna eliminata.', 'Description saved.': 'Descrizione salvata.',
    'Campaign renamed.': 'Campagna rinominata.', 'Campaign name is required.': 'Il nome della campagna è obbligatorio.',
    'Could not save campaign.': 'Impossibile salvare la campagna.', 'Could not open JSON file.': 'Impossibile aprire il file JSON.',
    'Could not delete campaign.': 'Impossibile eliminare la campagna.', 'Could not rename campaign.': 'Impossibile rinominare la campagna.',
    'Could not save description.': 'Impossibile salvare la descrizione.', 'Could not export campaign.': 'Impossibile esportare la campagna.',
    'Campaign could not be read.': 'Impossibile leggere la campagna.', 'Campaign could not be loaded.': 'Impossibile caricare la campagna.',
    'Loading current campaign…': 'Caricamento della campagna corrente…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Nessuna campagna salvata. Salva quella corrente o carica un file JSON.',
    'Start New Campaign': 'Inizia nuova campagna',
  },
  de: {
    Continue: 'Fortfahren', 'Main Menu': 'Hauptmenü', 'New Campaign': 'Neue Kampagne', 'Load Campaign': 'Kampagne laden',
    Options: 'Optionen', 'Campaign management system': 'Kampagnenverwaltungssystem',
    'Choose a language': 'Sprache auswählen', 'Campaign Library': 'Kampagnenbibliothek',
    'Saved JSON campaigns stay on this device.': 'Gespeicherte JSON-Kampagnen bleiben auf diesem Gerät.',
    'Save Current Campaign': 'Aktuelle Kampagne speichern', 'Upload JSON': 'JSON-Datei hochladen',
    'Campaign name': 'Kampagnenname', 'Description (optional)': 'Beschreibung (optional)',
    'Add a campaign description': 'Kampagnenbeschreibung hinzufügen', Save: 'Speichern', Cancel: 'Abbrechen',
    'Save description': 'Beschreibung speichern', Characters: 'Charaktere', 'Custom NPCs': 'Eigene NSCs',
    Equipment: 'Ausrüstung', Description: 'Beschreibung', Load: 'Laden', Export: 'Exportieren', Delete: 'Löschen',
    'Rename campaign': 'Kampagne umbenennen', 'Are you sure?': 'Bist du sicher?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Die aktuell geladene Kampagne wird ersetzt. Speichere sie vorher, wenn du sie später erneut laden möchtest.',
    'Loading will replace unsaved changes in the current campaign.': 'Beim Laden gehen nicht gespeicherte Änderungen der aktuellen Kampagne verloren.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Diese gespeicherte Kampagne von diesem Gerät löschen? Das kann nicht rückgängig gemacht werden.',
    'Campaign saved.': 'Kampagne gespeichert.', 'Campaign imported.': 'Kampagne importiert.',
    'Campaign exported.': 'Kampagne exportiert.',
    'Campaign deleted.': 'Kampagne gelöscht.', 'Description saved.': 'Beschreibung gespeichert.',
    'Campaign renamed.': 'Kampagne umbenannt.', 'Campaign name is required.': 'Ein Kampagnenname ist erforderlich.',
    'Could not save campaign.': 'Kampagne konnte nicht gespeichert werden.', 'Could not open JSON file.': 'JSON-Datei konnte nicht geöffnet werden.',
    'Could not delete campaign.': 'Kampagne konnte nicht gelöscht werden.', 'Could not rename campaign.': 'Kampagne konnte nicht umbenannt werden.',
    'Could not save description.': 'Beschreibung konnte nicht gespeichert werden.', 'Could not export campaign.': 'Kampagne konnte nicht exportiert werden.',
    'Campaign could not be read.': 'Kampagne konnte nicht gelesen werden.', 'Campaign could not be loaded.': 'Kampagne konnte nicht geladen werden.',
    'Loading current campaign…': 'Aktuelle Kampagne wird geladen…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Noch keine Kampagnen gespeichert. Speichere die aktuelle Kampagne oder lade eine JSON-Datei hoch.',
    'Start New Campaign': 'Neue Kampagne starten',
  },
  'es-ES': {
    Continue: 'Continuar', 'Main Menu': 'Menú principal', 'New Campaign': 'Nueva campaña', 'Load Campaign': 'Cargar campaña',
    Options: 'Opciones', 'Campaign management system': 'Sistema de gestión de campañas',
    'Choose a language': 'Elegir idioma', 'Campaign Library': 'Biblioteca de campañas',
    'Saved JSON campaigns stay on this device.': 'Las campañas JSON guardadas permanecen en este dispositivo.',
    'Save Current Campaign': 'Guardar campaña actual', 'Upload JSON': 'Subir JSON',
    'Campaign name': 'Nombre de la campaña', 'Description (optional)': 'Descripción (opcional)',
    'Add a campaign description': 'Añadir una descripción a la campaña', Save: 'Guardar', Cancel: 'Cancelar',
    'Save description': 'Guardar descripción', Characters: 'Personajes', 'Custom NPCs': 'PNJ personalizados',
    Equipment: 'Equipo', Description: 'Descripción', Load: 'Cargar', Export: 'Exportar', Delete: 'Eliminar',
    'Rename campaign': 'Cambiar nombre de campaña', 'Are you sure?': '¿Estás seguro?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Esto reemplazará la campaña cargada. Guárdala primero si quieres conservarla y cargarla más adelante.',
    'Loading will replace unsaved changes in the current campaign.': 'Al cargar se reemplazarán los cambios sin guardar de la campaña actual.',
    'Delete this saved campaign from this device? This cannot be undone.': '¿Eliminar esta campaña guardada del dispositivo? No se puede deshacer.',
    'Campaign saved.': 'Campaña guardada.', 'Campaign imported.': 'Campaña importada.',
    'Campaign exported.': 'Campaña exportada.',
    'Campaign deleted.': 'Campaña eliminada.', 'Description saved.': 'Descripción guardada.',
    'Campaign renamed.': 'Campaña renombrada.', 'Campaign name is required.': 'El nombre de la campaña es obligatorio.',
    'Could not save campaign.': 'No se pudo guardar la campaña.', 'Could not open JSON file.': 'No se pudo abrir el archivo JSON.',
    'Could not delete campaign.': 'No se pudo eliminar la campaña.', 'Could not rename campaign.': 'No se pudo cambiar el nombre de la campaña.',
    'Could not save description.': 'No se pudo guardar la descripción.', 'Could not export campaign.': 'No se pudo exportar la campaña.',
    'Campaign could not be read.': 'No se pudo leer la campaña.', 'Campaign could not be loaded.': 'No se pudo cargar la campaña.',
    'Loading current campaign…': 'Cargando campaña actual…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Aún no hay campañas guardadas. Guarda la campaña actual o sube un archivo JSON.',
    'Start New Campaign': 'Iniciar campaña nueva',
  },
  'es-MX': {
    Continue: 'Continuar', 'Main Menu': 'Menú principal', 'New Campaign': 'Nueva campaña', 'Load Campaign': 'Cargar campaña',
    Options: 'Opciones', 'Campaign management system': 'Sistema de gestión de campañas',
    'Choose a language': 'Elegir idioma', 'Campaign Library': 'Biblioteca de campañas',
    'Saved JSON campaigns stay on this device.': 'Las campañas JSON guardadas se quedan en este dispositivo.',
    'Save Current Campaign': 'Guardar campaña actual', 'Upload JSON': 'Subir JSON',
    'Campaign name': 'Nombre de la campaña', 'Description (optional)': 'Descripción (opcional)',
    'Add a campaign description': 'Agregar una descripción a la campaña', Save: 'Guardar', Cancel: 'Cancelar',
    'Save description': 'Guardar descripción', Characters: 'Personajes', 'Custom NPCs': 'PNJ personalizados',
    Equipment: 'Equipo', Description: 'Descripción', Load: 'Cargar', Export: 'Exportar', Delete: 'Eliminar',
    'Rename campaign': 'Cambiar nombre de campaña', 'Are you sure?': '¿Estás seguro?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Esto reemplazará la campaña actual. Guárdala primero si quieres conservarla y cargarla después.',
    'Loading will replace unsaved changes in the current campaign.': 'Al cargar se reemplazarán los cambios sin guardar de la campaña actual.',
    'Delete this saved campaign from this device? This cannot be undone.': '¿Eliminar esta campaña guardada del dispositivo? Esta acción no se puede deshacer.',
    'Campaign saved.': 'Campaña guardada.', 'Campaign imported.': 'Campaña importada.',
    'Campaign exported.': 'Campaña exportada.',
    'Campaign deleted.': 'Campaña eliminada.', 'Description saved.': 'Descripción guardada.',
    'Campaign renamed.': 'Campaña renombrada.', 'Campaign name is required.': 'El nombre de la campaña es obligatorio.',
    'Could not save campaign.': 'No se pudo guardar la campaña.', 'Could not open JSON file.': 'No se pudo abrir el archivo JSON.',
    'Could not delete campaign.': 'No se pudo eliminar la campaña.', 'Could not rename campaign.': 'No se pudo cambiar el nombre de la campaña.',
    'Could not save description.': 'No se pudo guardar la descripción.', 'Could not export campaign.': 'No se pudo exportar la campaña.',
    'Campaign could not be read.': 'No se pudo leer la campaña.', 'Campaign could not be loaded.': 'No se pudo cargar la campaña.',
    'Loading current campaign…': 'Cargando la campaña actual…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Aún no hay campañas guardadas. Guarda la campaña actual o sube un archivo JSON.',
    'Start New Campaign': 'Iniciar campaña nueva',
  },
  ja: {
    Continue: '続ける', 'Main Menu': 'メインメニュー', 'New Campaign': '新しいキャンペーン', 'Load Campaign': 'キャンペーンを読み込む',
    Options: 'オプション', 'Campaign management system': 'キャンペーン管理システム',
    'Choose a language': '言語を選択', 'Campaign Library': 'キャンペーンライブラリ',
    'Saved JSON campaigns stay on this device.': '保存したJSONキャンペーンはこの端末に保存されます。',
    'Save Current Campaign': '現在のキャンペーンを保存', 'Upload JSON': 'JSONをアップロード',
    'Campaign name': 'キャンペーン名', 'Description (optional)': '説明（任意）',
    'Add a campaign description': 'キャンペーンの説明を追加', Save: '保存', Cancel: 'キャンセル',
    'Save description': '説明を保存', Characters: 'キャラクター', 'Custom NPCs': 'カスタムNPC',
    Equipment: '装備', Description: '説明', Load: '読み込む', Export: 'エクスポート', Delete: '削除',
    'Rename campaign': 'キャンペーン名を変更', 'Are you sure?': 'よろしいですか？',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': '現在のキャンペーンは置き換えられます。後で読み込めるよう、残したい場合は先に保存してください。',
    'Loading will replace unsaved changes in the current campaign.': '読み込むと現在のキャンペーンの未保存の変更は置き換えられます。',
    'Delete this saved campaign from this device? This cannot be undone.': 'この端末から保存済みキャンペーンを削除しますか？元に戻せません。',
    'Campaign saved.': 'キャンペーンを保存しました。', 'Campaign imported.': 'キャンペーンを追加しました。',
    'Campaign exported.': 'キャンペーンをエクスポートしました。',
    'Campaign deleted.': 'キャンペーンを削除しました。', 'Description saved.': '説明を保存しました。',
    'Campaign renamed.': 'キャンペーン名を変更しました。', 'Campaign name is required.': 'キャンペーン名を入力してください。',
    'Could not save campaign.': 'キャンペーンを保存できませんでした。', 'Could not open JSON file.': 'JSONファイルを開けませんでした。',
    'Could not delete campaign.': 'キャンペーンを削除できませんでした。', 'Could not rename campaign.': 'キャンペーン名を変更できませんでした。',
    'Could not save description.': '説明を保存できませんでした。', 'Could not export campaign.': 'キャンペーンをエクスポートできませんでした。',
    'Campaign could not be read.': 'キャンペーンを読み込めませんでした。', 'Campaign could not be loaded.': 'キャンペーンを読み込めませんでした。',
    'Loading current campaign…': '現在のキャンペーンを読み込み中…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': '保存済みキャンペーンはありません。現在のキャンペーンを保存するか、JSONファイルをアップロードしてください。',
    'Start New Campaign': '新しいキャンペーンを開始',
  },
  pl: {
    Continue: 'Kontynuuj', 'Main Menu': 'Menu główne', 'New Campaign': 'Nowa kampania', 'Load Campaign': 'Wczytaj kampanię',
    Options: 'Opcje', 'Campaign management system': 'System zarządzania kampanią',
    'Choose a language': 'Wybierz język', 'Campaign Library': 'Biblioteka kampanii',
    'Saved JSON campaigns stay on this device.': 'Zapisane kampanie JSON pozostają na tym urządzeniu.',
    'Save Current Campaign': 'Zapisz bieżącą kampanię', 'Upload JSON': 'Prześlij plik JSON',
    'Campaign name': 'Nazwa kampanii', 'Description (optional)': 'Opis (opcjonalnie)',
    'Add a campaign description': 'Dodaj opis kampanii', Save: 'Zapisz', Cancel: 'Anuluj',
    'Save description': 'Zapisz opis', Characters: 'Postacie', 'Custom NPCs': 'Własne postacie NPC',
    Equipment: 'Wyposażenie', Description: 'Opis', Load: 'Wczytaj', Export: 'Eksportuj', Delete: 'Usuń',
    'Rename campaign': 'Zmień nazwę kampanii', 'Are you sure?': 'Czy na pewno?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Zastąpi to obecnie wczytaną kampanię. Najpierw ją zapisz, jeśli chcesz zachować ją do późniejszego wczytania.',
    'Loading will replace unsaved changes in the current campaign.': 'Wczytanie zastąpi niezapisane zmiany w bieżącej kampanii.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Usunąć zapisaną kampanię z tego urządzenia? Tej czynności nie można cofnąć.',
    'Campaign saved.': 'Kampania zapisana.', 'Campaign imported.': 'Kampania zaimportowana.',
    'Campaign exported.': 'Kampania wyeksportowana.',
    'Campaign deleted.': 'Kampania usunięta.', 'Description saved.': 'Opis zapisany.',
    'Campaign renamed.': 'Zmieniono nazwę kampanii.', 'Campaign name is required.': 'Nazwa kampanii jest wymagana.',
    'Could not save campaign.': 'Nie udało się zapisać kampanii.', 'Could not open JSON file.': 'Nie udało się otworzyć pliku JSON.',
    'Could not delete campaign.': 'Nie udało się usunąć kampanii.', 'Could not rename campaign.': 'Nie udało się zmienić nazwy kampanii.',
    'Could not save description.': 'Nie udało się zapisać opisu.', 'Could not export campaign.': 'Nie udało się wyeksportować kampanii.',
    'Campaign could not be read.': 'Nie udało się odczytać kampanii.', 'Campaign could not be loaded.': 'Nie udało się wczytać kampanii.',
    'Loading current campaign…': 'Wczytywanie bieżącej kampanii…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Brak zapisanych kampanii. Zapisz bieżącą kampanię lub prześlij plik JSON.',
    'Start New Campaign': 'Rozpocznij nową kampanię',
  },
  'pt-BR': {
    Continue: 'Continuar', 'Main Menu': 'Menu principal', 'New Campaign': 'Nova campanha', 'Load Campaign': 'Carregar campanha',
    Options: 'Opções', 'Campaign management system': 'Sistema de gerenciamento de campanha',
    'Choose a language': 'Escolha um idioma', 'Campaign Library': 'Biblioteca de campanhas',
    'Saved JSON campaigns stay on this device.': 'As campanhas JSON salvas ficam neste dispositivo.',
    'Save Current Campaign': 'Salvar campanha atual', 'Upload JSON': 'Enviar JSON',
    'Campaign name': 'Nome da campanha', 'Description (optional)': 'Descrição (opcional)',
    'Add a campaign description': 'Adicionar descrição da campanha', Save: 'Salvar', Cancel: 'Cancelar',
    'Save description': 'Salvar descrição', Characters: 'Personagens', 'Custom NPCs': 'NPCs personalizados',
    Equipment: 'Equipamento', Description: 'Descrição', Load: 'Carregar', Export: 'Exportar', Delete: 'Excluir',
    'Rename campaign': 'Renomear campanha', 'Are you sure?': 'Tem certeza?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Isso substituirá a campanha carregada. Salve-a antes se quiser mantê-la para carregar mais tarde.',
    'Loading will replace unsaved changes in the current campaign.': 'Carregar substituirá as alterações não salvas da campanha atual.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Excluir esta campanha salva deste dispositivo? Não é possível desfazer.',
    'Campaign saved.': 'Campanha salva.', 'Campaign imported.': 'Campanha importada.',
    'Campaign exported.': 'Campanha exportada.',
    'Campaign deleted.': 'Campanha excluída.', 'Description saved.': 'Descrição salva.',
    'Campaign renamed.': 'Campanha renomeada.', 'Campaign name is required.': 'O nome da campanha é obrigatório.',
    'Could not save campaign.': 'Não foi possível salvar a campanha.', 'Could not open JSON file.': 'Não foi possível abrir o arquivo JSON.',
    'Could not delete campaign.': 'Não foi possível excluir a campanha.', 'Could not rename campaign.': 'Não foi possível renomear a campanha.',
    'Could not save description.': 'Não foi possível salvar a descrição.', 'Could not export campaign.': 'Não foi possível exportar a campanha.',
    'Campaign could not be read.': 'Não foi possível ler a campanha.', 'Campaign could not be loaded.': 'Não foi possível carregar a campanha.',
    'Loading current campaign…': 'Carregando a campanha atual…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Ainda não há campanhas salvas. Salve a campanha atual ou envie um arquivo JSON.',
    'Start New Campaign': 'Iniciar nova campanha',
  },
  ru: {
    Continue: 'Продолжить', 'Main Menu': 'Главное меню', 'New Campaign': 'Новая кампания', 'Load Campaign': 'Загрузить кампанию',
    Options: 'Настройки', 'Campaign management system': 'Система управления кампанией',
    'Choose a language': 'Выберите язык', 'Campaign Library': 'Библиотека кампаний',
    'Saved JSON campaigns stay on this device.': 'Сохранённые кампании JSON остаются на этом устройстве.',
    'Save Current Campaign': 'Сохранить текущую кампанию', 'Upload JSON': 'Загрузить JSON',
    'Campaign name': 'Название кампании', 'Description (optional)': 'Описание (необязательно)',
    'Add a campaign description': 'Добавить описание кампании', Save: 'Сохранить', Cancel: 'Отмена',
    'Save description': 'Сохранить описание', Characters: 'Персонажи', 'Custom NPCs': 'Свои NPC',
    Equipment: 'Снаряжение', Description: 'Описание', Load: 'Загрузить', Export: 'Экспорт', Delete: 'Удалить',
    'Rename campaign': 'Переименовать кампанию', 'Are you sure?': 'Вы уверены?',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': 'Текущая кампания будет заменена. Сначала сохраните её, если хотите загрузить её позже.',
    'Loading will replace unsaved changes in the current campaign.': 'Загрузка заменит несохранённые изменения текущей кампании.',
    'Delete this saved campaign from this device? This cannot be undone.': 'Удалить сохранённую кампанию с устройства? Это действие нельзя отменить.',
    'Campaign saved.': 'Кампания сохранена.', 'Campaign imported.': 'Кампания импортирована.',
    'Campaign exported.': 'Кампания экспортирована.',
    'Campaign deleted.': 'Кампания удалена.', 'Description saved.': 'Описание сохранено.',
    'Campaign renamed.': 'Кампания переименована.', 'Campaign name is required.': 'Введите название кампании.',
    'Could not save campaign.': 'Не удалось сохранить кампанию.', 'Could not open JSON file.': 'Не удалось открыть файл JSON.',
    'Could not delete campaign.': 'Не удалось удалить кампанию.', 'Could not rename campaign.': 'Не удалось переименовать кампанию.',
    'Could not save description.': 'Не удалось сохранить описание.', 'Could not export campaign.': 'Не удалось экспортировать кампанию.',
    'Campaign could not be read.': 'Не удалось прочитать кампанию.', 'Campaign could not be loaded.': 'Не удалось загрузить кампанию.',
    'Loading current campaign…': 'Загрузка текущей кампании…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': 'Сохранённых кампаний нет. Сохраните текущую кампанию или загрузите файл JSON.',
    'Start New Campaign': 'Начать новую кампанию',
  },
  'zh-Hans': {
    Continue: '继续', 'Main Menu': '主菜单', 'New Campaign': '新建战役', 'Load Campaign': '加载战役',
    Options: '选项', 'Campaign management system': '战役管理系统',
    'Choose a language': '选择语言', 'Campaign Library': '战役库',
    'Saved JSON campaigns stay on this device.': '保存的 JSON 战役保留在此设备上。',
    'Save Current Campaign': '保存当前战役', 'Upload JSON': '上传 JSON',
    'Campaign name': '战役名称', 'Description (optional)': '描述（可选）',
    'Add a campaign description': '添加战役描述', Save: '保存', Cancel: '取消',
    'Save description': '保存描述', Characters: '角色', 'Custom NPCs': '自定义 NPC',
    Equipment: '装备', Description: '描述', Load: '加载', Export: '导出', Delete: '删除',
    'Rename campaign': '重命名战役', 'Are you sure?': '确定吗？',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': '这会替换当前加载的战役。若要保留，请先保存，以便之后重新加载。',
    'Loading will replace unsaved changes in the current campaign.': '加载后将替换当前战役中未保存的更改。',
    'Delete this saved campaign from this device? This cannot be undone.': '从此设备删除这个已保存的战役？此操作无法撤销。',
    'Campaign saved.': '战役已保存。', 'Campaign imported.': '战役已导入。',
    'Campaign exported.': '战役已导出。',
    'Campaign deleted.': '战役已删除。', 'Description saved.': '描述已保存。',
    'Campaign renamed.': '战役已重命名。', 'Campaign name is required.': '请填写战役名称。',
    'Could not save campaign.': '无法保存战役。', 'Could not open JSON file.': '无法打开 JSON 文件。',
    'Could not delete campaign.': '无法删除战役。', 'Could not rename campaign.': '无法重命名战役。',
    'Could not save description.': '无法保存描述。', 'Could not export campaign.': '无法导出战役。',
    'Campaign could not be read.': '无法读取战役。', 'Campaign could not be loaded.': '无法加载战役。',
    'Loading current campaign…': '正在加载当前战役…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': '尚无已保存的战役。请保存当前战役或上传 JSON 文件。',
    'Start New Campaign': '开始新战役',
  },
  'zh-Hant': {
    Continue: '繼續', 'Main Menu': '主選單', 'New Campaign': '建立新戰役', 'Load Campaign': '載入戰役',
    Options: '選項', 'Campaign management system': '戰役管理系統',
    'Choose a language': '選擇語言', 'Campaign Library': '戰役庫',
    'Saved JSON campaigns stay on this device.': '已儲存的 JSON 戰役會保留在此裝置。',
    'Save Current Campaign': '儲存目前戰役', 'Upload JSON': '上傳 JSON',
    'Campaign name': '戰役名稱', 'Description (optional)': '說明（選填）',
    'Add a campaign description': '新增戰役說明', Save: '儲存', Cancel: '取消',
    'Save description': '儲存說明', Characters: '角色', 'Custom NPCs': '自訂 NPC',
    Equipment: '裝備', Description: '說明', Load: '載入', Export: '匯出', Delete: '刪除',
    'Rename campaign': '重新命名戰役', 'Are you sure?': '確定嗎？',
    'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.': '這會取代目前載入的戰役。若要保留，請先儲存，之後才能重新載入。',
    'Loading will replace unsaved changes in the current campaign.': '載入後會取代目前戰役中尚未儲存的變更。',
    'Delete this saved campaign from this device? This cannot be undone.': '要從此裝置刪除此已儲存的戰役嗎？此操作無法復原。',
    'Campaign saved.': '戰役已儲存。', 'Campaign imported.': '戰役已匯入。',
    'Campaign exported.': '戰役已匯出。',
    'Campaign deleted.': '戰役已刪除。', 'Description saved.': '說明已儲存。',
    'Campaign renamed.': '戰役已重新命名。', 'Campaign name is required.': '請輸入戰役名稱。',
    'Could not save campaign.': '無法儲存戰役。', 'Could not open JSON file.': '無法開啟 JSON 檔案。',
    'Could not delete campaign.': '無法刪除戰役。', 'Could not rename campaign.': '無法重新命名戰役。',
    'Could not save description.': '無法儲存說明。', 'Could not export campaign.': '無法匯出戰役。',
    'Campaign could not be read.': '無法讀取戰役。', 'Campaign could not be loaded.': '無法載入戰役。',
    'Loading current campaign…': '正在載入目前戰役…',
    'No saved campaigns yet. Save the current campaign or upload a JSON file.': '尚無已儲存的戰役。請儲存目前戰役或上傳 JSON 檔案。',
    'Start New Campaign': '開始新戰役',
  },
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
    ?? campaignMenuTranslations[locale]?.[key]
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
