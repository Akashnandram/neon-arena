# Neon Arena – top-down wave shooter

Survive waves of enemies in a neon arena. Grab weapon drops, choose an upgrade after every wave,
and beat a boss every 5th wave. Works on desktop (mouse + keyboard) and phones (twin touch sticks).

Plain HTML/CSS/JS on a canvas – no build step, no libraries, no backend. Sounds are synthesised with Web Audio.

## Controls

| Desktop | Phone |
|---|---|
| WASD / arrows – move | Left thumb – move |
| Mouse – aim, click/hold – shoot | Right thumb – aim & shoot |
| Space / Shift – dash | 💨 button – dash |
| P / Esc – pause | ⏸ button – pause |

## Run locally

```bash
python3 -m http.server 5174
```

Then open http://localhost:5174

## Deploy

Push to a GitHub repo and import it in Vercel (no settings needed), or run `npx vercel --prod`.

## Tuning

All balance numbers live at the top of `game.js`:

- `WEAPONS` – fire rate, damage, spread, ammo per weapon
- `ENEMIES` – HP, speed, contact damage, score per enemy type
- `UPGRADES` – the between-wave upgrade cards
- `startWave()` / `pickEnemyType()` – wave size and which enemies appear when
