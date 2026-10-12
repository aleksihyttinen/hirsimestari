# Hirsimestari

Rauhallinen rakennuspeli: rakenna hirsirakennus palasista ja maalaa se. Suomenkielinen, ei tasoja, ei aikarajoja.

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
- `src/App.tsx` – näkymät: alkuvalikko, omat rakennukset, uusi rakennus, asetukset, peli.

## Päätökset

- Rakennukset: Laavu (helpoin: hirret, katto, nuotio), Sauna (laituri järvelle, savupiippu) ja Mökki (kaksi ikkunaa, kuisti, savupiippu).
- Asetuksissa voi laittaa päälle puheen, joka lukee ohjeen ääneen (Papunetin äänituen tapaan).
- Palat asetetaan järjestyksessä: hirret alhaalta ylös, sitten ovi ja ikkuna, lopuksi katto. Näkyvissä on vain seuraava mahdollinen paikka.
- Tallennus: jokainen siirto tallentuu. Valmiin rakennuksen voi avata ja maalata uudelleen.
- Uusi rakennus = uusi rivi datassa (`src/game/buildings.ts`) ja lisäys `BUILDINGS`-listaan.
- Äänet ovat oletuksena pois. Poistu-nappi yrittää sulkea ikkunan; selain voi kieltäytyä.
