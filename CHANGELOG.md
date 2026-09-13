# Changelog

## v3.1 — 2026-09-13 — first public release (this repository)

Same logic as v3 running on Haku, made safe and readable for other boats:

- **No home port declared → light OFF** (v2/v3 fell back on Haku's own port, Termini Imerese, which is wrong for any other boat). The decision node shows a red status until you click *"Set home port HERE"*.
- **"Set home port MANUALLY"** inject added (edit lat / lon / radius) in addition to the one-click capture.
- **Relay re-asserted every 5 min** (a manual toggle from the Remote Console or a test inject is corrected automatically).
- **TEST relay ON / OFF** injects added.
- **Last-position file written only when the boat has moved > 0.05 NM or every 10 min** (v3 wrote it every 60 s → flash wear).
- English node names, comments and status texts; neutral file names (`anchorlight_homeport.json`, `anchorlight_lastpos.json`).
- Function nodes published as readable JavaScript in `src/`, 18 unit tests in `tools/test_flow.js`, guide rewritten (EN + FR), wiring and logic diagrams.
- Relay node exported in the current node-red-contrib-victron format (service `com.victronenergy.system/0`, `pathObj` type `enum`) and the Victron client config node included with its fixed id `victron-client-id`, so the flow works right after import. Verified end-to-end in Node-RED 5.0.7 + node-red-contrib-victron 1.7.27 with a mock Signal K server (decision, files, start-up restore, relay command) — the D-Bus write itself can only be checked on a real GX device.

> Upgrading from v2/v3 on your own boat: delete the old tab, import v3.1, configure the relay node, click *"Set home port HERE"* once (the file names changed).

## v3 — 2026-08-26 (Haku, not published)

- Position and speed from **Signal K** (`http://127.0.0.1:3000/signalk/v1/api/vessels/self`) instead of three Victron GPS nodes — nothing to configure for the GPS.
- Poll every **60 s** (v2: 30 min).
- **Light ON 30 min before sunset** (v2: at sunset).
- Default home-port radius **3 NM** (v2: 2 NM).
- Persistence files moved to the Node-RED user directory `/data/home/nodered/.node-red/`.

## v2 — 2026-08-14 (posted on the Amel owners' forum as *Anchor_Light_Auto_Cerbo_Amel_GuideEN.pdf*)

- Speed condition (SOG < 1 kn) and last-known-position fallback added.
- Victron GPS nodes (latitude, longitude, speed) + relay node; check every 30 min; files in `/data/`.

## v1 — 2026-08-13

- Night + away from home port, check every 15 min.
