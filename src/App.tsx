import { useEffect, useRef, useState } from 'react';
import { BUILDINGS, KIND_LABEL, PALETTE, getBuilding } from './game/buildings';
import { isDrag } from './game/gesture';
import { availableKinds, canPlace, nearestTarget, paint, place, undo, unplaced } from './game/rules';
import { loadData, newProject, saveData, type Store } from './game/storage';
import type { Building, PieceKind, Project, SaveData, Settings } from './game/types';
import { Icon, Scene } from './Scene';

type View = 'home' | 'pick' | 'new' | 'settings' | 'bye' | 'game';

const store = (): Store | null => {
  try { return window.localStorage; } catch { return null; }
};

let ctx: AudioContext | undefined;
function beep(on: boolean, freq = 520, dur = 0.15, at = 0) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur);
  } catch { /* no audio available */ }
}

const status = (b: Building, p: Project) =>
  p.phase === 'done' ? '✓ Valmis' : p.phase === 'paint' ? 'Maalattavana' : `Kesken: ${p.placed.length} / ${b.targets.length}`;

// "Aseta" fits both tapping and dragging; naming the piece and the ＋ keeps it concrete.
const placeHint = (k: PieceKind) => `Aseta ${KIND_LABEL[k].toLowerCase()} kohtaan, jossa on ＋.`;
/** The piece in use: the only open kind, else the player's choice if it is still open. */
const pickKind = (kinds: PieceKind[], selKind: PieceKind | null) =>
  kinds.length === 1 ? kinds[0]! : selKind && kinds.includes(selKind) ? selKind : null;
const hintFor = (b: Building, p: Project, selKind: PieceKind | null) => {
  const k = pickKind(availableKinds(b, p), selKind);
  return k ? placeHint(k) : 'Valitse pala alta.';
};

export default function App() {
  const [data, setData] = useState<SaveData>(() => loadData(store()));
  const [view, setView] = useState<View>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [selKind, setSelKind] = useState<PieceKind | null>(null);
  const [selColor, setSelColor] = useState(1);
  // `n` changes on every message, so a repeated text is still spoken and announced again.
  const [msg, setMsg] = useState({ text: '', n: 0 });
  const say = (text: string) => setMsg((m) => ({ text, n: m.n + 1 }));
  const [armed, setArmed] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; kind: PieceKind } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: PieceKind; x: number; y: number; active: boolean } | null>(null);
  const wasDrag = useRef(false);

  const { sound } = data.settings;
  useEffect(() => saveData(store(), data), [data]);
  useEffect(() => {
    // Another open copy of the game saved: take its data so neither copy overwrites the other's progress.
    const reload = () => setData(loadData(store()));
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);
  useEffect(() => {
    if (!data.settings.speech || !msg.text || view !== 'game') return;
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(msg.text.replace('＋', 'plus')), { lang: 'fi-FI' }));
    } catch { /* no speech available */ }
  }, [msg, view, data.settings.speech]);
  useEffect(() => {
    document.documentElement.classList.toggle('big', data.settings.big);
  }, [data.settings]);

  const project = data.projects.find((p) => p.id === openId);
  const building = project && getBuilding(project.buildingId);
  // A finished building is reopened for repainting without losing its "done" state until changed.
  const shown = project && (project.phase === 'done' ? { ...project, phase: 'paint' as const } : project);
  const kinds = building && shown ? availableKinds(building, shown) : [];
  const sel = pickKind(kinds, selKind);

  const go = (v: View) => { setView(v); setArmed(null); };
  const update = (p: Project) => setData((d) => ({ ...d, projects: d.projects.map((x) => (x.id === p.id ? p : x)) }));
  const setSetting = (k: keyof Settings) => {
    if (k === 'sound' && !sound) beep(true);
    setData((d) => ({ ...d, settings: { ...d.settings, [k]: !d.settings[k] } }));
  };

  function open(id: string, fresh?: Project) {
    const p = fresh ?? data.projects.find((x) => x.id === id);
    const b = p && getBuilding(p.buildingId);
    if (!p || !b) return;
    setOpenId(id); setSelKind(null); setSelColor(1);
    say(p.phase === 'build' ? hintFor(b, p, null) : 'Valitse väri. Napauta sitten osaa.');
    go('game');
  }
  function create(buildingId: string) {
    const p = newProject(buildingId);
    setData((d) => ({ ...d, projects: [...d.projects, p] }));
    open(p.id, p);
  }
  function doPlace(id: string, kind: PieceKind) {
    if (!building || !project) return;
    if (!canPlace(building, project, id, kind)) { say('Tässä ei ole oikea paikka. Aseta pala kohtaan, jossa on ＋.'); return; }
    const next = place(building, project, id);
    update(next);
    setSelKind(null);
    if (next.phase === 'paint') {
      setSelColor(1);
      say('Rakennus on valmis! Hienoa! Maalaa halutessasi.');
      beep(sound, 523, 0.15, 0); beep(sound, 659, 0.15, 0.15); beep(sound, 784, 0.3, 0.3);
    } else {
      beep(sound);
      say('Hyvä! ' + hintFor(building, next, null));
    }
  }
  function drop(kind: PieceKind, cx: number, cy: number) {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m || !building || !project) return;
    const r = svg.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) { say('Pala palasi paikalleen.'); return; }
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(m.inverse());
    const t = nearestTarget(building, project, kind, p.x, p.y);
    if (t) doPlace(t.id, kind); else say('Kokeile uudelleen. ' + placeHint(kind));
  }
  function paintPiece(id: string) {
    if (!shown || !project) return;
    const c = PALETTE[selColor] ?? PALETTE[1]!;
    update({ ...paint(shown, id, c.value), phase: project.phase });
    beep(sound, 440, 0.1);
    say(`Maalattu: ${c.name}.`);
  }

  let body: JSX.Element;
  if (view === 'home') {
    body = (
      <>
        <h1 className="t">🪵 Hirsimestari</h1>
        <p className="ctr">Rakenna hirsirakennuksia.</p>
        <div className="col">
          <button className="main big1" onClick={() => go('pick')}>▶ Pelaa</button>
          <button className="big1" onClick={() => go('settings')}>⚙ Asetukset</button>
          <button className="big1" onClick={() => { go('bye'); try { window.close(); } catch { /* browsers may refuse */ } }}>✕ Poistu</button>
        </div>
      </>
    );
  } else if (view === 'pick') {
    body = (
      <>
        <div className="bar"><button onClick={() => go('home')}>← Takaisin</button><h1>Rakennukseni</h1></div>
        <div className="col"><button className="main big1" onClick={() => go('new')}>＋ Uusi rakennus</button></div>
        {data.projects.length === 0 && <p className="ctr">Ei vielä rakennuksia. Aloita uusi.</p>}
        <div className="menu">
          {data.projects.map((p) => {
            const b = getBuilding(p.buildingId);
            if (!b) return null;
            const st = status(b, p);
            return (
              <div className="card" key={p.id}>
                <button className="proj" onClick={() => open(p.id)} aria-label={`Avaa: ${b.name}, ${st}`}>
                  <Scene building={b} project={p} thumb /><b>{b.name}</b><span>{st}</span>
                </button>
                <button onClick={() => {
                  if (armed === p.id) { setData((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== p.id) })); setArmed(null); }
                  else setArmed(p.id);
                }}>{armed === p.id ? 'Varmista poisto' : 'Poista'}</button>
              </div>
            );
          })}
        </div>
      </>
    );
  } else if (view === 'new') {
    body = (
      <>
        <div className="bar"><button onClick={() => go('pick')}>← Takaisin</button><h1>Valitse rakennus</h1></div>
        <div className="menu">
          {BUILDINGS.map((b) => (
            <div className="card" key={b.id}>
              <button className="proj" onClick={() => create(b.id)} aria-label={`Rakenna: ${b.name}`}>
                <Scene building={b} project={{ id: '', buildingId: b.id, placed: b.targets.map((t) => t.id), colors: {}, phase: 'done' }} thumb />
                <b>{b.name}</b>
              </button>
            </div>
          ))}
        </div>
      </>
    );
  } else if (view === 'settings') {
    const tog = (k: keyof Settings, label: string) => (
      <button className="tog" aria-pressed={data.settings[k]} onClick={() => setSetting(k)}>
        <span>{label}</span><b>{data.settings[k] ? 'Päällä' : 'Pois'}</b>
      </button>
    );
    body = (
      <>
        <div className="bar"><button onClick={() => go('home')}>← Takaisin</button><h1>Asetukset</h1></div>
        <div className="col">
          {tog('sound', '🔊 Äänet')}{tog('speech', '🗣 Puhe')}{tog('big', '🔠 Suuri teksti')}
          <button className="tog" onClick={() => {
            if (armed === 'all') { setData((d) => ({ ...d, projects: [] })); setArmed(null); } else setArmed('all');
          }}><span>🗑 Poista kaikki rakennukset</span><b>{armed === 'all' ? 'Varmista' : 'Poista'}</b></button>
        </div>
      </>
    );
  } else if (view === 'bye') {
    body = (
      <>
        <h1 className="t">Kiitos pelaamisesta!</h1>
        <p className="ctr">Voit nyt sulkea sovelluksen.</p>
        <div className="col"><button className="main big1" onClick={() => go('home')}>Takaisin alkuun</button></div>
      </>
    );
  } else if (building && shown && project) {
    body = (
      <>
        <div className="bar">
          <button onClick={() => go('pick')}>← Takaisin</button><h1>{building.name}</h1>
          <span>Palat {shown.placed.length} / {building.targets.length}</span>
        </div>
        <div className="msg" role="status" aria-live="polite"><span key={msg.n}>{msg.text}</span></div>
        <div className="stage">
          <Scene
            building={building} project={shown} selKind={sel} svgRef={svgRef}
            onSlot={(id) => (sel ? doPlace(id, sel) : say('Valitse ensin pala alta.'))}
            onPaint={paintPiece}
          />
        </div>
        {shown.phase === 'build' ? (
          <div className="tray" role="group" aria-label="Palat">
            {kinds.map((k) => (
              <button
                key={k} className="piece" aria-pressed={sel === k} style={{ touchAction: 'none' }}
                aria-label={`${KIND_LABEL[k]}, ${unplaced(building, shown, k)} jäljellä`}
                onPointerDown={(e) => {
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
                  drag.current = { kind: k, x: e.clientX, y: e.clientY, active: false };
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d) return;
                  if (d.active || isDrag(e.clientX - d.x, e.clientY - d.y)) { d.active = true; setSelKind(k); setGhost({ x: e.clientX, y: e.clientY, kind: k }); }
                }}
                onPointerUp={(e) => {
                  const d = drag.current;
                  drag.current = null; setGhost(null);
                  if (d?.active) { wasDrag.current = true; setTimeout(() => { wasDrag.current = false; }, 50); drop(k, e.clientX, e.clientY); }
                }}
                onPointerCancel={() => { drag.current = null; setGhost(null); }}
                // Browser can drop capture without pointerup/cancel (gesture takeover); never leave the ghost hanging.
                onLostPointerCapture={() => { drag.current = null; setGhost(null); }}
                onClick={() => {
                  if (wasDrag.current) return; // the click that follows a drag is not a tap
                  setSelKind(k); say(placeHint(k));
                }}
              >
                <Icon kind={k} lean={building.targets.some((t) => t.kind === k && t.lean)} /><span>{KIND_LABEL[k]} × {unplaced(building, shown, k)}</span>
              </button>
            ))}
            <button disabled={shown.placed.length === 0} onClick={() => { update(undo(project)); setSelKind(null); say('Peruttu.'); }}>↶ Peru</button>
          </div>
        ) : (
          <div className="palette" role="group" aria-label="Värit">
            {PALETTE.map((c, i) => (
              <button key={c.name} className="sw" aria-pressed={selColor === i} onClick={() => { setSelColor(i); say('Napauta osaa kuvassa.'); }}>
                <i style={{ background: c.value ?? 'linear-gradient(135deg, #c98a4b 50%, #bfe3f5 50%)' }} />{selColor === i ? '✓ ' : ''}{c.name}
              </button>
            ))}
            <button className="main" onClick={() => { update({ ...project, phase: 'done' }); go('pick'); }}>✓ Valmis</button>
          </div>
        )}
      </>
    );
  } else {
    body = <div className="col"><button className="main big1" onClick={() => go('home')}>Takaisin alkuun</button></div>;
  }

  return (
    <main>
      <div id="app">{body}</div>
      {ghost && <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>{KIND_LABEL[ghost.kind]}</div>}
    </main>
  );
}
