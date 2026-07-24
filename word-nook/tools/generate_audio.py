#!/usr/bin/env python3
"""
Generate the pre-recorded pronunciation clips Word Nook ships in `audio/`.

Why clips at all? The browser Web Speech API only sounds right when the OS has
a voice for the target language installed — on a typical desktop with no Turkish
voice it falls back to the default (English) voice reading Turkish with English
phonetics. Because the vocabulary is small and fixed, we render each word once,
offline, and ship the audio so pronunciation is correct and identical on every
device (no install, no network at play time).

Engine: eSpeak NG, with MBROLA diphone voices for a more natural tr/nl/en, and
eSpeak NG's native Japanese voice fed kana readings (its MBROLA-jp voice has
missing diphones, and it mis-reads kanji). This is a good, dependency-free
baseline; the clips can be regenerated with a premium/neural TTS later by
swapping VOICES / the synth() call below — keep the same output paths and the
game picks them up unchanged.

Prereqs (Debian/Ubuntu):
    apt-get install -y espeak-ng mbrola ffmpeg mbrola-tr1 mbrola-nl2 mbrola-us1
Run from the word-nook/ directory (or anywhere — paths are resolved from here):
    python3 tools/generate_audio.py
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                 # word-nook/
AUDIO = os.path.join(ROOT, "audio")
VOCAB = os.path.join(ROOT, "vocab.js")

# ---------------------------------------------------------------------------
# TUNING — edit these, re-run, then review with tools/review.html.
# ---------------------------------------------------------------------------
# eSpeak NG voice per language. These are the FEMALE voices (mb-tr2 / mb-nl3 /
# mb-us1 are female; "ja+f3" is eSpeak NG's native Japanese female variant —
# MBROLA-jp is avoided because it has missing diphones and mis-reads kanji).
VOICES = {"en": "mb-us1", "tr": "mb-tr2", "nl": "mb-nl3", "ja": "ja+f3"}

# Some words hit phonemes an MBROLA voice lacks a diphone for (e.g. Turkish
# "pencere"), which MBROLA renders as silence gaps. When that happens we re-render
# the word with eSpeak NG's native (female) voice — more robotic, but complete.
FALLBACK = {"en": "en-us+f3", "tr": "tr+f3", "nl": "nl+f3", "ja": "ja+f3"}

# Learner-friendly pace (words per minute); mirrors the old Web Speech rate 0.9.
RATE = 145

# "Cute" tweak: shift every clip up by this many semitones (pitch up, duration
# preserved) for a lighter, younger voice. 0 = off, ~2–4 = cute, higher = chipmunk.
CUTE_SEMITONES = 3.0

# Japanese: vocab.js stores the display word (often kanji), which eSpeak mis-reads.
# Synthesize from an explicit kana reading instead, keyed by object id.
JA_READING = {
    "rug": "じゅうたん", "window": "まど", "door": "ドア",
    "machine": "コーヒーメーカー", "mug": "カップ", "sugar": "さとう",
    "milk": "ぎゅうにゅう", "bookshelf": "ほんだな", "sofa": "ソファ",
    "person": "こんにちは", "table": "ローテーブル", "coffee": "コーヒー",
    "lamp": "ランプ", "cat": "ねこ", "plant": "しょくぶつ",
}


def load_words():
    """Read the vocabulary from vocab.js (single source of truth) via node."""
    js = (
        "global.window={};require(%r);"
        "const V=global.window.Vocab;"
        "console.log(JSON.stringify(V.INTERACTIVE.map(o=>({id:o.id,words:o.words}))));"
        % VOCAB
    )
    out = subprocess.check_output(["node", "-e", js], text=True)
    return json.loads(out)


def text_for(code, entry):
    if code == "ja":
        return JA_READING.get(entry["id"], entry["words"]["ja"])
    return entry["words"][code]


def synth(text, voice, wav_path):
    """eSpeak NG -> WAV. Returns any stderr (MBROLA missing-diphone warnings)."""
    p = subprocess.run(
        ["espeak-ng", "-v", voice, "-s", str(RATE), "-w", wav_path, text],
        capture_output=True, text=True,
    )
    if p.returncode != 0:
        raise RuntimeError("espeak-ng failed for %r: %s" % (text, p.stderr.strip()))
    return p.stderr.strip()


def encode(wav_path, mp3_path):
    """Pitch-shift (cute), trim silence, normalize loudness, encode small mono MP3."""
    sr = 22050
    filters = []
    if CUTE_SEMITONES:
        # Pitch up without slowing down: raise the sample rate (pitch+speed up),
        # then atempo back to the original duration, then resample to `sr`.
        ratio = 2.0 ** (CUTE_SEMITONES / 12.0)
        filters += [
            "asetrate=%d" % int(sr * ratio),
            "atempo=%.6f" % (1.0 / ratio),
            "aresample=%d" % sr,
        ]
    filters += [
        "silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB",
        "areverse",
        "silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB",
        "areverse",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
    ]
    af = ",".join(filters)
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", wav_path, "-af", af,
         "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "48k",
         mp3_path],
        check=True,
    )


def main():
    words = load_words()
    manifest = {}
    warnings = []
    tmp_wav = os.path.join(AUDIO, "_tmp.wav")

    for code, voice in VOICES.items():
        out_dir = os.path.join(AUDIO, code)
        os.makedirs(out_dir, exist_ok=True)
        ids = []
        for entry in words:
            wid = entry["id"]
            text = text_for(code, entry)
            warn = synth(text, voice, tmp_wav)
            used = voice
            if warn and FALLBACK.get(code) and FALLBACK[code] != voice:
                # MBROLA lacked a diphone -> re-render with the native voice.
                fb = FALLBACK[code]
                warn2 = synth(text, fb, tmp_wav)
                used = fb
                if warn2:
                    warnings.append("%s/%s (%r) [native %s]: %s" % (code, wid, text, fb, warn2))
            elif warn:
                warnings.append("%s/%s (%r): %s" % (code, wid, text, warn))
            encode(tmp_wav, os.path.join(out_dir, wid + ".mp3"))
            ids.append(wid)
            print("  %s/%s.mp3  <-  %s  [%s]" % (code, wid, text, used))
        manifest[code] = ids

    if os.path.exists(tmp_wav):
        os.remove(tmp_wav)

    with open(os.path.join(AUDIO, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=0)
        f.write("\n")

    total = sum(len(v) for v in manifest.values())
    print("\nGenerated %d clips across %d languages -> %s" %
          (total, len(manifest), AUDIO))
    if warnings:
        print("\nMBROLA diphone warnings (audible gaps possible — review these):",
              file=sys.stderr)
        for w in warnings:
            print("  " + w, file=sys.stderr)


if __name__ == "__main__":
    main()
