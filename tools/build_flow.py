#!/usr/bin/env python3
"""Assembles flow/anchor-light-auto-cerbo_v3.1.json from the function sources in src/.

Run from the repository root:  python3 tools/build_flow.py
(The JSON in flow/ is the file to import in Node-RED; src/ only exists so the
logic can be read and unit-tested comfortably.)
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "flow" / "anchor-light-auto-cerbo_v3.1.json"
DATA = "/data/home/nodered/.node-red/"          # writable + persistent on Venus OS (Node-RED user directory)
TAB = "al_tab"

def fn(path):
    return (SRC / path).read_text(encoding="utf-8")

README = """AUTOMATIC ANCHOR LIGHT - Victron Cerbo GX (Venus OS Large) - v3.1

LOGIC : the light is ON only if  (night) AND (away from home port) AND (stationary).
  night      : from 30 min BEFORE sunset until sunrise (computed on board, no internet)
  away       : more than the home-port radius (default 3 NM) from the declared home port
  stationary : speed over ground < 1 kn
No home port declared -> the light stays OFF (safe default).

DATA SOURCE : Signal K on the Cerbo itself (http://127.0.0.1:3000) -> nothing to configure
              in the GPS nodes; position and SOG must be visible in Signal K's Data Browser.
RELAY       : com.victronenergy.system /Relay/0/State = Cerbo terminal "Relay 1" (1 = ON).
              The relay function must be set to "Manual" in the Cerbo settings.

SETUP (once) :
  1. Deploy.  2. Open the "Cerbo Relay 1" node: service "Venus device" / path
  "Venus relay 1 state" should be selected (re-select them if not), Deploy again.
  3. While berthed at your home port, click "Set home port HERE".
     (or edit and click "Set home port MANUALLY").

FILES (survive reboots and firmware updates) :
  """ + DATA + """anchorlight_homeport.json
  """ + DATA + """anchorlight_lastpos.json

The relay state is re-asserted every 5 min : a manual change from the Remote Console
is overridden within 5 min. To force the light, use the physical switch on the panel.

COLREG rule 30 : a vessel at anchor shows an all-round white light from sunset to sunrise.
This automation is an aid; the manual switch always has priority.
Built on "Haku", Amel 50 - https://github.com/SLPH77300/anchor-light-auto-cerbo-amel
"""

nodes = [
    {"id": TAB, "type": "tab", "label": "Anchor light auto v3.1", "disabled": False, "info": ""},
    # the Victron palette looks this config node up by its FIXED id "victron-client-id" (auto-created when a Victron node is dragged in)
    {"id": "victron-client-id", "type": "victron-client", "name": "", "showValues": True, "contextStore": True, "enablePolling": False},
    {"id": "al_readme", "type": "comment", "z": TAB, "name": "READ ME / SETUP", "info": README, "x": 130, "y": 40, "wires": []},

    # --- main loop ---------------------------------------------------------
    {"id": "al_poll", "type": "inject", "z": TAB, "name": "Poll Signal K every 60 s",
     "props": [{"p": "payload"}], "repeat": "60", "crontab": "", "once": True, "onceDelay": "5",
     "topic": "", "payload": "", "payloadType": "date", "x": 170, "y": 120, "wires": [["al_http"]]},
    {"id": "al_http", "type": "http request", "z": TAB, "name": "GET Signal K vessels/self", "method": "GET", "ret": "obj",
     "paytoqs": "ignore", "url": "http://127.0.0.1:3000/signalk/v1/api/vessels/self", "tls": "", "persist": False,
     "proxy": "", "insecureHTTPParser": False, "authType": "", "senderr": False, "headers": [],
     "x": 430, "y": 120, "wires": [["al_decide"]]},
    {"id": "al_decide", "type": "function", "z": TAB, "name": "Decision (night + away from port + stationary)",
     "func": fn("decision.js"), "outputs": 2, "noerr": 0, "initialize": "", "finalize": "", "libs": [],
     "x": 760, "y": 120, "wires": [["al_relay"], ["al_wlast"]]},
    # same structure as the official node-red-contrib-victron examples (service "…/0", serviceObj, pathObj with type "enum")
    {"id": "al_relay", "type": "victron-output-relay", "z": TAB, "client": "victron-client-id",
     "service": "com.victronenergy.system/0", "path": "/Relay/0/State",
     "serviceObj": {"service": "com.victronenergy.system/0", "name": "Venus device"},
     "pathObj": {"path": "/Relay/0/State", "type": "enum", "name": "Venus relay 1 state", "enum": {"0": "Open", "1": "Closed"}},
     "initial": "", "onlyChanges": False, "name": "Cerbo Relay 1 (anchor light)", "x": 1110, "y": 100, "wires": []},
    {"id": "al_wlast", "type": "file", "z": TAB, "name": "write last position",
     "filename": DATA + "anchorlight_lastpos.json", "filenameType": "str", "appendNewline": False,
     "createDir": True, "overwriteFile": "true", "encoding": "utf8", "x": 1090, "y": 160, "wires": [[]]},

    # --- home port ---------------------------------------------------------
    {"id": "al_inj_here", "type": "inject", "z": TAB, "name": "Set home port HERE (click while at your berth)",
     "props": [{"p": "payload"}], "repeat": "", "crontab": "", "once": False, "onceDelay": 0.1,
     "topic": "", "payload": "", "payloadType": "date", "x": 230, "y": 260, "wires": [["al_capture"]]},
    {"id": "al_inj_manual", "type": "inject", "z": TAB, "name": "Set home port MANUALLY (edit lat / lon / radius NM)",
     "props": [{"p": "payload"}], "repeat": "", "crontab": "", "once": False, "onceDelay": 0.1,
     "topic": "", "payload": "{\"lat\":0,\"lon\":0,\"radius\":3}", "payloadType": "json", "x": 240, "y": 310, "wires": [["al_capture"]]},
    {"id": "al_capture", "type": "function", "z": TAB, "name": "Set home port", "func": fn("capture_homeport.js"),
     "outputs": 1, "noerr": 0, "initialize": "", "finalize": "", "libs": [], "x": 560, "y": 285, "wires": [["al_wport"]]},
    {"id": "al_wport", "type": "file", "z": TAB, "name": "write home port",
     "filename": DATA + "anchorlight_homeport.json", "filenameType": "str", "appendNewline": False,
     "createDir": True, "overwriteFile": "true", "encoding": "utf8", "x": 790, "y": 285, "wires": [[]]},

    # --- start-up ----------------------------------------------------------
    {"id": "al_start", "type": "inject", "z": TAB, "name": "At start-up",
     "props": [{"p": "payload"}], "repeat": "", "crontab": "", "once": True, "onceDelay": "2",
     "topic": "", "payload": "", "payloadType": "date", "x": 150, "y": 420, "wires": [["al_rport", "al_rlast"]]},
    {"id": "al_rport", "type": "file in", "z": TAB, "name": "read home port",
     "filename": DATA + "anchorlight_homeport.json", "filenameType": "str", "format": "utf8", "chunk": False,
     "sendError": False, "encoding": "none", "allProps": False, "x": 380, "y": 400, "wires": [["al_lport"]]},
    {"id": "al_lport", "type": "function", "z": TAB, "name": "Load home port", "func": fn("load_homeport.js"),
     "outputs": 1, "noerr": 0, "initialize": "", "finalize": "", "libs": [], "x": 600, "y": 400, "wires": [[]]},
    {"id": "al_rlast", "type": "file in", "z": TAB, "name": "read last position",
     "filename": DATA + "anchorlight_lastpos.json", "filenameType": "str", "format": "utf8", "chunk": False,
     "sendError": False, "encoding": "none", "allProps": False, "x": 390, "y": 450, "wires": [["al_llast"]]},
    {"id": "al_llast", "type": "function", "z": TAB, "name": "Load last position", "func": fn("load_lastpos.js"),
     "outputs": 1, "noerr": 0, "initialize": "", "finalize": "", "libs": [], "x": 610, "y": 450, "wires": [[]]},

    # --- tests -------------------------------------------------------------
    {"id": "al_test_on", "type": "inject", "z": TAB, "name": "TEST relay ON (auto-corrected within 5 min)",
     "props": [{"p": "payload"}], "repeat": "", "crontab": "", "once": False, "onceDelay": 0.1,
     "topic": "", "payload": "1", "payloadType": "num", "x": 230, "y": 540, "wires": [["al_relay"]]},
    {"id": "al_test_off", "type": "inject", "z": TAB, "name": "TEST relay OFF",
     "props": [{"p": "payload"}], "repeat": "", "crontab": "", "once": False, "onceDelay": 0.1,
     "topic": "", "payload": "0", "payloadType": "num", "x": 150, "y": 590, "wires": [["al_relay"]]},
]

OUT.write_text(json.dumps(nodes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("written", OUT, len(nodes), "nodes")
