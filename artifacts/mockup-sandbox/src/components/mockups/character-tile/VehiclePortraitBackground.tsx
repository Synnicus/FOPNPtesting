import { ChevronRight, Crosshair, Gauge, Shield, Users, Wrench } from "lucide-react";
import "./_group.css";
import "./VehiclePortraitBackground.css";

const vehicleStats = [
  ["HP", "180"],
  ["AC", "0"],
  ["AP", "6"],
  ["SEQ", "6"],
];

const vehicleResistances = [
  ["Normal", "85%"],
  ["Laser", "45%"],
  ["Fire", "95%"],
  ["Piercing", "45%"],
  ["Energy", "70%"],
];

export function VehiclePortraitBackground() {
  return (
    <main className="vehicle-preview-stage">
      <div className="vehicle-module-head">
        <span>ASSET INDEX / 03</span>
        <span>EQUIPMENT · VEHICLES</span>
      </div>

      <article className="vehicle-preview-card">
        <img
          className="vehicle-photo"
          src="/__mockup/images/vehicle-portrait-background-apc.jpg"
          alt="Original tracked armored carrier portrait used as an Equipment card background"
        />
        <div className="vehicle-scrim" aria-hidden="true" />

        <div className="vehicle-content">
          <div className="vehicle-topline">
            <span className="vehicle-type-pill"><Shield size={11} /> TRACKED · ARMORED</span>
            <span className="vehicle-edition">FIELD MODEL</span>
          </div>

          <div className="vehicle-title-block">
            <h1>M113 APC</h1>
            <p>Compact personnel carrier built to cross broken roads and worse.</p>
          </div>

          <div className="vehicle-stat-grid" aria-label="Vehicle stats">
            {vehicleStats.map(([label, value]) => (
              <div className="vehicle-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="vehicle-resistance">
            <div className="vehicle-section-heading">
              <span>RESISTANCE</span>
              <span>DR / DT PROFILE</span>
            </div>
            <div className="vehicle-resistance-grid">
              {vehicleResistances.map(([label, value]) => (
                <div className="vehicle-resistance-cell" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="vehicle-crew-row">
            <span className="vehicle-crew-label"><Users size={13} /> CREW</span>
            <span>2 seats <i>·</i> Pilot + gunner</span>
          </div>

          <div className="vehicle-weapons">
            <div className="vehicle-section-heading">
              <span>WEAPON SLOTS</span>
              <span>2 FITTED</span>
            </div>
            <div className="vehicle-weapon-row">
              <span><Crosshair size={13} /> M2HB ×2</span>
              <strong>75% · 5 AP</strong>
            </div>
            <div className="vehicle-weapon-row">
              <span><Crosshair size={13} /> TOW-II</span>
              <strong>65% · 6 AP</strong>
            </div>
          </div>

          <div className="vehicle-footer">
            <span className="vehicle-condition"><Wrench size={12} /> CONDITION 8/10</span>
            <span className="vehicle-open-label"><Gauge size={12} /> VIEW ASSET <ChevronRight size={14} /></span>
          </div>
        </div>
      </article>

      <p className="vehicle-preview-note">
        <Shield size={12} />
        <span><strong>PORTRAIT AS BACKDROP</strong> · Resistance, crew, and weapon slots stay distinct from the image.</span>
      </p>
    </main>
  );
}
