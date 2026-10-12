# Hirsimestari

Rauhallinen rakennuspeli: rakenna hirsirakennus palasista ja maalaa se. Suomenkielinen, ei tasoja, ei aikarajoja.

**Pelaa:** [hirsimestari.leksi.dev](https://hirsimestari.leksi.dev)

> **About this project:** Hirsimestari is written entirely by AI. All the code, tests and documentation were produced by a coding agent ([Claude Code](https://claude.com/claude-code)), with me directing, reviewing and testing. I built it for my own interest, as a way to study agentic coding, and it is part of my AI engineering portfolio.

## Ajaminen

```bash
npm install
npm run dev        # kehityspalvelin
npm test           # pelilogiikan testit (vitest)
npm run typecheck  # tsc --noEmit (strict)
npm run build      # tuotantoversio hakemistoon dist/
npm run preview    # kokeile tuotantoversiota (PWA ja offline toimivat vain tässä, ei dev-palvelimessa)
```

## Rakenne

- `src/game/` – säännöt ja data ilman Reactia: `rules.ts` (sijoitus, tarttuminen, peruminen, maalaus), `buildings.ts` (rakennukset dataa), `storage.ts` (localStorage), `gesture.ts` (napautus vai veto).
- `src/Scene.tsx` – SVG-piirto (viewBox 400×300), erillään säännöistä.
- `src/App.tsx` – näkymät: alkuvalikko, pelitavan valinta, omat rakennukset, uusi rakennus, asetukset, peli, veisto, kiinnitys, ohje.

## Päätökset

- Kolme pelitapaa: Rakenna (talot), Hirsityöt (hirsirungot, joissa järjestys pitää päätellä itse; erikoishirret voi halutessaan veistää; runkoja ei maalata) ja Sisätyöt (huoneen sähkö- ja vesityöt).
- Sisätyöt: Keittiö, Kylpyhuone ja Löylyhuone (sähkökiuas). Ensin katkaistaan virta ja suljetaan vesi napauttamalla sähkökeskusta ja pääventtiiliä. Jokainen osa kiinnitetään: valitse oikea kiinnike ja työkalu kolmesta vaihtoehdosta (järjestys vaihtuu), ja napauta kiinnityskohdat. Valmiissa huoneessa voi kokeilla valoa, vettä ja kiuasta.
- Jokaisessa näkymässä on ?-nappi, joka avaa siihen sopivan ohjeen.
- Rakennukset: Laavu (helpoin: hirret, katto, nuotio), Sauna (laituri järvelle, savupiippu) ja Mökki (kaksi ikkunaa, kuisti, savupiippu).
- Asetuksissa voi laittaa päälle puheen, joka lukee ohjeen ääneen (Papunetin äänituen tapaan).
- Palat asetetaan järjestyksessä: hirret alhaalta ylös, sitten ovi ja ikkuna, lopuksi katto. Näkyvissä on vain seuraava mahdollinen paikka.
- Tallennus: jokainen siirto tallentuu. Valmiin rakennuksen voi avata ja maalata uudelleen.
- Uusi rakennus = uusi rivi datassa (`src/game/buildings.ts`) ja lisäys `BUILDINGS`-listaan.
- Äänet ja puhe ovat oletuksena pois.
