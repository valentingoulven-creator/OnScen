#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
seed_onscen.py
Injecte 10 comptes bots + 3 salons + 2 lives + 10 events dans store.json
sur le serveur production OnScen (51.159.164.100).

Usage (depuis PowerShell ou cmd) :
    python seed_onscen.py
"""

import json
import os
import random
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta

# ─── Configuration ────────────────────────────────────────────────────────────
SSH_KEY  = os.path.expandvars(r"%USERPROFILE%\.ssh\id_ed25519")
SSH_HOST = "root@51.159.164.100"
STORE    = "/opt/onscen/data/store.json"
PM2_NAME = "onscen-backend"

# ─── SSH / SCP helpers ────────────────────────────────────────────────────────
SSH_BASE = [
    "ssh", "-i", SSH_KEY,
    "-o", "StrictHostKeyChecking=no",
    "-o", "BatchMode=yes",
    SSH_HOST,
]

def ssh_read(remote_cmd: str) -> str:
    r = subprocess.run(SSH_BASE + [remote_cmd], capture_output=True)
    if r.returncode != 0:
        print(f"[SSH ERROR] {r.stderr.decode('utf-8', errors='replace')}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.decode("utf-8")

def ssh_write(remote_cmd: str, stdin_bytes: bytes) -> str:
    r = subprocess.run(SSH_BASE + [remote_cmd], input=stdin_bytes, capture_output=True)
    if r.returncode != 0:
        print(f"[SSH ERROR] {r.stderr.decode('utf-8', errors='replace')}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.decode("utf-8")

# ─── Utilities ────────────────────────────────────────────────────────────────
def blur(coord: float) -> float:
    """Offset aléatoire ~±50 m (miroir de blurCoordinate côté serveur)."""
    return coord + (random.random() - 0.5) * 2 * 0.00045

def now_ms() -> int:
    return int(time.time() * 1000)

def rand_created_ms(min_days: int = 90, max_days: int = 1) -> int:
    days = random.uniform(max_days, min_days)
    return now_ms() - int(days * 24 * 3600 * 1000)

def event_date_iso(days_from_now: int, hour: int = 20) -> str:
    d = (datetime.now(timezone.utc) + timedelta(days=days_from_now)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return d.isoformat().replace("+00:00", "Z")

# ─── Données bots ─────────────────────────────────────────────────────────────
#  activity: None | "salon" | "live"
BOTS = [
    dict(
        id="bot_djmaxime", username="DJ_Maxime", city="Paris",
        lat=48.8566, lng=2.3522, role="host",
        genres=["Électro", "House", "Funk"], activity="salon",
        salon_title="Salon Électro — Paris",
        track="Midnight City", artist="M83", platform="youtube",
        track_id="XqZSoPa59tY",
        album_art="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400",
    ),
    dict(
        id="bot_laurabeats", username="LauraBeats", city="Lyon",
        lat=45.7640, lng=4.8357, role="les_deux",
        genres=["Pop", "Soul", "Indie"], activity="live",
        live_title="Live Pop — Lyon",
        track="Anti-Hero", artist="Taylor Swift", platform="youtube",
        track_id="b1kbLwvqugk",
        album_art="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
    ),
    dict(
        id="bot_rapperkev", username="RapperKev", city="Marseille",
        lat=43.2965, lng=5.3698, role="les_deux",
        genres=["Rap", "Hip-Hop", "Funk"], activity=None,
    ),
    dict(
        id="bot_electraflo", username="ElectraFlo", city="Bordeaux",
        lat=44.8378, lng=-0.5792, role="host",
        genres=["Électro", "Pop"], activity=None,
    ),
    dict(
        id="bot_jazzmarie", username="JazzMarie", city="Toulouse",
        lat=43.6047, lng=1.4442, role="les_deux",
        genres=["Jazz", "Soul", "Pop"], activity="salon",
        salon_title="Jazz Lounge — Toulouse",
        track="So What", artist="Miles Davis", platform="youtube",
        track_id="PDW1H2yqYAw",
        album_art="https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=400",
    ),
    dict(
        id="bot_soulbruno", username="SoulBruno", city="Lille",
        lat=50.6292, lng=3.0573, role="les_deux",
        genres=["Soul", "Funk", "Jazz"], activity=None,
    ),
    dict(
        id="bot_beatsam", username="BeatMaker_Sam", city="Nantes",
        lat=47.2184, lng=-1.5536, role="les_deux",
        genres=["Hip-Hop", "Rap", "Électro"], activity="live",
        live_title="Live Hip-Hop — Nantes",
        track="DNA.", artist="Kendrick Lamar", platform="youtube",
        track_id="NLUstH9jJWs",
        album_art="https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=400",
    ),
    dict(
        id="bot_trapqueen", username="TrapQueen", city="Strasbourg",
        lat=48.5734, lng=7.7521, role="les_deux",
        genres=["Rap", "Hip-Hop"], activity=None,
    ),
    dict(
        id="bot_indietom", username="IndieRock_Tom", city="Rennes",
        lat=48.1173, lng=-1.6778, role="host",
        genres=["Indie", "Pop", "Soul"], activity="salon",
        salon_title="Indie Session — Rennes",
        track="Mr. Brightside", artist="The Killers", platform="youtube",
        track_id="gGdGFtwCNBE",
        album_art="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400",
    ),
    dict(
        id="bot_funkmaster", username="FunkMaster", city="Nice",
        lat=43.7102, lng=7.2620, role="host",
        genres=["Funk", "Soul", "Pop"], activity=None,
    ),
]

# Aujourd'hui = 9 juin 2026 → dates relatives
EVENTS = [
    dict(id="evt_festival_jazz_paris",    title="Festival Jazz",   city="Paris",
         lat=48.8588, lng=2.3478, days=2,  type="festival", attendees=200,
         author="bot_jazzmarie"),
    dict(id="evt_soiree_dj_lyon",         title="Soirée DJ",      city="Lyon",
         lat=45.7612, lng=4.8402, days=5,  type="concert",  attendees=80,
         author="bot_laurabeats"),
    dict(id="evt_concert_rap_marseille",  title="Concert Rap",    city="Marseille",
         lat=43.2998, lng=5.3811, days=1,  type="concert",  attendees=150,
         author="bot_rapperkev"),
    dict(id="evt_nuit_electro_bordeaux",  title="Nuit Électro",   city="Bordeaux",
         lat=44.8415, lng=-0.5724, days=7, type="club",     attendees=200,
         author="bot_electraflo"),
    dict(id="evt_open_mic_toulouse",      title="Open Mic",       city="Toulouse",
         lat=43.6022, lng=1.4481, days=3,  type="bar",      attendees=40,
         author="bot_jazzmarie"),
    dict(id="evt_concert_soul_lille",     title="Concert Soul",   city="Lille",
         lat=50.6322, lng=3.0618, days=10, type="concert",  attendees=100,
         author="bot_soulbruno"),
    dict(id="evt_festival_indie_nantes",  title="Festival Indie", city="Nantes",
         lat=47.2205, lng=-1.5491, days=14,type="festival", attendees=300,
         author="bot_beatsam"),
    dict(id="evt_battle_rap_strasbourg",  title="Battle Rap",     city="Strasbourg",
         lat=48.5763, lng=7.7558, days=4,  type="concert",  attendees=120,
         author="bot_trapqueen"),
    dict(id="evt_soiree_funk_rennes",     title="Soirée Funk",    city="Rennes",
         lat=48.1152, lng=-1.6801, days=6, type="bar",      attendees=60,
         author="bot_indietom"),
    dict(id="evt_concert_jazz_nice",      title="Concert Jazz",   city="Nice",
         lat=43.7128, lng=7.2588, days=21, type="concert",  attendees=180,
         author="bot_funkmaster"),
]

# ─── Constructeurs d'objets ───────────────────────────────────────────────────
def make_playback(b: dict) -> dict:
    ts = now_ms()
    progress = random.randint(15_000, 180_000)
    return {
        "platform":    b["platform"],
        "trackId":     b["track_id"],
        "title":       b["track"],
        "artist":      b["artist"],
        "albumArtUrl": b["album_art"],
        "isPlaying":   True,
        "progressMs":  progress,
        "updatedAt":   ts,
        "startedAt":   ts - progress,
    }

def make_user(b: dict) -> dict:
    return {
        "id":                b["id"],
        "username":          b["username"],
        "email":             f"{b['id']}@bot.soundy.local",
        "passwordHash":      "bot",
        "avatarUrl":         None,
        "meloCoins":         0,
        "isGhostMode":       False,
        "favoriteGenres":    b["genres"],
        "city":              b["city"],
        "listeningRole":     b["role"],
        "latitude":          b["lat"],
        "longitude":         b["lng"],
        "blurredLatitude":   blur(b["lat"]),
        "blurredLongitude":  blur(b["lng"]),
        "memberSince":       rand_created_ms(90, 1),
        "lastSeenAt":        now_ms(),
    }

def make_salon(b: dict) -> tuple:
    salon_id = f"salon_{b['id']}"
    pb = make_playback(b)
    return salon_id, {
        "id":               salon_id,
        "hostId":           b["id"],
        "hostName":         b["username"],
        "hostAvatarUrl":    None,
        "title":            b["salon_title"],
        "platform":         b["platform"],
        "playbackState":    pb,
        "latitude":         b["lat"],
        "longitude":        b["lng"],
        "blurredLatitude":  blur(b["lat"]),
        "blurredLongitude": blur(b["lng"]),
        "listenersCount":   random.randint(3, 18),
        "isGhostMode":      False,
        "isPublic":         True,
        "accessMode":       "public",
        "allowedUserIds":   [b["id"]],
        "allowQueue":       True,
        "createdAt":        now_ms(),
    }

def make_live(b: dict) -> tuple:
    live_id = f"live_{b['id']}"
    pb = make_playback(b)
    return live_id, {
        "id":               live_id,
        "hostId":           b["id"],
        "hostName":         b["username"],
        "title":            b["live_title"],
        "platform":         b["platform"],
        "playbackState":    pb,
        "latitude":         b["lat"],
        "longitude":        b["lng"],
        "blurredLatitude":  blur(b["lat"]),
        "blurredLongitude": blur(b["lng"]),
        "viewersCount":     random.randint(5, 30),
        "isActive":         True,
        "startedAt":        now_ms() - random.randint(300_000, 1_800_000),
    }

def make_event(e: dict) -> dict:
    return {
        "id":                e["id"],
        "title":             e["title"],
        "city":              e["city"],
        "authorId":          e["author"],
        "latitude":          e["lat"],
        "longitude":         e["lng"],
        "date":              event_date_iso(e["days"]),
        "status":            "published",
        "type":              e["type"],
        "expectedAttendees": e["attendees"],
        "createdAt":         now_ms(),
    }

# ─── Fusion dans store ────────────────────────────────────────────────────────
def upsert(store: dict, key: str, item_id: str, item: dict):
    """Insère/remplace dans store[key] — supporte dict ET list."""
    collection = store.setdefault(key, {})
    if isinstance(collection, dict):
        collection[item_id] = item
    elif isinstance(collection, list):
        store[key] = [x for x in collection if x.get("id") != item_id]
        store[key].append(item)

def upsert_list(store: dict, key: str, item: dict):
    """Insère/remplace dans une collection toujours stockée en liste."""
    lst = store.setdefault(key, [])
    store[key] = [x for x in lst if x.get("id") != item["id"]]
    store[key].append(item)

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  OnScen Production Seeder")
    print("=" * 60)

    # 1. Lire store.json
    print(f"\n📡  Lecture de {STORE} …")
    raw = ssh_read(f"cat {STORE}")
    store: dict = json.loads(raw)
    keys = list(store.keys())
    print(f"✅  store.json lu  ({len(raw):,} bytes)  —  clés : {keys}")

    created_users   = []
    created_salons  = []
    created_lives   = []
    created_events  = []

    # 2. Bots
    print("\n👤  Injection des bots …")
    for b in BOTS:
        user = make_user(b)
        upsert(store, "users", b["id"], user)
        label = f"{b['username']} ({b['city']})"

        if b.get("activity") == "salon":
            salon_id, salon = make_salon(b)
            upsert(store, "salons", salon_id, salon)
            store.setdefault("salonChats",     {})[salon_id] = []
            store.setdefault("salonQueues",    {})[salon_id] = []
            store.setdefault("salonProposals", {})[salon_id] = []
            created_salons.append(salon_id)
            label += " [salon actif]"

        elif b.get("activity") == "live":
            live_id, live = make_live(b)
            upsert(store, "lives", live_id, live)
            store.setdefault("liveChats", {})[live_id] = []
            created_lives.append(live_id)
            label += " [live actif]"

        created_users.append(label)
        print(f"   ✓ {label}")

    # 3. Events
    print("\n📅  Injection des événements …")
    for e in EVENTS:
        event = make_event(e)
        upsert_list(store, "events", event)
        label = f"{e['title']} — {e['city']} ({event_date_iso(e['days'])[:10]})"
        created_events.append(label)
        print(f"   ✓ {label}")

    # 4. Écrire store.json
    new_json = json.dumps(store, ensure_ascii=False, indent=2)
    print(f"\n📝  Écriture store.json ({len(new_json):,} bytes) …")

    # Backup + remplacement atomique via stdin
    ssh_read(f"cp {STORE} {STORE}.bak.$(date +%Y%m%d_%H%M%S)")
    ssh_write(f"cat > /tmp/store_seed_new.json", new_json.encode("utf-8"))
    ssh_read(f"mv /tmp/store_seed_new.json {STORE}")
    print("✅  store.json mis à jour  (backup .bak.*  conservé)")

    # 5. Redémarrage pm2
    print(f"\n🔄  Redémarrage pm2 ({PM2_NAME}) …")
    pm2_out = ssh_read(f"pm2 restart {PM2_NAME} && sleep 2 && pm2 list")
    print(pm2_out)

    # 6. Résumé
    print("\n" + "=" * 60)
    print("  🎉  Seeding terminé avec succès !")
    print("=" * 60)

    print(f"\n👤  {len(created_users)} bots créés :")
    for u in created_users:
        print(f"   • {u}")

    print(f"\n📅  {len(created_events)} événements créés :")
    for ev in created_events:
        print(f"   • {ev}")

    if created_salons:
        print(f"\n🎵  Salons actifs  : {', '.join(created_salons)}")
    if created_lives:
        print(f"🔴  Lives actifs   : {', '.join(created_lives)}")


if __name__ == "__main__":
    main()
