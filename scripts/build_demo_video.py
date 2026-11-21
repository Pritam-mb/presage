import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRAMES_DIR = os.path.join(ROOT, 'artifacts', 'demo_frames')
OUT_DIR = os.path.join(ROOT, 'artifacts')
os.makedirs(OUT_DIR, exist_ok=True)

# Find ffmpeg binary
ffmpeg_candidates = [
    os.path.join(ROOT, '.venv', 'Lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v9.0.2.exe'),
    'ffmpeg'
]
FFMPEG = None
for c in ffmpeg_candidates:
    if os.path.exists(c):
        FFMPEG = c
        break
if not FFMPEG:
    FFMPEG = 'ffmpeg'

# Fonts
FONT_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
FONT_REG = 'C:/Windows/Fonts/segoeui.ttf'
FONT_MONO = 'C:/Windows/Fonts/consola.ttf'

font_title = ImageFont.truetype(FONT_BOLD, 42)
font_subtitle = ImageFont.truetype(FONT_REG, 26)
font_badge = ImageFont.truetype(FONT_BOLD, 18)
font_scene_no = ImageFont.truetype(FONT_BOLD, 16)
font_body = ImageFont.truetype(FONT_REG, 22)
font_mono = ImageFont.truetype(FONT_MONO, 20)

SCENES = [
    {
        "id": 1,
        "duration": 14,
        "title": "INTRODUCTION: SPOOFLAB",
        "tag": "PRESAGE SMARTSPECTRA SDK CHALLENGE",
        "bg_type": "title_card",
        "headline": "SpoofLab — Break the Assumptions, Not the Sensor",
        "summary": "Testing application trust boundaries for camera-derived physiological signals.\nA pulse is a signal. What does it actually prove?",
        "subtitle": "SpoofLab is an experimental laboratory investigating trust assumptions in camera-derived rPPG physiology. Can pulse signals alone prove live presence?",
        "start": "00:00:00,000",
        "end": "00:00:14,000"
    },
    {
        "id": 2,
        "duration": 16,
        "title": "CAPTURE LABORATORY & CAMERA CALIBRATION",
        "tag": "01 / CAPTURE LABORATORY",
        "bg_type": "image",
        "image_file": "scene_01_capture_overview.png",
        "subtitle": "In Capture Lab, we configure trial parameters and verify camera frame rate. Our USB webcam delivers a stable 27.4 FPS, exceeding the 25 FPS requirement.",
        "start": "00:00:14,000",
        "end": "00:00:30,000"
    },
    {
        "id": 3,
        "duration": 16,
        "title": "LIVE PHYSIOLOGICAL SIGNAL MONITORING",
        "tag": "02 / RPPG VITALS TRACKING",
        "bg_type": "image",
        "image_file": "scene_01_capture_overview.png",
        "subtitle": "During live baseline trials, SmartSpectra tracks real-time pulse (74.2 BPM) and respiration (16.5 breaths/min). Warm-up samples are strictly excluded.",
        "start": "00:00:30,000",
        "end": "00:00:46,000"
    },
    {
        "id": 4,
        "duration": 18,
        "title": "THE REPLAY ATTACK: PULSE LEAKAGE",
        "tag": "03 / REPLAY VULNERABILITY",
        "bg_type": "replay_card",
        "headline": "Screen Replay Leaks Real Human Pulse Dynamics",
        "summary": "When high-resolution facial video is replayed on a smartphone or monitor,\nthe optical pulse frequency remains detectable by rPPG sensors. Naive policies accept this.",
        "subtitle": "The core vulnerability: recorded videos preserve optical skin color changes. Naive pulse policies accept screen replays because real pulse signals exist in the video.",
        "start": "00:00:46,000",
        "end": "00:01:04,000"
    },
    {
        "id": 5,
        "duration": 18,
        "title": "ACTIVE FRESHNESS CHALLENGE-RESPONSE",
        "tag": "04 / FRESHNESS DEFENSE",
        "bg_type": "image",
        "image_file": "scene_03_blink_challenge.png",
        "subtitle": "To defeat passive video replays, SpoofLab introduces interactive freshness challenges: random blink prompts. Replays cannot respond and are caught 100% of the time.",
        "start": "00:01:04,000",
        "end": "00:01:22,000"
    },
    {
        "id": 6,
        "duration": 18,
        "title": "TRUST BOUNDARIES & ZERO-KNOWLEDGE VERIFIER",
        "tag": "05 / TRUST BOUNDARIES",
        "bg_type": "image",
        "image_file": "scene_04_trust_boundaries.png",
        "subtitle": "Trust Boundaries enforce separation: the verifier receives only numerical measurements, completely blind to user labels, faces, or test conditions.",
        "start": "00:01:22,000",
        "end": "00:01:40,000"
    },
    {
        "id": 7,
        "duration": 20,
        "title": "EVIDENCE LEDGER: 33 CONSOLIDATED TRIALS",
        "tag": "06 / EVIDENCE REPORT",
        "bg_type": "image",
        "image_file": "scene_05_evidence_ledger.png",
        "subtitle": "The Evidence Report catalogs 33 trials across 4 conditions: 17 live, 10 screen replays, 3 photos, 3 injected replays. Inconclusive attempts are never dropped.",
        "start": "00:01:40,000",
        "end": "00:02:00,000"
    },
    {
        "id": 8,
        "duration": 22,
        "title": "MODEL LAB: LEAVE-ONE-GROUP-OUT LIMITS RESULT",
        "tag": "07 / MODEL LAB LIMITS",
        "bg_type": "image",
        "image_file": "scene_07_model_lab.png",
        "subtitle": "Model Lab reports a measured limits result: Leave-One-Group-Out LOOCV gives AUC 0.389 (95% CI 0.00-0.67), proving physiological summaries alone do not separate replay from live.",
        "start": "00:02:00,000",
        "end": "00:02:22,000"
    },
    {
        "id": 9,
        "duration": 18,
        "title": "POLICY ARENA: DECISION TRACES",
        "tag": "08 / POLICY ARENA",
        "bg_type": "image",
        "image_file": "scene_08_policy_arena.png",
        "subtitle": "Policy Arena executes frozen evaluation rules against attacker vectors. Naive pulse policies fail; multi-layered quality and challenge policies provide defense in depth.",
        "start": "00:02:22,000",
        "end": "00:02:40,000"
    },
    {
        "id": 10,
        "duration": 16,
        "title": "KEY TAKEAWAYS & OPEN SOURCE REPOSITORY",
        "tag": "09 / CONCLUSION",
        "bg_type": "conclusion_card",
        "headline": "Engineering Takeaways for rPPG Developers",
        "summary": "1. Treat rPPG as physiological measurement, not proof of live presence.\n2. Always pair with randomized active challenge-response.\n3. Open Source: https://github.com/Pritam-mb/presage",
        "subtitle": "Key takeaway: Break the assumptions, not the sensor. Transparent, reproducible, and open source at github.com/Pritam-mb/presage.",
        "start": "00:02:40,000",
        "end": "00:02:56,000"
    }
]

def render_scene_card(scene, output_path):
    W, H = 1920, 1080
    bg_type = scene["bg_type"]

    if bg_type == "image":
        img_path = os.path.join(FRAMES_DIR, scene["image_file"])
        if os.path.exists(img_path):
            img = Image.open(img_path).convert("RGBA")
            img = img.resize((W, H), Image.Resampling.LANCZOS)
        else:
            img = Image.new("RGBA", (W, H), (14, 21, 38, 255))
    else:
        # Custom thematic card
        img = Image.new("RGBA", (W, H), (11, 16, 32, 255))
        draw = ImageDraw.Draw(img)
        # Background gradient effect
        for y in range(H):
            ratio = y / H
            r = int(14 * (1 - ratio) + 20 * ratio)
            g = int(21 * (1 - ratio) + 28 * ratio)
            b = int(38 * (1 - ratio) + 60 * ratio)
            draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

        # Accent glows
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ol_draw = ImageDraw.Draw(overlay)
        ol_draw.ellipse([W//2 - 400, H//2 - 300, W//2 + 400, H//2 + 300], fill=(185, 164, 255, 30))
        img = Image.alpha_composite(img, overlay)
        draw = ImageDraw.Draw(img)

        # Center content box
        box_w, box_h = 1300, 480
        bx = (W - box_w) // 2
        by = (H - box_h) // 2 - 40
        draw.rounded_rectangle([bx, by, bx + box_w, by + box_h], radius=24, fill=(23, 33, 58, 240), outline=(58, 75, 110, 255), width=2)

        # Accent top bar on box
        draw.rounded_rectangle([bx, by, bx + box_w, by + 8], radius=4, fill=(185, 164, 255, 255))

        # Tag
        draw.text((bx + 60, by + 50), scene["tag"], font=font_badge, fill=(185, 164, 255, 255))
        # Headline
        draw.text((bx + 60, by + 90), scene.get("headline", ""), font=font_title, fill=(255, 255, 255, 255))

        # Summary text
        summary = scene.get("summary", "")
        sy = by + 180
        for line in summary.split("\n"):
            draw.text((bx + 60, sy), line, font=font_body, fill=(180, 195, 225, 255))
            sy += 42

    # Now overlay common HUD elements:
    # 1. Top HUD Bar (Scene Title & Progress)
    hud_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hud_draw = ImageDraw.Draw(hud_overlay)

    # Top banner background
    hud_draw.rounded_rectangle([40, 24, W - 40, 84], radius=16, fill=(13, 20, 36, 230), outline=(45, 58, 86, 255), width=1)
    # Badge
    hud_draw.rounded_rectangle([56, 36, 220, 72], radius=10, fill=(40, 32, 65, 255), outline=(138, 118, 232, 255), width=1)
    hud_draw.text((70, 44), f"SCENE {scene['id']:02d} / 10", font=font_scene_no, fill=(210, 195, 255, 255))
    # Title
    hud_draw.text((245, 43), scene["title"], font=font_badge, fill=(240, 244, 255, 255))
    # Right Tag
    hud_draw.text((W - 320, 44), scene["tag"], font=font_scene_no, fill=(140, 160, 200, 255))

    # 2. Bottom Subtitle Box
    sub_box_w = 1760
    sub_box_h = 110
    sub_x = (W - sub_box_w) // 2
    sub_y = H - sub_box_h - 30

    hud_draw.rounded_rectangle([sub_x, sub_y, sub_x + sub_box_w, sub_y + sub_box_h], radius=18, fill=(10, 16, 30, 240), outline=(60, 75, 110, 255), width=2)
    # Subtle accent line on left of subtitle box
    hud_draw.rounded_rectangle([sub_x, sub_y, sub_x + 8, sub_y + sub_box_h], radius=4, fill=(185, 164, 255, 255))

    # Subtitle text (wrapped)
    sub_text = scene["subtitle"]
    words = sub_text.split(" ")
    lines = []
    current_line = []
    for w in words:
        current_line.append(w)
        test_str = " ".join(current_line)
        bbox = font_subtitle.getbbox(test_str)
        if (bbox[2] - bbox[0]) > (sub_box_w - 60):
            current_line.pop()
            lines.append(" ".join(current_line))
            current_line = [w]
    if current_line:
        lines.append(" ".join(current_line))

    line_y = sub_y + (sub_box_h - len(lines) * 36) // 2
    for l in lines:
        hud_draw.text((sub_x + 35, line_y), l, font=font_subtitle, fill=(255, 255, 255, 255))
        line_y += 36

    final_img = Image.alpha_composite(img, hud_overlay).convert("RGB")
    final_img.save(output_path, "PNG")
    print(f"Rendered scene {scene['id']}: {output_path}")

def generate_subtitles_srt(scenes, srt_path):
    with open(srt_path, "w", encoding="utf-8") as f:
        for idx, s in enumerate(scenes, 1):
            f.write(f"{idx}\n")
            f.write(f"{s['start']} --> {s['end']}\n")
            f.write(f"{s['subtitle']}\n\n")
    print(f"Generated SRT: {srt_path}")

def generate_voiceover_script(scenes, md_path):
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# SpoofLab Demo Video — Spoken Voiceover Script\n\n")
        f.write("Use this script to record your voiceover over the generated `spooflab_demo.mp4` video.\n")
        f.write("The timestamps match the on-screen video subtitles exactly.\n\n---\n\n")
        for s in scenes:
            f.write(f"### Scene {s['id']:02d}: {s['title']} ({s['start'][:8]} - {s['end'][:8]})\n\n")
            f.write(f"> **Voiceover:** \"{s['subtitle']}\"\n\n")
            f.write(f"- **Visuals:** {s['tag']} (`{s['bg_type']}`)\n\n---\n\n")
    print(f"Generated Voiceover Script: {md_path}")

def compile_video_with_ffmpeg(scenes, srt_path, output_mp4):
    concat_txt_path = os.path.join(OUT_DIR, "concat_scenes.txt")
    with open(concat_txt_path, "w", encoding="utf-8") as f:
        for s in scenes:
            slide_png = os.path.join(OUT_DIR, f"slide_{s['id']:02d}.png").replace("\\", "/")
            f.write(f"file '{slide_png}'\n")
            f.write(f"duration {s['duration']}\n")
        # Add last file again as required by ffmpeg concat demuxer
        last_png = os.path.join(OUT_DIR, f"slide_{scenes[-1]['id']:02d}.png").replace("\\", "/")
        f.write(f"file '{last_png}'\n")

    print(f"Running ffmpeg compilation to {output_mp4}...")
    cmd = [
        FFMPEG,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt_path,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-movflags", "+faststart",
        output_mp4
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFmpeg error:", r.stderr)
        raise RuntimeError("FFmpeg encoding failed.")
    print("Video encoding finished successfully!")

def main():
    print("=== Rendering Scene Cards ===")
    for s in SCENES:
        out_png = os.path.join(OUT_DIR, f"slide_{s['id']:02d}.png")
        render_scene_card(s, out_png)

    srt_path = os.path.join(OUT_DIR, "spooflab_demo_subtitles.srt")
    generate_subtitles_srt(SCENES, srt_path)

    md_path = os.path.join(OUT_DIR, "VOICEOVER_SCRIPT.md")
    generate_voiceover_script(SCENES, md_path)

    out_mp4 = os.path.join(OUT_DIR, "spooflab_demo.mp4")
    compile_video_with_ffmpeg(SCENES, srt_path, out_mp4)

    file_size_mb = os.path.getsize(out_mp4) / (1024 * 1024)
    print(f"\n=======================================================")
    print(f"DEMO VIDEO GENERATED: {out_mp4} ({file_size_mb:.2f} MB)")
    print(f"SUBTITLES: {srt_path}")
    print(f"VOICEOVER SCRIPT: {md_path}")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
