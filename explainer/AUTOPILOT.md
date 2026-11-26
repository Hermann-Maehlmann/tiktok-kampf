# Autopilot "unlocked_body" (1 explainer video per day, with approval)

A scheduled task starts a fresh Claude session every day. It runs this workflow exactly once.
**Nothing goes out publicly.** The finished video goes into Metricool as a **draft**. Hermann reviews it and publishes it himself.

Format (approved by Hermann on 26.11.2026, reference: `episodes/001-stomach/`):
English neon science explainer, ~68–72 s, a dark or bizarre fact about the body or brain.
- Neon flat-vector images, each scene animated ("living image").
- 1 AI clip in the hook.
- Captions as phrase chunks in the lower third.
- Info overlays: labels with a pointer, plus number cards.
- Voice: ElevenLabs "Roman Sharp".
- Music bed from the library.

Language: Hermann writes German, and the summary at the end is in German. Video, caption and overlays are in English.

## Credit budget (Creator plan ~121k/month, 30 videos)
Target per video is about **3,700 credits**, never more than 5,000.

| Item | Cost | Note |
|---|---|---|
| Voice | ~1,100 | **exactly 1 take** |
| 10 images | 48 each, ~480 total | `recraft-v4.1-flash`, 9:16 |
| AI clip | 2,121 | `kling-2.5-turbo`, 5 s, hook only |
| Music | 0 | reused from `music/` |
| Scribe | free | |

- **Never** call a generation twice to "retry". Each call is charged.
- If a run fails, check its status first. Restart only one node, and only on a real error.
- Check `account_get_usage` at the start. If fewer than 8,000 credits are left, make no Kling clip (hook animated by code only). If fewer than 3,000 are left, make nothing and report it.

## Workflow

### 1. Prepare
- Attach the repo with `add_repo` (access `push`) and clone it. Run `git checkout claude/project-thread-q30pc2` (the explainer code lives on this branch until Hermann merges it).
- Install: `pip install numpy pillow torch --index-url https://download.pytorch.org/whl/cpu` (torch is only needed if missing). ffmpeg is preinstalled.
- Set the git identity: `git config user.name "Explainer Autopilot"` and `git config user.email autopilot@users.noreply.github.com`.
- Read `explainer/state/episodes.json`. Never repeat a topic.
- Run `getScheduledPosts` for brand **8253235**, from today to +3 days. Are 2 or more unpublished explainer drafts already waiting? Then build **no** new video: Hermann hasn't caught up. Report "Drafts are waiting for approval" and stop.

### 2. Pick a topic and write the script
- Niche: dark, surprising, **true** facts about your own body or brain, such as:
  - bones dissolving and rebuilding themselves
  - the liver regrowing
  - the immune system "not knowing" the eyes
  - the brain cleaning itself during sleep
  - mites on your face
  - your gut bacteria outnumbering your cells
- Topics that need a doctor are not allowed, and neither are sensational health promises.
- **Verify every number with a web search** (Parallel Search). Only use what is well documented. Round, and use "about" if unsure.
- Script: **170–190 words**, short spoken sentences, English. Arc:
  1. Shock hook ("Right now, your … is …")
  2. "That's not a metaphor."
  3. The normal mechanism
  4. What goes wrong
  5. Even worse
  6. The twist
  7. A gut-punch ending that ties back to the hook
- Name the episode `NNN-slug` (3-digit counter). Work folder `explainer/episodes/NNN-slug/`. Write the script to `script.txt`.

### 3. Voice + word timestamps (one flow for everything)
- `creative_create_flow`, then use that `flow_id` for every call.
- `creative_generate_speech`: `model_id "eleven_v4"`, `voice_id "pn8ABB5WQQBNyhFA5uEG"` (Roman Sharp), `generations_count 1`, prompt = the script.
- Poll until finished. Download `master_url` → `voice.mp3` (curl; elevenlabsusercontent.com is allowed). Check the duration with `ffprobe`: target 62–72 s.
- `creative_transcribe_audio`: `model_id "eleven_scribe_v1"`, `connect_from [<TTS node>]`. The result contains a download URL for `…-words.json`. Save it as `words.json` (format `{"words":[{"text","type","start","end"}]}`).

### 4. Images (10 scenes)
- Break the script into ~10 scenes of 5–7 s each (new scene at a sentence or thought boundary). Take each scene's `start` from `words.json` (start of its first word; scene 1 = 0.0).
- One image per scene: `creative_add_flow_node` with `node_type "image-generation"`, `model_id "recraft-v4.1-flash"`, label `S01 …`. Then **`creative_update_node` with `model_parameters {"aspect_ratio":"9:16"}`** (otherwise it comes out 16:9!). Then start all 10 together with `creative_run_flow_nodes` and `generations_count 1`.
- Prompt = motif + this style suffix:
  > `Flat vector illustration with neon glow, bold saturated colors (electric cyan, hot magenta, golden yellow, deep violet), dark navy space background with tiny stars and floating particles, clean smooth shapes, soft bloom lighting, cinematic depth, playful science-cartoon look. Vertical 9:16 composition, main subject centered in the middle third. No text, no letters, no labels.`
- Motifs:
  - Body parts and cells as cute neon cartoon objects. Cells or bacteria may have faces.
  - **No realistic people, no blood or gore, no real brands.**
  - At most one human silhouette (the ending scene, "you").
- Download each image (`master_url`, webp) and save it as PNG to `img/s01.png` … (PIL).
- Look at all the images (contact sheet). If an image clearly misses (wrong motif, text in the image, gore), regenerate **that one** once.

### 5. AI clip for the hook (scene 1)
- Only if the budget allows (see above).
- `creative_add_flow_asset_node` with the `generation_id` of the S01 image.
- Then `creative_add_flow_node`: `node_type "video-generation"`, `model_id "kling-2.5-turbo"`, `connect_from [<asset node>]`, `model_parameters {"aspect_ratio":"9:16","duration_secs":5,"negative_prompt":"morphing, distortion, text, letters, realistic, photo"}`.
  - Prompt: describe the motion, and end with "Static camera with a slow gentle push in. Keep the flat neon vector cartoon style, no morphing, no new objects, no text."
  - Do **not** set `resolution` or `generate_audio`: Kling rejects them.
- Run it with `creative_run_flow_nodes`. It takes about 2–4 min. Save the result as `clips/v01.mp4`. In `episode.json`, set `"video": "clips/v01.mp4"` on scene 1.

### 6. episode.json
Template: `explainer/episodes/001-stomach/episode.json`. Fields:
- `voice`, `words`
- `music`: `../../music/trackNN.mp3`. Pick a different track than the last episode.
- `tail`: 1.6
- `living`: true
- `captions`: `"phrase"`
- `scenes`: one entry per scene, with these fields:
  - `start`
  - `image`
  - `color`: the caption color for the active word. Rotate through `#ff3b5c #ffd23f #ff5fd2 #3ee8ff #a8ff3e #ff8a1f #ffffff`.
  - `motion`: `in|out|left|right|up`, mixed.
  - `focus`: `[0.5,0.5]`
  - `fx`:
    - `wobble`: 2–7, high for liquids
    - `breathe`: 1–1.6
    - `glow`: 1–1.3
    - `flicker`: 1 for fire or electricity
- `callouts`: **8–12**, about one per scene, appearing when the term is spoken. They must be informative, not decorative.
  - `{"at": <time the term is spoken>, "dur": 2–6, "type": "label", "text": "TERM", "sub": "short explanation", "color": "#…", "pos": [x,y], "target": [x,y]}`
    - `target` = the object in the image (0–1 screen coordinates)
    - `pos` = the box, in the **upper area, y 0.16–0.32**
  - `{"type": "stat", "text": "3–5 DAYS", "sub": "…", "pos": [0.5, 0.17]}` for strong numbers (max. 3 per video).
  - Keep clear: the caption zone y 0.65–0.82, the right edge (TikTok buttons), and y < 0.12.
  - Callouts must not overlap in time unless they sit at clearly different positions.

### 7. Check, then render
- Test frames (fast, no video):
  ```
  cd explainer/episodes/NNN-slug
  FRAMES=60,200,... python3 ../../render.py episode.json /tmp/t
  ```
  This writes `/tmp/t.<frame>.jpg`. The ffmpeg error at the end is normal in this mode.
  - Take 1 frame per callout (at + 0.8 s) × 30 fps.
  - Look at them: does the pointer hit the object? Is the box fully visible? Are the captions readable? Fix positions and test again (max. 3 rounds).
- Render (≈ 15 min, start it in the background):
  ```
  CRF=24 python3 ../../render.py episode.json out.mp4
  ```
- Acceptance:
  - `ffprobe` duration = voice + 1.6 s
  - file under 95 MB (otherwise re-encode with CRF 27)
  - make a contact sheet of 8 frames and look at it: no black or broken frames

### 8. Into Metricool as a DRAFT
- `bash autopilot/host.sh upload explainer/episodes/NNN-slug/out.mp4` → public URL.
- `createScheduledPost`, brand **8253235**, with:
  - `draft: true`
  - `autoPublish: true`
  - date: **today 19:00 Europe/Berlin**. If it is already past 18:00, or a post already exists that day, use the next free day at 19:00.
  - `info`:
    ```
    {"text": <Caption>, "providers":[{"network":"tiktok"}], "media":[<URL>],
     "publicationDate":{"dateTime":"YYYY-MM-DDT19:00:00","timezone":"Europe/Berlin"},
     "autoPublish": true, "draft": true,
     "tiktokData":{"privacyOption":"PUBLIC_TO_EVERYONE","isAigc":true,"title":<Title>},
     "firstCommentText":"What body fact should we unlock next? 👇",
     "descendants":[], "shortener":false, "smartLinkData":{"ids":[]},
     "hasNotReadNotes":false, "mediaAltText":[]}
    ```
  - Caption (English, max. 150 characters without hashtags): hook plus a question to viewers, then 4–5 hashtags, e.g. `#science #humanbody #biology #didyouknow` plus one niche hashtag.
  - `isAigc: true`, because images and voice are AI-generated.
- Then run `bash autopilot/host.sh clear`. Metricool copied the video.
- **Never** `draft: false`. Hermann publishes himself.

### 9. Keep the record
- Append to `explainer/state/episodes.json`:
  `{"datum", "id", "thema", "fakten_quellen":[urls], "credits_ca", "kling": true|false, "status": "entwurf", "geplant_fuer", "plannerUrl"}`
- Commit the episode folder **without** `out.mp4`, `img/` or `clips/` (see `.gitignore`); `script.txt`, `episode.json`, `words.json` and `voice.mp3` stay.
  - Commit message: "Explainer: <topic>"
  - Push to `claude/project-thread-q30pc2`.

### 10. Summary (German, short)
First line: "🎬 Neues Video wartet auf deine Freigabe in Metricool". Then:
- topic + hook sentence
- planned time
- planner link
- credits used ~
- the 2–3 key facts with their sources

Problems go at the very top with "⚠️ Hermann, bitte kümmern:".
