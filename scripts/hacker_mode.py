#!/usr/bin/env python3
"""
HACKER MODE - Fast 2-tier upload (128kbps + 64kbps)
Matches GitHub Actions workflow exactly.

Usage:
    python3 scripts/hacker_mode.py --limit 1000 --offset 18000 --workers 5
"""

import os
import subprocess
import argparse
from pathlib import Path
import time
import sys
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

import boto3
from botocore.config import Config

sys.stdout.reconfigure(line_buffering=True)

# Config
SUPABASE_URL = "https://anmgyxhnyhbyxzpjhxgx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubWd5eGhueWhieXh6cGpoeGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzE3NDAsImV4cCI6MjA4MTU0Nzc0MH0.VKzfgrAbwvfs6WC1xhVbJ-mShmex3ycfib8jI57dyR4"

R2_ACCOUNT_ID = '2b9fcfd8cd9aedbde62ffdd714d66a3e'
R2_ACCESS_KEY = '82679709fb4e9f7e77f1b159991c9551'
R2_SECRET_KEY = '306f3d28d29500228a67c8cf70cebe03bba3c765fee173aacb26614276e7bb52'
R2_BUCKET = 'voyo-audio'

TEMP_DIR = Path("/tmp/voyo-hacker")

# Stats
lock = threading.Lock()
stats = {'success': 0, 'failed': 0, 'skipped': 0}

# Thread-local R2 client
thread_local = threading.local()

def get_r2():
    if not hasattr(thread_local, 'r2'):
        thread_local.r2 = boto3.client('s3',
            endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version='s3v4', retries={'max_attempts': 3}))
    return thread_local.r2

def get_tracks(limit, offset):
    url = f"{SUPABASE_URL}/rest/v1/video_intelligence?select=youtube_id&limit={limit}&offset={offset}"
    headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return [t['youtube_id'] for t in json.loads(resp.read().decode()) if t.get('youtube_id')]

def get_existing():
    existing = set()
    try:
        paginator = get_r2().get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix="128/"):
            for obj in page.get('Contents', []):
                key = obj['Key']
                if '/' in key:
                    fname = key.split('/')[-1]
                    if '.' in fname:
                        existing.add(fname.rsplit('.', 1)[0])
    except Exception as e:
        print(f"Warning listing R2: {e}")
    return existing

def process_track(yt_id, idx, total):
    try:
        output = TEMP_DIR / f"{yt_id}.opus"

        # Download
        cmd = ["yt-dlp", "-x", "--audio-format", "opus", "--audio-quality", "5",
               "-o", str(TEMP_DIR / f"{yt_id}.%(ext)s"),
               "--no-playlist", "--quiet", "--no-warnings",
               f"https://www.youtube.com/watch?v={yt_id}"]

        subprocess.run(cmd, capture_output=True, timeout=120)

        # Check for webm fallback
        if not output.exists():
            webm = TEMP_DIR / f"{yt_id}.webm"
            if webm.exists():
                webm.rename(output)

        if output.exists():
            # Upload to both tiers
            r2 = get_r2()
            r2.upload_file(str(output), R2_BUCKET, f"128/{yt_id}.opus")
            r2.upload_file(str(output), R2_BUCKET, f"64/{yt_id}.opus")
            output.unlink()

            with lock:
                stats['success'] += 1
            return f"[{idx}/{total}] {yt_id} ✓"
        else:
            with lock:
                stats['failed'] += 1
            return f"[{idx}/{total}] {yt_id} ✗"

    except Exception as e:
        with lock:
            stats['failed'] += 1
        return f"[{idx}/{total}] {yt_id} ✗ {str(e)[:30]}"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=1000)
    parser.add_argument('--offset', type=int, default=0)
    parser.add_argument('--workers', type=int, default=5)
    args = parser.parse_args()

    print("=" * 50)
    print(f"HACKER MODE - {args.workers} workers")
    print(f"Offset: {args.offset}, Limit: {args.limit}")
    print("=" * 50)

    TEMP_DIR.mkdir(exist_ok=True)

    # Get tracks
    print("\n1. Fetching tracks...")
    tracks = get_tracks(args.limit, args.offset)
    print(f"   Got {len(tracks)} tracks")

    # Get existing
    print("\n2. Checking R2...")
    existing = get_existing()
    print(f"   Found {len(existing)} existing")

    # Filter
    to_process = [t for t in tracks if t not in existing]
    print(f"   To process: {len(to_process)}")

    if not to_process:
        print("\n   Nothing to do!")
        return

    # Process
    print(f"\n3. Processing with {args.workers} workers...\n")
    start = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(process_track, t, i+1, len(to_process)): t
                   for i, t in enumerate(to_process)}
        for f in as_completed(futures):
            print(f.result(), flush=True)

    elapsed = time.time() - start
    rate = stats['success'] / elapsed * 60 if elapsed > 0 else 0

    print(f"\n{'=' * 50}")
    print(f"DONE in {elapsed/60:.1f} min ({rate:.1f} tracks/min)")
    print(f"✅ Success: {stats['success']}")
    print(f"❌ Failed: {stats['failed']}")
    print("=" * 50)

if __name__ == '__main__':
    main()
