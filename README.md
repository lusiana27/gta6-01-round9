# VELMAR BAY — Open-World Crime Game

[![make.fun](https://make.fun/api/competitions/gta6-01/badge.svg)](https://make.fun/c/gta6-01)
[![make.fun dev](https://make.fun/api/competitions/gta6-01/dev-badge.svg)](https://make.fun/c/gta6-01)
[![make.fun entries](https://make.fun/api/competitions/gta6-01/entries-badge.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty ($1,666, top 100 share the prize).
Built from scratch in plain JavaScript + Canvas — no libraries, no network requests, fully offline.

**The city:** Velmar Bay — a sun-soaked coastal city of 7 districts: Old Harbor, Neon Row,
Marlowe Heights, Cinder Flats, Palm Court, Dockside, and The Palisades.

**The story:** You are **Rae Calloway**, a getaway driver back in Velmar Bay after five years
away. Twelve missions take you from a stolen sedan to a city-wide war with the **Vex
syndicate** — car chases, heists, races, escapes, and one last job on the bay bridge.

## What's in the game

- **Open world on foot and by car** — steal any traffic car (E), drive with W/A/S/D
- **12 story missions** in sequence, each with objectives, win/fail states and cash rewards
- **Wanted system 0–5 stars** — police AI cars chase and ram you; at 5 stars the **Air One**
  helicopter joins and roadblocks go up; lose the cops to cool down
- **Traffic** — 30 AI cars on the road network, **50 pedestrians** on the sidewalks
- **Day/night cycle** — dawn, day, dusk and neon night, with headlights after dark
- **3 procedural radio stations** — VELMAR FM (synth), BAY 94 (funk bass), STATIC 88 (lo-fi)
- **Garage & shops** — repair, repaint and armour your car; buy weapons and ammo; save/load
- **Combat** — mouse aim, click to shoot, health + armour, police and gang shooters
- **Full HUD + minimap** — wanted stars, cash, health, mission tracker, speed, clock, district
- **Save/load** — progress, cash, garage cars and mission state persist in localStorage
- **Deterministic** — seeded RNG everywhere; the same seed replays the same world

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive (W accelerate, S brake/reverse) |
| E | Enter / exit nearest car |
| Space | Handbrake (in car) / sprint (on foot) |
| Mouse + click | Aim and shoot |
| R | Reload |
| Q | Switch radio station |
| G | Enter garage (near the garage marker) |
| B | Enter shop (near the shop marker) |
| M | Toggle map (large) |
| P / Esc | Pause |
| F5 | Quick save (in pause menu: Save) |

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open `game/index.html` in desktop Chrome. No build step, no network.

## Screenshots

`?shot=chase` (cover — 5-star chase), `?shot=night`, `?shot=race`, `?shot=street`
stage deterministic scenes of the real game for screenshots.

## License

MIT — see [LICENSE](LICENSE).
