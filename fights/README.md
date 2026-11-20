# Duel files (fights/<nr>-<slug>.json)

One file = one video (~68 s). `./make_video.sh fights/<file>.json` -> `build/<id>/<id>.mp4`.
The fight choreography is fixed: **red always loses (knocked out), blue always wins.**
For "human vs. X": put the opponent in red and the human in blue, or for a rare upset put the human in red.

## Fields
- `id`: same as file name without .json
- `title.sub`: small line under the title, e.g. "WORLD TITLE · 12 ROUNDS"
- `red` / `blue`: `name` (big text, UPPERCASE, max ~14 chars), `stats` (exactly 2 lines, UPPERCASE, max ~32 chars), `look` (below)
- `outro`: 4 lines `[text, colour]` shown after the win (colour: red/blue/white/gold)
- `vo`: English narrator lines, keys and max lengths (seconds, ~2.8 words/s):
  - l01 0.3s max 4.4 – hook ("Tonight...")
  - l02 5.0s max 9.9 – "In the red corner... <red>!" + 2 funny facts
  - l03 15.3s max 8.0 – "And in the blue corner... <blue>!" + 1 funny fact
  - l04 24.0s max 5.2 – fun fact during the first exchange
  - l05 29.3s max 4.3 – "Ohh!" reaction: red lands a big overhand on blue
  - l06 33.7s max 4.6 – turn: blue has something red never had
  - l08 42.9s max 2.6 – "Down goes <red>!"
  - l10 48.3s max 2.2 – "Your winner... <blue>!"
  - l11 50.6s max 7.6 – punchline / twist
  - fixed lines (no need to write): count 8-9-10, l12 "Let's see that again." (replay), l13 "Who should fight next? Tell me in the comments!"
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
