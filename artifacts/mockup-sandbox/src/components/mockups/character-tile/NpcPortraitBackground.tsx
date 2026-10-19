import { ChevronRight, Crosshair, Shield, Sparkles } from "lucide-react";
import "./_group.css";
import "./NpcPortraitBackground.css";

const npcStats = [
  ["HP", "42"],
  ["AC", "3"],
  ["AP", "8"],
  ["SEQ", "6"],
  ["XP", "110"],
];

export function NpcPortraitBackground() {
  return (
    <main className="npc-preview-stage">
      <div className="npc-module-head">
        <span>FIELD INDEX / 07</span>
        <span>BESTIARY</span>
      </div>

      <article className="npc-preview-card">
        <img
          className="npc-photo"
          src="/__mockup/images/npc-portrait-background-raider.jpg"
          alt="Original raider portrait used as a subdued Bestiary card background"
        />
        <div className="npc-scrim" aria-hidden="true" />

        <div className="npc-content">
          <div className="npc-class-row">
            <span className="npc-class-pill">
              <Crosshair size={11} />
              HOSTILE · HUMAN
            </span>
            <span className="npc-threat">THREAT 06</span>
          </div>

          <div className="npc-title-block">
            <h1>Veteran Raider</h1>
            <p>Road-seasoned and quick to draw. Best approached from cover.</p>
          </div>

          <div className="npc-stat-grid" aria-label="NPC combat stats">
            {npcStats.map(([label, value]) => (
              <div className="npc-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="npc-equipment">
            <div className="npc-section-heading">
              <span>WEAPONS</span>
              <span>2 EQUIPPED</span>
            </div>
            <div className="npc-weapon-row">
              <span className="npc-weapon-name"><Crosshair size={13} /> .44 Magnum</span>
              <span>75% · 4 AP · 2d10</span>
            </div>
            <div className="npc-weapon-row">
              <span className="npc-weapon-name"><Crosshair size={13} /> Combat Knife</span>
              <span>75% · 3 AP · 1d10</span>
            </div>
          </div>

          <div className="npc-footer">
            <span className="npc-origin"><Sparkles size={12} /> CUSTOM PORTRAIT</span>
            <span className="npc-open-label">OPEN ENTRY <ChevronRight size={14} /></span>
          </div>
        </div>
      </article>

      <p className="npc-preview-note">
        <Shield size={12} />
        <span><strong>PORTRAIT AS BACKDROP</strong> · Dark scrim protects the stat and weapon text.</span>
      </p>
    </main>
  );
}
