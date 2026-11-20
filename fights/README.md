# Duel files (fights/<nr>-<slug>.json)

One file = one video (~68 s). `./make_video.sh fights/<file>.json` -> `build/<id>/<id>.mp4`.
The fight choreography is fixed: **red always loses (knocked out), blue always wins.**
For "human vs. X": put the opponent in red and the human in blue, or for a rare upset put the human in red.

## Fields
- `id`: same as file name without .json
- `title.sub`: small line under the title, e.g. "WORLD TITLE · 12 ROUNDS"
- `red` / `blue`: `name` (big text, UPPERCASE, max ~14 chars), `stats` (exactly 2 lines, UPPERCASE, max ~32 chars), `look` (below)
- `ring` (optional): `{"mat": [big, middle, small], "apron": "RED vs BLUE"}`. Default: mat "FIGHT NIGHT / WORLD TITLE FIGHT / @DAILY.FIGHT-NIGHT", apron = the two names.
- `outro`: 4 lines `[text, colour]` shown after the win (colour: red/blue/white/gold)
- `vo`: English narrator lines, keys and max lengths (seconds). The voice runs at +16 % (≈3.1 words/s). **Fill every slot to 80–95 % of its max** with extra facts, stats or jokes, so there is no dead air (Hermann 20.11.2026: faster voice, more info, same length). `tts.py` prints `SHORT` for a line under 75 %: then add content.
  - l01 0.3s max 4.4 – hook ("Tonight...")
  - l02 5.0s max 9.9 – "In the red corner... <red>!" + 2 funny facts
  - l03 15.3s max 8.0 – "And in the blue corner... <blue>!" + 1 funny fact
  - l04 24.0s max 5.2 – fun fact during the first exchange
  - l05 29.3s max 4.3 – "Ohh!" reaction: red lands a big overhand on blue
  - l06 33.7s max 4.6 – turn: blue has something red never had
  - l08 42.9s max 2.6 – "Down goes <red>!"
  - l10 48.3s max 2.2 – "Your winner... <blue>!"
  - l11 50.6s max 7.6 – punchline / twist
  - l12 58.5s max 5.2 – replay commentary over the slow-motion knockout ("Let's see that again... look at that uppercut...")
  - fixed lines: count 8-9-10, l13 "Who should fight next? Tell me in the comments!" (l12 falls back to "Let's see that again." if missing)
- `caption`, `hashtags`: TikTok post text. Always add the credit line from below.

## look
- `body`: human | brute (heavy, low) | slim | giant
- `skin`: pale | light | tan | brown | dark | zombie | alien | robot (metal) | gold (metal) | devil | ice
- `hair`: short | wild | long | mohawk | bald, `hairCol` "#hex", `beard` true/false, `chestHair` true/false
- `morph`: 0-1 caveman face (brow ridge, no chin). 1 = Homo erectus
- `outfit`: trunks | pelt, `trunks`/`stripe` "#hex" (default corner colour), `trunksText` (max 12 chars)
- `feet`: boots | bare, `bootCol`
- `iris`: ["#inner", "#outer"], `eyeGlow`: "#hex" glowing eyes (robot, demon...)
- `hat`: viking | gladiator | crown | headband | horns | antenna | cap, `hatCol` "#hex"

## Credit (required, CC BY 3.0 head scan)
Head scan: Lee Perry-Smith / Infinite-Realities (CC BY 3.0)

## Objects (cartoon fighters with googly eyes)
`look.object`: toaster | fridge | cone | trashcan | washer | cactus | burger  (`limbCol` "#hex" for the arms/legs, `eyeGlow` works too).
Other look fields are ignored for objects.
