# TikTok Kampf – Autopilot

Täglich ein 3D-Boxkampf (~68 s): Mensch gegen irgendwas (Gegenstände, Typen, Tiere).
Eine geplante Claude-Aufgabe erfindet das Duell, rendert das Video und plant es über Metricool auf TikTok ein.

- `AUTOPILOT.md` – der Ablauf, den jeder Lauf befolgt
- `fights/README.md` – Format der Duell-Dateien (Looks, Texte, Stimme)
- `make_video.sh fights/<datei>.json` – Stimme (edge-tts) → Ton → Bilder (Three.js, headless Chromium) → `build/<id>/<id>.mp4`
- `state/fights.json` – Logbuch aller Duelle
- Branch `videos` – kurze Ablage für Metricool, wird nach jedem Lauf geleert

Engine: Three.js 0.170 (MIT), Kopfscan Lee Perry-Smith / Infinite-Realities (CC BY 3.0, Credit in jeder Caption), Inter-Schriften (OFL). Musik und Sounds sind synthetisch (`audio3.py`).
