# Automatic anchor light with the Victron Cerbo GX (Amel 50/60 and any sailboat)

**Your anchor light switches itself ON 30 min before sunset and OFF at sunrise — only when the boat is really at anchor: away from your home port and not moving.** The original manual switch keeps working exactly as before. No extra hardware, no cloud: a small Node-RED flow running on the Cerbo GX (Venus OS Large) drives the Cerbo's Relay 1.

Built and used on **"Haku", Amel 50 #31**, shared for the Amel owners' community. Cost: a fuse, a fuse holder and 40 cm of wire.

| | |
|---|---|
| 📘 **Full guide (EN)** | [docs/GUIDE_EN.md](docs/GUIDE_EN.md) · [PDF](docs/Anchor_Light_Auto_Cerbo_Amel_Guide_v3.1_EN.pdf) |
| 📘 **Guide complet (FR)** | [docs/GUIDE_FR.md](docs/GUIDE_FR.md) · [PDF](docs/Guide_Feu_Mouillage_Auto_Cerbo_Amel_v3.1_FR.pdf) |
| ⬇️ **Flow to import in Node-RED** | [flow/anchor-light-auto-cerbo_v3.1.json](flow/anchor-light-auto-cerbo_v3.1.json) (right-click → *Save link as…*) |
| 🔌 **Wiring diagram** | [EN](docs/wiring_en.png) · [FR](docs/wiring_fr.png) |
| 📝 **Changes** | [CHANGELOG.md](CHANGELOG.md) |

![Wiring](docs/wiring_en.png)

## How it decides

The light is ON only when **all three** are true — checked every 60 s, relay written only on change:

1. **Night** — sun below the horizon, from 30 min before sunset to sunrise (astronomical calculation on board, no internet).
2. **Away from home port** — more than 3 NM (adjustable) from the berth you declared with one click.
3. **Stationary** — speed over ground below 1 kn (so it never shows while sailing).

No home port declared → the light stays OFF. Relay on the NO contact → Cerbo off or flow stopped → light OFF, manual switch still works.

![Logic](docs/logic_en.png)

## Quick start (details in the guide)

1. **Wire** Cerbo Relay 1 in parallel with the anchor-light switch: `COM` ← permanent +24 V through a **5 A in-line fuse** (≤ 18 cm from the tap), `NO` → the wire from the switch to the light, `NC` unused, negative untouched.
2. On the Cerbo: **Venus OS Large**, enable **Node-RED** and **Signal K**, set **Relay 1 → Manual**, check that `navigation.position` and `navigation.speedOverGround` are live in Signal K's *Data Browser* (`http://venus.local:3000`).
3. In Node-RED (`http://venus.local:1880`): **Import** the flow file, **Deploy**, open the *"Cerbo Relay 1"* node and check service *Venus device* / path *Venus relay 1 state* (`/Relay/0/State`), **Deploy** again.
4. At your berth, click **"Set home port HERE"**. That's it.

## Requirements

Victron Cerbo GX (or another GX device with a relay) on **Venus OS Large** · a GPS the Cerbo sees (NMEA 2000 or Victron) · an LED anchor light on a switched circuit. The relay is a dry contact rated 6 A / 30 VDC.

## Repository layout

```
flow/   anchor-light-auto-cerbo_v3.1.json   ← the file to import in Node-RED
src/    decision.js, capture_homeport.js, load_homeport.js, load_lastpos.js   ← the function nodes, readable
docs/   GUIDE_EN.md, GUIDE_FR.md, PDFs, wiring_*.png/svg, logic_*.png/svg
tools/  build_flow.py (assembles the flow from src/), test_flow.js (18 unit tests, `node tools/test_flow.js`)
forum/  POST_EN.md   ← the announcement text for the owners' forum
```

## Safety & legal

COLREG rule 30: a vessel at anchor shows an all-round white light from sunset to sunrise. This automation is an **aid**: the manual switch always has priority and you remain responsible for your lights. Choose a home-port radius that does not cover anchorages where you actually stop (inside the radius the light stays off). Check local rules.

## Licence

MIT — do what you want with it, no warranty. If you improve it, a pull request or a message on the forum is welcome.
