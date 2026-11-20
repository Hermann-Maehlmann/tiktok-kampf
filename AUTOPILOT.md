# TikTok-Autopilot „Kampf“ (1 Video pro Tag)

Eine geplante Aufgabe startet jeden Tag eine frische Claude-Sitzung, die diesen Ablauf genau einmal durchläuft.
Format: 3D-Boxkampf ~68 s, „Mensch gegen irgendwas“. Englische Stimme (edge-tts), englische Texte.

## Ablauf
1. **Vorbereiten**
   - `git pull`. Für Push das Repo mit `add_repo` und `access: "push"` anhängen.
   - Git-Name: `git config user.name "Kampf Autopilot"`, `git config user.email autopilot@users.noreply.github.com`.
   - `npm install` (three), `pip install edge-tts numpy scipy`. Playwright/Chromium sind vorinstalliert.
   - `state/fights.json` lesen (alle bisherigen Duelle). Kein Gegner darf sich innerhalb von 30 Tagen wiederholen.
   - **Gesundheitscheck:** `getScheduledPosts` (gestern bis morgen) für die Marke unten. Ist ein Post von gestern auf ERROR/FAILED oder noch PENDING, beginnt die Zusammenfassung mit **„⚠️ Hermann, bitte kümmern:“** und es wird nichts Neues öffentlich eingeplant.
2. **Duell erfinden** (nach `fights/README.md`, Pflicht)
   - Mischung über die Woche: ~50 % Gegenstände (`look.object`: toaster, fridge, cone, trashcan, washer, cactus, burger), ~30 % Typen/Fantasie (Roboter, Zombie, Wikinger, Teufel, König, Alien, „Der Chef“, „Montagmorgen“ …), ~20 % Tiere (Gorilla, Bär … über `skin: fur_dark/fur_brown`, `morph`, `hat: bearEars/catEars/bunnyEars`).
   - **Niemals echte Personen** (Politiker, Streamer, Promis), keine echten Marken oder Logos (Hermann 18.11.2026, TikTok-Regeln + Recht am eigenen Bild). Nur Typen ohne Namen.
   - Der Mensch steht meist in Blau und gewinnt. Etwa jedes 5. Video ein Überraschungssieg des Gegners: dann der Gegner in Blau, der Mensch in Rot.
   - Witzig, kurz, englisch. Stats und Outro mit Pointe. `l11` ist die stärkste Pointe. Jede `vo`-Zeile unter ihrer Maximallänge (≈ 2,8 Wörter pro Sekunde).
   - Datei `fights/<nr>-<slug>.json` (`nr` = laufende Nummer, 3-stellig).
3. **Vorschau prüfen**: `FIGHT=fights/<datei>.json node render.js preview/<id> stills 2 7 17 28.5 40.3 49 60.6 66.8` und jedes Bild ansehen: Gegner erkennbar und lustig? Augen frei (nichts von Hut/Helm verdeckt)? Texte lesbar, nichts abgeschnitten? Sonst Look ändern und neu prüfen (max. 3 Runden).
4. **Rendern**: `./make_video.sh fights/<datei>.json` (Stimme → Ton → Bilder → Video, ca. 35–45 Min, im Hintergrund starten).
   - Bricht `tts.py` mit „TOO LONG“ ab: die genannte Zeile kürzen und neu starten.
   - Abnahme: `ffprobe` Dauer ≈ 68,5 s. 8 Bilder ziehen (`ffmpeg -i build/<id>/<id>.mp4 -vf "fps=8/68.5,scale=270:-1,tile=8x1" -frames:v 1 check.png`) und ansehen. Kaputt/schwarz → nicht posten, melden.
5. **Ablegen**: `bash autopilot/host.sh upload build/<id>/<id>.mp4` → öffentliche URL.
6. **In Metricool einplanen** (`createScheduledPost`)
   - Marke: **8253235** („fight night“, TikTok @daily.fight-night, Zeitzone Europe/Berlin).
   - Uhrzeit: **19:00 Europe/Berlin** am selben Tag (ist es schon nach 18:40, dann am nächsten Tag 19:00). Ist an diesem Tag schon ein Post eingeplant (`getScheduledPosts`), den nächsten Tag ohne Post nehmen, höchstens 3 Tage im Voraus; sind alle belegt, nichts einplanen und melden.
   - `info`: `{"text": <Caption>, "providers":[{"network":"tiktok"}], "media":[<URL>], "publicationDate":{"dateTime":"YYYY-MM-DDT19:00:00","timezone":"Europe/Berlin"}, "autoPublish": true, "draft": <MODUS>, "tiktokData":{"privacyOption":"PUBLIC_TO_EVERYONE","isAigc":false,"title":<Titel>}, "firstCommentText":"Who should fight next? 👇", "descendants":[], "shortener":false, "smartLinkData":{"ids":[]}, "hasNotReadNotes":false, "mediaAltText":[]}`
   - **MODUS (Hermann 18.11.2026: sofort automatisch):** `draft: false`, wenn Vorschau (Schritt 3) und Abnahme (Schritt 4) bestanden sind. Nur wenn nach 3 Runden noch ein klarer Fehler bleibt: `draft: true`, Datum nächster Tag 13:00, und in der Zusammenfassung sagen warum.
   - Caption (Englisch, max. 150 Zeichen ohne Hashtags): Hook + Frage an die Zuschauer, dann 4–5 Hashtags (#boxing #whowouldwin + Nische), dann die Pflichtzeile `Head scan: Lee Perry-Smith / Infinite-Realities (CC BY 3.0)`.
   - Danach `bash autopilot/host.sh clear` (Metricool hat das Video kopiert).
7. **Buch führen**: Eintrag an `state/fights.json` anhängen `{"datum","id","rot","blau","gewinner","art":"objekt|typ|tier","status":"entwurf|oeffentlich","geplant_fuer","plannerUrl"}`, Duell-Datei committen (kein Video), Commit „Autopilot: <rot> vs <blau>“, push auf `main`.
8. **Abschluss**: kurze deutsche Zusammenfassung (Duell, Uhrzeit, Entwurf/öffentlich, Planner-Link). Probleme mit „⚠️ Hermann, bitte kümmern:“ ganz oben.
