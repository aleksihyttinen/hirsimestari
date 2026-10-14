# Hirsimestari

Rauhallinen rakennuspeli: rakenna hirsirakennus palasista ja maalaa se. Suomenkielinen, ei tasoja, ei aikarajoja.

**Pelaa:** [hirsimestari.leksi.dev](https://hirsimestari.leksi.dev)

> **About this project:** Hirsimestari was made for real use. My mother works at a group home for disabled people (vammaisten asumisyksikkö). One of the residents asked what I do for work, and then asked whether I could make him a construction game to play on his iPad. This is that game.
>
> It is written entirely by AI. All the code, tests and documentation were produced by a coding agent ([Claude Code](https://claude.com/claude-code)), with me directing, reviewing and testing. Building it was also my way to study agentic coding.

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

- `src/game/` – säännöt ja data ilman Reactia: `rules.ts` (sijoitus, tarttuminen, peruminen, maalaus), `buildings.ts` (rakennukset dataa), `plan.ts` (Sisusta: huonekalujen sijoitus ja huoneiden tunnistus), `storage.ts` (localStorage), `gesture.ts` (napautus vai veto).
- `src/Scene.tsx` – SVG-piirto (viewBox 400×300), erillään säännöistä.
- `src/App.tsx` – näkymät: alkuvalikko, pelitavan valinta, omat rakennukset, uusi rakennus, asetukset, peli, veisto, kiinnitys, ohje.

## Päätökset

- Neljä pelitapaa: Rakenna (talot), Hirsityöt (hirsirungot, joissa järjestys pitää päätellä itse; erikoishirret voi halutessaan veistää; runkoja ei maalata), Sisätyöt (huoneen sähkö- ja vesityöt) ja Sisusta (pohjapiirroksen kalustus).
- Hirsityöt: Aitan runko (kulmakivillä), Mökin runko ja Omakotitalon runko.
- Sisätyöt: Keittiö, Kylpyhuone ja Sauna (sähkökiuas). Ensin katkaistaan virta ja suljetaan vesi napauttamalla sähkökeskusta ja pääventtiiliä. Jokainen osa kiinnitetään: valitse oikea kiinnike ja työkalu kolmesta vaihtoehdosta (järjestys vaihtuu), ja napauta kiinnityskohdat. Lopuksi vesi avataan ja virta kytketään takaisin. Valmiissa huoneessa voi kokeilla valoa, vettä ja kiuasta.
- Sisusta: Pihasauna, Mökki ja Omakotitalo ylhäältä nähtynä. Huonekalut vedetään tai napautetaan vapaasti paikoilleen, ja niitä voi siirtää, kääntää ja poistaa. Kun huoneessa on oikeat huonekalut (esim. sänky ja yöpöytä vierekkäin), peli tunnistaa huoneen ja kehuu. Pesutilat ovat valmiina.
- Jokaisessa näkymässä on ?-nappi, joka avaa siihen sopivan ohjeen. Pelinäkymissä sen vieressä on 🔊-nappi, joka lukee ohjeen kerran ääneen.
- Valmis-nappi avaa loppunäkymän: Rakenna-talo kasvaa syvyyteen ja Sisusta-pohjapiirros kääntyy ulkoa nähdyksi taloksi, jonka seinät nousevat ja katto laskeutuu paikalleen. Rungot ja huoneet näytetään valmiina kuvina.
- Valmis on Peru-napin vieressä (Sisustassa vasta kun kaikki huoneet ovat valmiina; puhelimessa omalla rivillään). Valmiissa rungossa ja huoneessa iso Valmis-nappi korvaa palarivin. Maalatessa Peru peruu viimeisen maalauksen.
- Rakenna: Laavu (helpoin: hirret, katto, nuotio), Rantasauna (laituri järvelle, savupiippu) ja Mökki (kaksi ikkunaa, kuisti, savupiippu).
- Asetuksissa voi laittaa päälle puheen, joka lukee ohjeen ääneen (Papunetin äänituen tapaan), suuren tekstin ja vähemmän liikettä (loppunäkymä ilman animaatiota; myös laitteen oma asetus otetaan huomioon).
- Tabletilla palarivin päissä on ‹ ›-nuolet, kun kaikki palat eivät mahdu; puhelimessa riviä pyyhkäistään. Puhelimessa palarivi pysyy näytön alareunassa, ja vaakasuuntainen puhelin käyttää tabletin asettelua.
- Palat asetetaan järjestyksessä: hirret alhaalta ylös, sitten ovi ja ikkuna, lopuksi katto. Näkyvissä on vain seuraava mahdollinen paikka.
- Tallennus: jokainen siirto tallentuu. Valmiin rakennuksen voi avata ja maalata uudelleen.
- Uusi rakennus = uusi rivi datassa (`src/game/buildings.ts`) ja lisäys `BUILDINGS`-listaan.
- Äänet ja puhe ovat oletuksena pois.
