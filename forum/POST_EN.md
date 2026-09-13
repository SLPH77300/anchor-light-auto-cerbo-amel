# Forum post — Automatic anchor light with the Cerbo GX: updated guide + files on GitHub

**Automatic anchor (mooring) light using the Victron Cerbo GX — no extra hardware — v3.1, updated guide and files**

A few weeks ago I shared the recipe I use on "Haku" (Amel 50) to switch the anchor light on and off automatically with the Cerbo GX. The PDF posted then (v2) is now outdated: everything — the Node-RED flow, the guide in English and French and the wiring diagram — is on GitHub and will stay up to date there:

**https://github.com/SLPH77300/anchor-light-auto-cerbo-amel**

**What it does**
- Light **ON 30 min before sunset, OFF at sunrise — only when the boat is really at anchor**: away from your home port (> 3 NM, adjustable) and stationary (< 1 kn). Never under way, never in the marina.
- Runs entirely on the **Cerbo GX** with **Venus OS Large** (built-in Node-RED): no Raspberry Pi, no cloud, no subscription. Position and speed come from **Signal K** on the Cerbo — nothing to configure for the GPS.
- The **original manual switch keeps priority** (wired in parallel), and the relay uses its NO contact: Cerbo off = light off, switch still works.

**What changed since the PDF (v2)**
- Home-port declaration reworked: **one click at your berth** (or type the coordinates); **no home port declared = light stays OFF** — safe default for a boat left alone.
- GPS through Signal K (the three "GPS nodes to configure" are gone), light on 30 min before sunset, check every minute, relay state re-asserted every 5 min, test buttons, English node names.

**Wiring in one line**: Cerbo Relay 1 in parallel with the existing switch — `COM` ← permanent +24 V through a 5 A in-line fuse, `NO` → the wire from the switch to the light, negative untouched. On the Amel 50 that is circuit 0702 (breaker DJ2). Diagram and step-by-step in the guide.

**Setup in short**: Venus OS Large → enable Node-RED + Signal K → Relay 1 = Manual → import the flow file → select the relay in one node → click "Set home port HERE". Done.

Files: flow to import (`flow/anchor-light-auto-cerbo_v3.1.json`), guide EN/FR (Markdown + PDF), wiring diagram, and the function code readable in `src/` with unit tests. MIT licence — improve it, fork it, tell me what you changed. Fair winds! ⚓
