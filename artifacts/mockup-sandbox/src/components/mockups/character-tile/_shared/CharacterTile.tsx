import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  Heart,
  Trash2,
} from "lucide-react";

type CharacterTileProps = {
  portraitBackground?: boolean;
};

const specialStats = [
  ["STR", "6"],
  ["PER", "8"],
  ["END", "5"],
  ["CHA", "4"],
  ["INT", "8"],
  ["AGI", "9"],
  ["LCK", "6"],
];

function PortraitArt() {
  return (
    <div className="portrait-art" aria-hidden="true">
      <div className="portrait-sun" />
      <div className="portrait-head" />
      <div className="portrait-neck" />
      <div className="portrait-shoulders" />
      <div className="portrait-coat" />
      <div className="portrait-scarf" />
    </div>
  );
}

function ActionIcons() {
  return (
    <div className="character-actions" aria-label="Character actions">
      <div className="action-pair">
        <ArrowUp />
        <ArrowDown />
      </div>
      <Heart className="action-heal" />
      <BookOpen />
      <Archive />
      <Copy />
      <Trash2 className="action-delete" />
    </div>
  );
}

export function CharacterTile({ portraitBackground = false }: CharacterTileProps) {
  return (
    <main className="preview-stage">
      <article className={`character-card ${portraitBackground ? "portrait-background" : ""}`}>
        {portraitBackground && (
          <>
            <PortraitArt />
            <div className="portrait-scrim" aria-hidden="true" />
          </>
        )}

        <div className="card-content">
          <header className="character-header">
            {!portraitBackground && (
              <div className="small-portrait" aria-label="Portrait preview">
                <PortraitArt />
              </div>
            )}
            <div className="identity">
              <div className="name-row">
                <h2>Mara Vance</h2>
                <span className="type-badge">PC</span>
                <span className="injury-badge"><Heart size={11} /> 1</span>
              </div>
              <p>Lv 8 Human · Laser Pistol</p>
              <p>HP 54/68 · AC 6 · AP 9/9 · SEQ 10</p>
              <p>Carry 82 lb · Night Person DAY</p>
              <p className="radiation-line">RAD 34/1000 · Healthy</p>
            </div>
            <ActionIcons />
          </header>

          <div className="tag-row">
            <span className="trait-chip">Gifted</span>
            <span className="trait-chip">Night Person</span>
            <span className="trait-chip muted-chip">Aiming</span>
          </div>

          <div className="perk-reminder">
            <strong>PERK REMINDER</strong>
            <span>Marksmanship improves aimed shots.</span>
          </div>

          <div className="special-row" aria-label="SPECIAL stats">
            {specialStats.map(([label, value]) => (
              <div className="special-cell" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="status-line">
            <span>Minor arm injury</span>
            <span>Active</span>
          </div>

          <div className="health-track" aria-label="Health 54 of 68">
            <span />
          </div>
        </div>
      </article>
    </main>
  );
}
