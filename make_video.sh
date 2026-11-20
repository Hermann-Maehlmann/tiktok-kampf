#!/usr/bin/env bash
# Builds one duel video.  usage: ./make_video.sh fights/<id>.json   ->  build/<id>/<id>.mp4
# Steps: events -> voice-over (edge-tts) -> sound (audio3.py) -> frames (headless Chromium, PAR in parallel) -> ffmpeg
set -e
cd "$(dirname "$0")"
SRC=${1:-fights/v3.json}
ID=$(python3 -c "import json;print(json.load(open('$SRC'))['id'])")
OUT=build/$ID; mkdir -p "$OUT"
[ -d node_modules ] || npm install
node events.mjs > /dev/null 2>&1
if [ "$SRC" = "fights/v3.json" ]; then cp "$SRC" "$OUT/fight.json";                       # v3 has its recorded voice
elif [ ! -f "$OUT/fight.json" ] || [ "$SRC" -nt "$OUT/fight.json" ]; then python3 tts.py "$SRC"; fi
FIGHT=$OUT/fight.json AUDIO_OUT=$OUT/audio.wav python3 audio3.py
FPS=30; DUR=$(python3 -c "import json;print(json.load(open('events.json'))['dur'])"); N=$(python3 -c "print(int($DUR*$FPS))")
PAR=${PAR:-4}; rm -rf "$OUT/frames"; step=$(( (N + PAR - 1) / PAR ))
for i in $(seq 0 $((PAR-1))); do s=$((i*step)); e=$(((i+1)*step)); [ $e -gt $N ] && e=$N; FIGHT=$OUT/fight.json node render.js "$OUT/frames" $FPS $s $e 2>&1 | grep -E "^done|ERR" & done; wait
[ "$(ls "$OUT/frames" | wc -l)" -eq "$N" ] || { echo "frames missing"; exit 1; }
ffmpeg -v error -y -framerate $FPS -i "$OUT/frames/%05d.jpg" -i "$OUT/audio.wav" -vf "hqdn3d=3:2:6:4" -c:v libx264 -preset slow -crf 20 -maxrate 7M -bufsize 14M \
  -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/$ID.mp4"
rm -rf "$OUT/frames"
echo "fertig: $OUT/$ID.mp4"
