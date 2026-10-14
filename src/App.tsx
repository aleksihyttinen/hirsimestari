import { useEffect, useLayoutEffect, useRef, useState, type DOMAttributes, type ReactNode } from 'react';
import { BUILDINGS, CARVE_STEPS, FIX, FIX_TOOLS, ITEM_LABEL, KIND_INFO, KIND_LABEL, MATERIALS, PALETTE, ROOM_LABEL, SHUTOFF, TOOLS, getBuilding, type FixTool, type Material, type Tool } from './game/buildings';
import { isDrag } from './game/gesture';
import { fitNear, left, missing, recognized, turnNear, whyNotFit } from './game/plan';
import { canPlace, choices, hintFor, isPlaced, nearestTarget, needsCarve, openTargets, paint, pickKind, place, placeHint, trayKinds, undo, unplaced, whyNot } from './game/rules';
import { loadData, newProject, saveData, type Store } from './game/storage';
import type { Building, Furniture, Item, PieceKind, Project, SaveData, Settings } from './game/types';
import { CarveLog, FixPiece, Icon, ItemIcon, PartIcon, Scene, ToolIcon, planCell } from './Scene';

type View = 'home' | 'modes' | 'pick' | 'new' | 'settings' | 'game' | 'carve' | 'fix' | 'help';

const store = (): Store | null => {
  try { return window.localStorage; } catch { return null; }
};

let ctx: AudioContext | undefined;
function beep(on: boolean, freq = 520, dur = 0.15, at = 0) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    // iOS pauses the context after a call or app switch and never restarts it by itself.
    if (ctx.state !== 'running') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + at);
    o.stop(ctx.currentTime + at + dur);
  } catch { /* no audio available */ }
}

// Ohje (the ? button). The menu screens and the two game modes each get their own instructions.
const MENU_HELP: [string, string][] = [
  ['Pelaa', 'Valitse peli: Rakenna, Hirsityöt, Sisätyöt tai Sisusta.'],
  ['Rakenna', 'Rakenna talo palasista. Maalaa se sitten.'],
  ['Hirsityöt', 'Rakenna hirsirunko. Mieti itse, missä järjestyksessä hirret tulevat.'],
  ['Sisätyöt', 'Laita huoneeseen sähköt ja vesi. Valitse oikea kiinnike ja työkalu.'],
  ['Sisusta', 'Sisusta rakennus niin kuin haluat. Huoneesta tulee valmis, kun oikeat huonekalut ovat siellä.'],
  ['Tallennus', 'Kaikki tallentuu itsestään. Voit jatkaa myöhemmin.'],
  ['Asetukset', 'Laita päälle äänet, puhe tai suuri teksti.'],
];
const BUILD_HELP: [string, string][] = [
  ['Valitse pala', 'Napauta palaa kuvan alla.'],
  ['Aseta pala', 'Napauta kohtaa, jossa on ＋. Voit myös vetää palan kuvaan.'],
  ['Peru', 'Peru poistaa viimeksi asetetun palan.'],
  ['Maalaa', 'Kun rakennus on valmis, valitse väri. Napauta sitten osaa.'],
  ['Valmis', 'Paina Valmis, kun olet tyytyväinen. Voit maalata myöhemmin uudelleen.'],
];
// Sisusta: how to furnish. The open building's own rooms (`plan.recipes`) go after the first two lines.
const POHJA_HELP: [string, string][] = [
  ['Sisusta', 'Vedä huonekalu alta kuvaan. Voit myös valita sen ja napauttaa kohtaa kuvassa.'],
  ['Siirrä ja käännä', 'Vedä huonekalu uuteen paikkaan. Tai napauta sitä ja paina Käännä tai Poista. Valmis lopettaa muokkauksen.'],
  ['Muut', 'Muut huonekalut sopivat mihin tahansa huoneeseen.'],
  ['Peru', 'Peru kumoaa viimeisimmän muutoksen.'],
  ['Valmis', 'Kun olet tyytyväinen, paina esimerkiksi Mökki valmis. Voit jatkaa myöhemmin.'],
];
const FIT_HINT = {
  wall: 'Tähän se ei mahdu. Kokeile toista kohtaa.',
  door: 'Oven eteen ei voi laittaa mitään. Kokeile toista kohtaa.',
  taken: 'Siinä on jo jotain. Kokeile toista kohtaa.',
};
const fanfare = (on: boolean) => { beep(on, 523, 0.15, 0); beep(on, 659, 0.15, 0.15); beep(on, 784, 0.3, 0.3); };

// Rakennusohje (Hirsityöt). Real log-building terms, one short sentence each.
const GUIDE: [string, string][] = [
  ['Kivijalka', 'Kiviperustus. Runko rakennetaan sen päälle. Aitta seisoo usein nurkkakivien päällä.'],
  ['Kengityshirret', 'Alimmat hirret kivijalan päällä. Ne kantavat koko seinän painon.'],
  ['Niskahirret', 'Lattianiskat tulevat kengityshirsien varaan. Niiden päälle tehdään lattia.'],
  ['Seinähirret', 'Ladotaan kerta kerralta alhaalta ylös. Nurkissa hirret lukitaan salvoksilla.'],
  ['Sidehirsi', 'Sitoo vastakkaiset seinät yhteen, etteivät ne pullistu ulospäin.'],
  ['Päätykolmio', 'Päätyhirret lyhenevät ylöspäin ja tekevät kolmion katon alle.'],
  ['Vuoliaiset', 'Kulkevat päätykolmiolta toiselle ja kantavat kattoa.'],
  ['Kurkihirsi', 'Ylin hirsi katon harjalla. Se tulee viimeisenä.'],
];
// Tool names are bold so the player can find which tool each step needs.
const VEISTO: [string, ReactNode][] = [
  ['Kuorinta', <>Kuori poistetaan <b>kuorimaraudalla</b>, ettei hirsi lahoa.</>],
  ['Veisto', <>Hirren sivut veistetään suoriksi <b>piilukirveellä</b>.</>],
  ['Vara', <>Alapintaan veistetään <b>kourutaltalla</b> kouru. Hirsi istuu tiiviisti alemman päälle, ja väliin tulee tilkettä.</>],
  ['Salvos', <>Hirren päihin tehdään <b>sahalla</b> nurkkaliitos, joka lukitsee seinät toisiinsa.</>],
];

// Sisätyöohje. Material and tool names are bold so the player can look them up; some items in the trays are never needed.
const SISA: [string, ReactNode][] = [
  ['Ensin turvallisuus', 'Katkaise virta sähkökeskuksesta ja sulje vesi pääventtiilistä ennen töitä.'],
  ['Kaapeli', <>Kiinnitetään seinään <b>kaapelikiinnikkeillä</b>. Ne lyödään <b>vasaralla</b>.</>],
  ['Katkaisija, pistorasia, valaisin, palovaroitin, ohjauskeskus ja poistoventtiili', <>Pieniä ja kevyitä, siksi ne kiinnitetään <b>ruuveilla</b>. Ne ruuvataan <b>akkuruuvinvääntimellä</b>.</>],
  ['Vesiputki', <>Kiinnitetään <b>putkenkannakkeilla</b>. Ne ruuvataan <b>akkuruuvinvääntimellä</b>.</>],
  ['Lämminvesivaraaja ja pesuallas', <>Painavia, siksi ne kiinnitetään <b>pulteilla</b>. Mutterit kiristetään <b>jakoavaimella</b>.</>],
  ['Tiskiallas ja kiuas', <>Isoja ja seisovat lattialla, siksi ne kiinnitetään <b>pitkillä ruuveilla</b>. Ne ruuvataan <b>akkuruuvinvääntimellä</b>.</>],
  ['WC-istuin', <>Liimataan lattiaan <b>liimalla</b>, ettei lattian vesieristykseen tule reikiä. Liima puristetaan <b>saumapistoolilla</b>.</>],
  ['Hana ja suihku', <>Liitetään putkeen <b>puristusliittimellä</b>. Se kiristetään <b>jakoavaimella</b>.</>],
  ['Lauteet', <>Naulataan <b>nauloilla</b> ja <b>vasaralla</b>.</>],
  ['Lopuksi', 'Kun kaikki on kiinni, avaa vesi ja kytke virta takaisin.'],
  ['Kokeile', 'Kun huone on valmis, kokeile valoa, vettä ja kiuasta.'],
  ['Oikeassa talossa', 'Sähkötyöt ja kiukaan kytkennän tekee aina sähköasentaja.'],
];
const FIX_STEPS = ['Kiinnike', 'Työkalu', 'Kiinnitys'];
const toolHint = (m: Material) => `Valitse sopiva työkalu ${MATERIALS.find((x) => x.id === m)!.to}.`;
const FIX_NAME = Object.fromEntries([...MATERIALS, ...FIX_TOOLS].map((x) => [x.id, x.name])) as Record<Material | FixTool, string>;
// A finished room: what to tap (partitive), and what it says when turned on and off.
const TRY: Partial<Record<PieceKind, [string, string, string]>> = {
  switch: ['valokatkaisijaa', 'Valo syttyi!', 'Valo sammui.'],
  tap: ['hanaa', 'Vettä tulee!', 'Hana on kiinni.'],
  shower: ['suihkua', 'Suihkusta tulee vettä!', 'Suihku on kiinni.'],
  control: ['ohjauskeskusta', 'Kiuas lämpenee ja valo syttyi!', 'Kiuas ja valo sammuivat.'],
};
/** The next thing in the room to try, or praise when everything is on. */
const tryHint = (b: Building, lit: PieceKind[]) => {
  const k = b.targets.map((t) => t.kind).find((x) => TRY[x] && !lit.includes(x));
  return k ? `Napauta ${TRY[k]![0]}.` : 'Kaikki toimii. Hienoa!';
};

const status = (b: Building, p: Project) =>
  p.phase === 'done' ? '✓ Valmis' : p.phase === 'paint' ? 'Maalattavana'
    : b.plan ? `Kesken: ${b.plan.goal.length - missing(b.plan, p.furniture ?? []).length} / ${b.plan.goal.length} huonetta` : `Kesken: ${p.placed.length} / ${b.targets.length}`;

export default function App() {
  const [data, setData] = useState<SaveData>(() => loadData(store()));
  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<Building['mode']>();
  const runko = mode === 'runko';
  const [helpBack, setHelpBack] = useState<View>('home');
  // Frame waiting for the hewing question, and the log being hewn (not saved: a few taps to redo).
  const [asking, setAsking] = useState<string | null>(null);
  const [carving, setCarving] = useState<{ id: string; kind: PieceKind; step: number; done: number[]; tool: Tool | null } | null>(null);
  // Sisätyöt: the piece being fastened (step 0 material, 1 tool, 2 tapping), and what is switched on in a finished room. Neither is saved.
  const [fixing, setFixing] = useState<{ id: string; kind: PieceKind; step: number; done: number[]; materials: Material[]; tools: FixTool[] } | null>(null);
  const [lit, setLit] = useState<PieceKind[]>([]);
  // Sisusta: the tray piece or placed piece chosen, and earlier furniture for Peru (not saved).
  const [selItem, setSelItem] = useState<Item | null>(null);
  const [selPiece, setSelPiece] = useState<string | null>(null);
  const [history, setHistory] = useState<Furniture[][]>([]);
  // A piece being dragged (from the tray, or `id` when already placed) and where it would land.
  const planDrag = useRef<{ item: Item; id?: string; x: number; y: number; active: boolean } | null>(null);
  const [preview, setPreview] = useState<Furniture | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selKind, setSelKind] = useState<PieceKind | null>(null);
  const [selColor, setSelColor] = useState(1);
  // `n` changes on every message, so a repeated text is still spoken and announced again.
  const [msg, setMsg] = useState({ text: '', n: 0 });
  const say = (text: string) => setMsg((m) => ({ text, n: m.n + 1 }));
  const [armed, setArmed] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: PieceKind; x: number; y: number; active: boolean } | null>(null);
  const wasDrag = useRef(false);
  const trayRef = useRef<HTMLDivElement>(null);
  const [trayScrolls, setTrayScrolls] = useState(false);

  const { sound } = data.settings;
  useEffect(() => saveData(store(), data), [data]);
  useEffect(() => {
    // Another open copy of the game saved: take its data so neither copy overwrites the other's progress.
    const reload = () => setData(loadData(store()));
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);
  useEffect(() => {
    if (!data.settings.speech || !msg.text || (view !== 'game' && view !== 'carve' && view !== 'fix')) return;
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(msg.text.replace('＋', 'plus')), { lang: 'fi-FI' }));
    } catch { /* no speech available */ }
  }, [msg, view, data.settings.speech]);
  // Only a tray that overflows lets a sideways swipe scroll it; when every piece fits, a piece can be dragged any way.
  useLayoutEffect(() => {
    const check = () => setTrayScrolls(!!trayRef.current && trayRef.current.scrollWidth > trayRef.current.clientWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });
  useEffect(() => {
    document.documentElement.classList.toggle('big', data.settings.big);
  }, [data.settings]);

  const project = data.projects.find((p) => p.id === openId);
  const building = project && getBuilding(project.buildingId);
  // A finished house is reopened for repainting without losing its "done" state until changed. Frames and rooms are not painted.
  const shown = project && (project.phase === 'done' && !building?.mode ? { ...project, phase: 'paint' as const } : project);
  const kinds = building && shown ? trayKinds(building, shown) : [];
  const sel = pickKind(kinds, selKind);

  const go = (v: View) => { setView(v); setArmed(null); };
  const help = <button aria-label="Ohje" onClick={() => { setHelpBack(view); go('help'); }}>?</button>;
  const update = (p: Project) => setData((d) => ({ ...d, projects: d.projects.map((x) => (x.id === p.id ? p : x)) }));
  const setSetting = (k: keyof Settings) => {
    if (k === 'sound' && !sound) beep(true);
    setData((d) => ({ ...d, settings: { ...d.settings, [k]: !d.settings[k] } }));
  };

  function open(id: string, fresh?: Project) {
    const p = fresh ?? data.projects.find((x) => x.id === id);
    const b = p && getBuilding(p.buildingId);
    if (!p || !b) return;
    setOpenId(id); setSelKind(null); setSelColor(1); setLit([]); setSelItem(null); setSelPiece(null); setHistory([]);
    say(b.plan ? `Sisusta ${b.name.toLowerCase()}. Vedä huonekalu alta kuvaan.` : p.phase === 'build' ? hintFor(b, p, null) : b.mode === 'runko' ? 'Runko on valmis.' : b.mode === 'sisa' ? tryHint(b, []) : 'Valitse väri. Napauta sitten osaa.');
    go('game');
  }
  function create(buildingId: string, carve = false) {
    const p = { ...newProject(buildingId), ...(carve && { carve }) };
    setData((d) => ({ ...d, projects: [...d.projects, p] }));
    open(p.id, p);
  }
  function doPlace(id: string, kind: PieceKind, project = shown, fixed = false) {
    if (!building || !project) return;
    if (!canPlace(building, project, id, kind)) {
      const t = building.targets.find((x) => x.id === id);
      // Lowest wall log still missing: a wall log tried higher up gets told to start from the bottom.
      const low = building.targets.find((x) => x.kind === 'wall' && !isPlaced(project, x.id));
      if (building.mode !== 'runko' || !t) say('Tässä ei ole oikea paikka. Aseta pala kohtaan, jossa on ＋.');
      else if (t.kind !== kind) say(`Tähän ei tule ${KIND_LABEL[kind].toLowerCase()}. ${KIND_INFO[kind] ?? ''}`);
      else if (t.kind === 'wall' && low && low.id !== t.id) say(`Seinä rakennetaan alhaalta ylös, yksi hirsi kerrallaan. ${building.targets.some((x) => x.kind === 'wall' && isPlaced(project, x.id)) ? 'Aseta seuraavaksi' : 'Aloita alimmasta'}: ${low.name}.`);
      else say(`Ensin tarvitaan: ${whyNot(building, project, id).join(', ')}.`);
      return;
    }
    const f = building.mode === 'sisa' && !fixed && FIX[kind];
    if (f) {
      // Shuffled once per piece, so the buttons stay put while the player looks.
      setFixing({ id, kind, step: 0, done: [], materials: choices(f.material, MATERIALS.map((m) => m.id)), tools: choices(f.tool, FIX_TOOLS.map((t) => t.id)) });
      say('Valitse kiinnike.');
      go('fix');
      return;
    }
    if (needsCarve(building, project, id)) {
      setCarving({ id, kind, step: 0, done: [], tool: null });
      say(`${CARVE_STEPS[0]!.name}: valitse työkalu.`);
      go('carve');
      return;
    }
    const next = place(building, project, id);
    update(next);
    // The chosen piece stays chosen (pickKind drops it once none is left), so repeats like wall logs need no re-tap.
    if (next.phase !== 'build') {
      setSelColor(1);
      say(building.mode === 'runko' ? 'Runko on valmis! Hienoa!' : building.mode === 'sisa' ? `${building.name} on valmis! Hienoa! ${tryHint(building, [])}` : 'Rakennus on valmis! Hienoa! Maalaa halutessasi.');
      fanfare(sound);
    } else {
      beep(sound);
      say('Hyvä! ' + (building.mode === 'runko' ? `${KIND_INFO[kind] ?? ''} ` : '') + hintFor(building, next, kind));
    }
  }
  // A swipe hews several parts between renders, so parts are added with an updater and steps advance in an effect.
  function carvePart(i: number) {
    const s = carving && CARVE_STEPS[carving.step]!;
    if (!carving?.tool || !s) { say('Valitse ensin työkalu.'); return; }
    // The wrong tool does not cut: a neutral hint, nothing is lost.
    if (carving.tool !== s.tool) { say(`${TOOLS.find((t) => t.id === carving.tool)!.name} ei sovi ${s.wrong}. Valitse toinen työkalu.`); return; }
    beep(sound, 440, 0.08);
    setCarving((c) => (c && !c.done.includes(i) && CARVE_STEPS[c.step]!.parts.includes(i) ? { ...c, done: [...c.done, i] } : c));
  }
  useEffect(() => {
    const s = carving && CARVE_STEPS[carving.step]!;
    if (!carving || !s || carving.done.length < s.parts.length || !project) return;
    const nextStep = CARVE_STEPS[carving.step + 1];
    if (nextStep) { setCarving({ ...carving, step: carving.step + 1, done: [], tool: null }); say(`${s.name} valmis! ${nextStep.name}: valitse työkalu.`); return; }
    setCarving(null);
    go('game');
    doPlace(carving.id, carving.kind, { ...project, carved: [...(project.carved ?? []), carving.id] });
  }, [carving]);
  // A wrong material or tool is not used: a neutral hint, nothing is lost.
  function pickFix(id: Material | FixTool) {
    const f = fixing && FIX[fixing.kind];
    if (!fixing || !f) return;
    if (id !== (fixing.step ? f.tool : f.material)) {
      // On the tool step, name the chosen fastener again: some players forget it.
      say(`${FIX_NAME[id]} ei sovi ${f.wrong}. ${fixing.step ? toolHint(f.material) : MATERIALS.find((m) => m.id === f.material)!.why}`);
      return;
    }
    beep(sound, 440, 0.08);
    setFixing({ ...fixing, step: fixing.step + 1 });
    say(fixing.step ? 'Napauta kiinnityskohtia.' : `Hyvä! ${toolHint(f.material)}`);
  }
  function fixSpot(i: number) {
    const f = fixing && FIX[fixing.kind];
    if (!fixing || !f || fixing.done.includes(i)) return;
    beep(sound, 440, 0.08);
    const done = [...fixing.done, i];
    if (done.length < f.spots.length) { setFixing({ ...fixing, done }); return; }
    setFixing(null);
    go('game');
    doPlace(fixing.id, fixing.kind, shown, true);
  }
  function tryPiece(id: string) {
    const k = building?.targets.find((t) => t.id === id)?.kind;
    // A finished room's shut-offs are already back on: point to what can be tried instead.
    if (building && k && SHUTOFF[k]) { say(`${k === 'breaker' ? 'Virta on jo päällä.' : 'Vesi on jo auki.'} ${tryHint(building, lit)}`); return; }
    const say3 = k && TRY[k];
    if (!building || !k || !say3) return;
    const next = lit.includes(k) ? lit.filter((x) => x !== k) : [...lit, k];
    setLit(next);
    beep(sound, next.includes(k) ? 660 : 440, 0.1);
    say(next.includes(k) ? `${say3[1]} ${tryHint(building, next)}` : say3[2]);
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
    // Hirsityöt snaps to any empty slot so a too-early drop gets the "Ensin tarvitaan" hint.
    const t = nearestTarget(building, project, kind, p.x, p.y, 80, openTargets(building, project));
    if (t) doPlace(t.id, kind); else say('Kokeile uudelleen. ' + placeHint(kind));
  }
  // Sisusta. Every change is kept for Peru; a room that becomes complete is praised, nothing is ever called wrong.
  const furn = project?.furniture ?? [];
  function furnish(next: Furniture[], text: string) {
    const plan = building?.plan;
    if (!plan || !project) return;
    const before = recognized(plan, furn);
    const after = recognized(plan, next);
    setHistory((h) => [...h, furn]);
    update({ ...project, furniture: next });
    const fresh = Object.entries(after).flatMap(([id, ks]) => ks.filter((k) => !before[id]?.includes(k)))[0];
    const lack = missing(plan, next);
    const n = plan.goal.length - lack.length;
    if (!lack.length && missing(plan, furn).length) {
      say(`Kaikki huoneet ovat valmiina! Hienoa! Paina ${building.name} valmis, tai jatka sisustamista.`);
      fanfare(sound);
    } else if (fresh) {
      say(`Hienoa! Tästä tuli ${ROOM_LABEL[fresh].toLowerCase()}. Huoneita valmiina ${n} / ${plan.goal.length}.`);
      beep(sound, 660, 0.25);
    } else {
      // Every piece is out but a room is still missing: a tip for the first one, never a fault.
      const all = (Object.keys(plan.pieces) as Item[]).every((i) => left(plan, next, i) <= 0);
      const tip = plan.recipes.find((r) => r.room === lack[0])?.text;
      say(tip && all ? `${text} Vinkki: ${tip[0]!.toLowerCase()}${tip.slice(1)}` : text);
      beep(sound);
    }
  }
  // A new piece of `item`, or the placed piece `moving`, put where it covers cell x,y (a tap or a drop).
  function placeAt(x: number, y: number, moving?: Furniture, item?: Item | null) {
    const plan = building?.plan;
    const f = moving ?? (item && { id: `f${Date.now()}`, item, x, y, turn: 0 });
    if (!plan || !f) return;
    const fit = fitNear(plan, furn, f, x, y);
    if (!fit) { say(FIT_HINT[whyNotFit(plan, furn, { ...f, x, y }) ?? 'taken']); return; }
    if (moving) { setSelPiece(null); furnish(furn.map((o) => (o.id === f.id ? fit : o)), 'Siirretty.'); return; }
    // The chosen piece stays chosen while some are left (two chairs, two bedside tables).
    const more = left(plan, furn, f.item) > 1;
    if (!more && selItem === f.item) setSelItem(null);
    const next = [...furn, fit];
    // The last piece: say so instead of asking for the next one (furnish adds a tip if a room is still missing).
    const last = (Object.keys(plan.pieces) as Item[]).every((i) => left(plan, next, i) <= 0);
    furnish(next, last ? 'Kaikki huonekalut ovat paikallaan.'
      : more ? 'Hyvä! Lisää vielä toinen.' : 'Hyvä! Valitse seuraava huonekalu alta.');
  }
  const tapCell = (x: number, y: number) => placeAt(x, y, furn.find((f) => f.id === selPiece), selItem);
  // Dragging works like the other modes: past the tap threshold a ghost follows the finger, and the plan shows where it lands.
  const dragPlan = (item: Item, id?: string): DOMAttributes<Element> => {
    const end = () => { planDrag.current = null; setGhost(null); setPreview(null); };
    const cell = (e: { clientX: number; clientY: number }) => {
      const plan = building?.plan;
      return plan && svgRef.current ? planCell(svgRef.current, plan.cols, plan.rows, e.clientX, e.clientY) : null;
    };
    return {
      onPointerDown: (e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
        planDrag.current = { item, id, x: e.clientX, y: e.clientY, active: false };
      },
      onPointerMove: (e) => {
        const d = planDrag.current;
        const plan = building?.plan;
        if (!d || !plan || !(d.active || isDrag(e.clientX - d.x, e.clientY - d.y))) return;
        d.active = true;
        setGhost({ x: e.clientX, y: e.clientY, label: ITEM_LABEL[item] });
        const c = cell(e);
        const f = furn.find((x) => x.id === id) ?? { id: '', item, x: 0, y: 0, turn: 0 };
        setPreview(c && fitNear(plan, furn, f, c[0], c[1]));
      },
      onPointerUp: (e) => {
        const d = planDrag.current;
        end();
        if (!d?.active) return;
        wasDrag.current = true; setTimeout(() => { wasDrag.current = false; }, 50);
        const c = cell(e);
        if (!c) { say(id ? 'Huonekalu jäi paikalleen.' : 'Huonekalu palasi alas.'); return; }
        placeAt(c[0], c[1], furn.find((x) => x.id === id), item);
      },
      onPointerCancel: end,
      // Browser can drop capture without pointerup/cancel (gesture takeover); never leave the ghost hanging.
      onLostPointerCapture: end,
    };
  };
  function tapPiece(id: string) {
    if (wasDrag.current) return; // the click that follows a drag is not a tap
    const f = furn.find((x) => x.id === id);
    if (!f || selPiece === id) { setSelPiece(null); say('Valitse huonekalu alta, tai napauta huonekalua kuvassa.'); return; }
    setSelPiece(id); setSelItem(null);
    say(`${ITEM_LABEL[f.item]} valittu. Napauta uutta paikkaa, tai käännä tai poista se.`);
  }
  function turnPiece() {
    const plan = building?.plan;
    const f = furn.find((x) => x.id === selPiece);
    if (!plan || !f) return;
    const t = turnNear(plan, furn, f);
    if (t) furnish(furn.map((o) => (o.id === f.id ? t : o)), 'Käännetty.');
    else say('Tässä ei ole tilaa kääntää. Siirrä se ensin toiseen kohtaan.');
  }

  function paintPiece(id: string) {
    if (!shown || !project) return;
    const c = PALETTE[selColor] ?? PALETTE[1]!;
    update({ ...paint(shown, id, c.value), phase: project.phase });
    beep(sound, 440, 0.1);
    say(`Maalattu: ${c.name}.`);
  }

  // Progress: in the bar, or above the hint in wide landscape (the bar copy is hidden there, see .cnt).
  const side = (count: string) => (
    <div className="side">
      <p className="count">{count}</p>
      <div className="msg" role="status" aria-live="polite"><span key={msg.n}>{msg.text}</span></div>
      {trayScrolls && <p className="more">↔ Pyyhkäise riviä sivulle, niin näet lisää.</p>}
    </div>
  );
  let body: JSX.Element;
  const mine = data.projects.filter((p) => getBuilding(p.buildingId)?.mode === mode);
  // Pick and new screen texts: title, new button, empty list, choose title.
  const T = runko ? ['Hirsityöt', 'Uusi runko', 'Ei vielä runkoja.', 'Valitse runko']
    : mode === 'sisa' ? ['Sisätyöt', 'Uusi huone', 'Ei vielä huoneita.', 'Valitse huone']
    : mode === 'pohja' ? ['Sisusta', 'Uusi rakennus', 'Ei vielä rakennuksia.', 'Valitse rakennus']
    : ['Rakennukseni', 'Uusi rakennus', 'Ei vielä rakennuksia.', 'Valitse rakennus'];
  if (view === 'home') {
    body = (
      <>
        <h1 className="t">🪵 Hirsimestari</h1>
        <p className="ctr">Rakenna hirsirakennuksia.</p>
        <div className="col">
          <button className="main big1" onClick={() => go('modes')}>▶ Pelaa</button>
          <button className="big1" onClick={() => go('settings')}>⚙ Asetukset</button>
          <button className="big1" onClick={() => { setHelpBack('home'); go('help'); }}>? Ohje</button>
        </div>
      </>
    );
  } else if (view === 'modes') {
    body = (
      <>
        <div className="bar"><button onClick={() => go('home')}>← Takaisin</button><h1>Valitse peli</h1>{help}</div>
        <div className="col">
          <button className="main big1" onClick={() => { setMode(undefined); go('pick'); }}>🏠 Rakenna</button>
          <button className="main big1" onClick={() => { setMode('runko'); go('pick'); }}>🪓 Hirsityöt</button>
          <button className="main big1" onClick={() => { setMode('sisa'); go('pick'); }}>🔧 Sisätyöt</button>
          <button className="main big1" onClick={() => { setMode('pohja'); go('pick'); }}>🛋️ Sisusta</button>
        </div>
      </>
    );
  } else if (view === 'pick') {
    body = (
      <>
        <div className="bar"><button onClick={() => go('modes')}>← Takaisin</button><h1>{T[0]}</h1>{help}</div>
        <div className="col"><button className="main big1" onClick={() => go('new')}>＋ {T[1]}</button></div>
        {!mine.length && <p className="ctr">{T[2]} Aloita uusi.</p>}
        <div className="menu">
          {mine.map((p) => {
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
  } else if (view === 'new' && asking) {
    body = (
      <>
        <div className="bar"><button onClick={() => setAsking(null)}>← Takaisin</button><h1>{getBuilding(asking)?.name}</h1>{help}</div>
        <p className="ctr">Veistätkö erikoishirret itse? Kengityshirret, sidehirsi ja kurkihirsi veistetään ennen asettamista.</p>
        <div className="col">
          <button className="main big1" onClick={() => { setAsking(null); create(asking, true); }}>🪓 Kyllä, veistän</button>
          <button className="big1" onClick={() => { setAsking(null); create(asking); }}>Ei, rakennan suoraan</button>
        </div>
      </>
    );
  } else if (view === 'new') {
    body = (
      <>
        <div className="bar"><button onClick={() => go('pick')}>← Takaisin</button><h1>{T[3]}</h1>{help}</div>
        <div className="menu">
          {BUILDINGS.filter((b) => b.mode === mode).map((b) => (
            <div className="card" key={b.id}>
              <button className="proj" onClick={() => (b.mode === 'runko' ? setAsking(b.id) : create(b.id))} aria-label={`Rakenna: ${b.name}`}>
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
        <div className="bar"><button onClick={() => go('home')}>← Takaisin</button><h1>Asetukset</h1>{help}</div>
        <div className="col">
          {tog('sound', '🔊 Äänet')}{tog('speech', '🗣 Puhe')}{tog('big', '🔠 Suuri teksti')}
          <button className="tog" onClick={() => {
            if (armed === 'all') { setData((d) => ({ ...d, projects: [], keep: [] })); setArmed(null); } else setArmed('all');
          }}><span>🗑 Poista kaikki rakennukset</span><b>{armed === 'all' ? 'Varmista' : 'Poista'}</b></button>
        </div>
      </>
    );
  } else if (view === 'help') {
    const list = (items: [string, ReactNode][]) => (
      <ol className="help">{items.map(([t, d]) => <li key={t}><b>{t}</b> – {d}</li>)}</ol>
    );
    // Menu screens get the game overview; the rest follow the chosen mode (a game's building always matches `mode`).
    const topic = helpBack === 'home' || helpBack === 'modes' || helpBack === 'settings' ? 'menu' : mode ?? 'build';
    body = (
      <>
        <div className="bar"><button onClick={() => go(helpBack)}>← Takaisin</button><h1>{topic === 'runko' ? 'Rakennusohje' : topic === 'sisa' ? 'Sisätyöohje' : 'Ohje'}</h1></div>
        {topic === 'menu' && list(MENU_HELP)}
        {topic === 'build' && list(BUILD_HELP)}
        {topic === 'pohja' && list([...POHJA_HELP.slice(0, 2), ...(helpBack === 'game' && building?.plan?.recipes.map((r): [string, string] => [ROOM_LABEL[r.room], r.text]) || []), ...POHJA_HELP.slice(2)])}
        {topic === 'sisa' && (
          <>
            {list(BUILD_HELP.slice(0, 3))}
            <h2>Näin kiinnität</h2>
            <p>Valitse ensin kiinnike, sitten työkalu. Kaikkia tarvikkeita ei tarvita.</p>
            {list(SISA)}
          </>
        )}
        {topic === 'runko' && (
          <>
            <p>Kuva näyttää rakennuksen päädystä. Pyöreä pala on hirren pää: se hirsi kulkee rakennuksen pituussuunnassa.</p>
            <h2>Näin runko rakennetaan</h2>
            {list(GUIDE)}
            <h2>Hirren veisto</h2>
            {list(VEISTO)}
          </>
        )}
        <div className="col"><button className="main big1" onClick={() => go(helpBack)}>Selvä, jatketaan</button></div>
      </>
    );
  } else if (view === 'carve' && carving && building) {
    const s = CARVE_STEPS[carving.step]!;
    const name = building.targets.find((t) => t.id === carving.id)?.name ?? '';
    const count = `Vaihe ${carving.step + 1} / ${CARVE_STEPS.length}: ${s.name}`;
    body = (
      <>
        <div className="bar">
          <button onClick={() => { setCarving(null); go('game'); say('Veisto keskeytyi. Voit aloittaa uudelleen.'); }}>← Takaisin</button>
          <h1>Veistä: {name}</h1>{help}<span className="cnt">{count}</span>
        </div>
        {side(count)}
        <div className="stage">
          <CarveLog step={carving.step} done={carving.done} parts={s.parts} label={`${s.name}: ${name}`} onPart={carvePart} />
        </div>
        <div className="tray" role="group" aria-label="Työkalut">
          {TOOLS.map((t) => (
            <button key={t.id} className="piece" aria-pressed={carving.tool === t.id}
              onClick={() => { setCarving({ ...carving, tool: t.id }); say(s.hint); }}>
              <ToolIcon tool={t.id} /><span>{t.name}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (view === 'fix' && fixing && building) {
    const name = building.targets.find((t) => t.id === fixing.id)?.name ?? '';
    const count = `Vaihe ${fixing.step + 1} / ${FIX_STEPS.length}: ${FIX_STEPS[fixing.step]}`;
    body = (
      <>
        <div className="bar">
          <button onClick={() => { setFixing(null); go('game'); say('Kiinnitys keskeytyi. Voit aloittaa uudelleen.'); }}>← Takaisin</button>
          <h1>Kiinnitä: {name}</h1>{help}<span className="cnt">{count}</span>
        </div>
        {side(count)}
        <div className="stage">
          <FixPiece kind={fixing.kind} done={fixing.done} active={fixing.step === 2} label={`Kiinnitä: ${name}`} onSpot={fixSpot} />
        </div>
        {fixing.step < 2 && (
          <div className="tray" role="group" aria-label={fixing.step ? 'Työkalut' : 'Kiinnikkeet'}>
            {(fixing.step ? fixing.tools : fixing.materials).map((id) => (
              <button key={id} className="piece" onClick={() => pickFix(id)}><PartIcon id={id} /><span>{FIX_NAME[id]}</span></button>
            ))}
          </div>
        )}
      </>
    );
  } else if (building?.plan && project) {
    const plan = building.plan;
    const count = `Huoneet ${plan.goal.length - missing(plan, furn).length} / ${plan.goal.length}`;
    const items = (Object.keys(plan.pieces) as Item[]).filter((i) => left(plan, furn, i) > 0);
    body = (
      <>
        <div className="bar">
          <button onClick={() => go('pick')}>← Takaisin</button><h1>{building.name}</h1>
          {help}<span className="cnt">{count}</span>
        </div>
        {side(count)}
        <div className="stage">
          <Scene building={building} project={project} svgRef={svgRef} placing={!!(selItem || selPiece)} selPiece={selPiece} onCell={tapCell} onPiece={tapPiece}
            grab={(id) => dragPlan(furn.find((f) => f.id === id)!.item, id)} preview={preview} />
        </div>
        <div className="tray" role="group" aria-label={selPiece ? 'Valittu huonekalu' : 'Huonekalut'}>
          <div ref={trayRef} className={trayScrolls ? 'strip scrolls' : 'strip'}>
            {selPiece ? (
              <>
                <button className="piece" onClick={turnPiece}><b aria-hidden="true">↻</b><span>Käännä</span></button>
                <button className="piece" onClick={() => { setSelPiece(null); furnish(furn.filter((f) => f.id !== selPiece), 'Poistettu.'); }}><b aria-hidden="true">✕</b><span>Poista</span></button>
                <button className="piece" onClick={() => tapPiece(selPiece)}><b aria-hidden="true">✓</b><span>Valmis</span></button>
              </>
            ) : items.length ? items.map((i) => (
              <button key={i} className="piece drag" aria-pressed={selItem === i} aria-label={`${ITEM_LABEL[i]}, ${left(plan, furn, i)} jäljellä`} {...dragPlan(i)}
                onClick={() => { if (wasDrag.current) return; setSelItem(i); say(`Napauta kohtaa, johon ${ITEM_LABEL[i].toLowerCase()} tulee.`); }}>
                <ItemIcon item={i} /><span>{ITEM_LABEL[i]} × {left(plan, furn, i)}</span>
              </button>
            )) : <p>Kaikki huonekalut ovat paikallaan.</p>}
          </div>
          <button disabled={!history.length} onClick={() => {
            update({ ...project, furniture: history[history.length - 1] });
            setHistory((h) => h.slice(0, -1)); setSelPiece(null); say('Peruttu.');
          }}>↶ Peru</button>
          {/* While a piece is chosen its own ✓ Valmis ends the edit; the building's one is hidden so the two never mix. */}
          {!selPiece && <button onClick={() => { update({ ...project, phase: 'done' }); go('pick'); }}>✓ {building.name} valmis</button>}
        </div>
      </>
    );
  } else if (building && shown && project) {
    const count = `Palat ${shown.placed.length} / ${building.targets.length}`;
    body = (
      <>
        <div className="bar">
          <button onClick={() => go('pick')}>← Takaisin</button><h1>{building.name}</h1>
          {help}<span className="cnt">{count}</span>
        </div>
        {side(count)}
        <div className="stage">
          <Scene
            building={building} project={shown} selKind={sel} svgRef={svgRef}
            onSlot={(id) => {
              const k = building.targets.find((t) => t.id === id)?.kind;
              if (k && SHUTOFF[k]) doPlace(id, k); else if (sel) doPlace(id, sel); else say('Valitse ensin pala alta.');
            }}
            onPaint={building.mode ? undefined : paintPiece}
            onUse={building.mode === 'sisa' ? tryPiece : undefined} lit={lit}
          />
        </div>
        {shown.phase === 'build' ? (
          <div className="tray" role="group" aria-label="Palat">
            <div ref={trayRef} className={trayScrolls ? 'strip scrolls' : 'strip'}>
              {kinds.map((k) => (
                <button
                  key={k} className="piece drag" aria-pressed={sel === k}
                  aria-label={`${KIND_LABEL[k]}, ${unplaced(building, shown, k)} jäljellä`}
                  onPointerDown={(e) => {
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
                    drag.current = { kind: k, x: e.clientX, y: e.clientY, active: false };
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d) return;
                    if (d.active || isDrag(e.clientX - d.x, e.clientY - d.y)) { d.active = true; setSelKind(k); setGhost({ x: e.clientX, y: e.clientY, label: KIND_LABEL[k] }); }
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
            </div>
            <button disabled={shown.placed.length === 0} onClick={() => { update(undo(project)); say('Peruttu.'); }}>↶ Peru</button>
          </div>
        ) : building.mode ? (
          <div className="col"><button className="main big1" onClick={() => go('pick')}>✓ Valmis</button></div>
        ) : (
          <div className="palette" role="group" aria-label="Värit">
            <div ref={trayRef} className="strip">
              {PALETTE.map((c, i) => (
                <button key={c.name} className="sw" aria-pressed={selColor === i} onClick={() => { setSelColor(i); say('Napauta osaa kuvassa.'); }}>
                  <i style={{ background: c.value ?? 'linear-gradient(135deg, #c98a4b 50%, #bfe3f5 50%)' }} />{c.name}
                </button>
              ))}
            </div>
            <button className="main" onClick={() => { update({ ...project, phase: 'done' }); go('pick'); }}>✓ Valmis</button>
          </div>
        )}
      </>
    );
  } else {
    body = <div className="col"><button className="main big1" onClick={() => go('home')}>Takaisin alkuun</button></div>;
  }

  return (
    <main className={view === 'game' || view === 'carve' || view === 'fix' ? 'play' : undefined}>
      <div id="app">{body}</div>
      {ghost && <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div>}
    </main>
  );
}
