// ============================================================================
//  Anchor light — DECISION node  (runs on every poll, i.e. every 60 s)
//  Input : msg.payload = JSON of  http://127.0.0.1:3000/signalk/v1/api/vessels/self
//  Output 1 : {payload: 1|0}  -> Victron relay node  (only on change, re-asserted every 5 polls)
//  Output 2 : {payload: "{lat,lon}"} -> file node (last known position, throttled)
//
//  The light is ON only when ALL THREE conditions are true:
//    NIGHT       sun below the horizon, from 30 min BEFORE sunset until sunrise
//    AWAY        more than RADIUS (default 3 NM) from the declared home port
//    STATIONARY  speed over ground below SPEED_MAX_KN (default 1 kn)
//  If no home port has been declared, the light stays OFF (safe default).
// ============================================================================

// ---- tunables --------------------------------------------------------------
var SUN = -0.833;          // sun altitude (deg) taken as "night". -0.833 = official sunset/sunrise, -6 = civil twilight
var SPEED_MAX_KN = 1.0;    // above this SOG the boat is "under way" -> light never ON
var PRE_SUNSET_MIN = 30;   // switch ON this many minutes before sunset
var DEFAULT_RADIUS_NM = 3; // home-port radius when the declared port has no radius of its own
var REASSERT_EVERY = 5;    // re-send the relay state every N polls (5 polls = 5 min) -> auto-corrects manual changes
var PERSIST_MIN_NM = 0.05; // rewrite the last-position file only if moved more than this (≈ 90 m) ...
var PERSIST_MAX_MS = 600000; // ... or if the last write is older than this (10 min) -> limits flash wear

// ---- sun altitude (SunCalc-style, no dependency) ---------------------------
var rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
function toDays(d) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000; }
function sma(d) { return rad * (357.5291 + 0.98560028 * d); }
function ecl(M) { var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); return M + C + rad * 102.9372 + Math.PI; }
function dec(l) { return Math.asin(Math.sin(e) * Math.sin(l)); }
function ra(l) { return Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)); }
function sid(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
function sunAlt(dt, la, ln) {
    var lw = rad * -ln, phi = rad * la, d = toDays(dt), M = sma(d), L = ecl(M), de = dec(L), r = ra(L), H = sid(d, lw) - r;
    return Math.asin(Math.sin(phi) * Math.sin(de) + Math.cos(phi) * Math.cos(de) * Math.cos(H)) / rad;
}
// ---- great-circle distance in nautical miles --------------------------------
function distNM(a, b, c, d) {
    var R = 3440.065, p = Math.PI / 180, x = (c - a) * p, y = (d - b) * p;
    var s = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) * Math.sin(y / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
}
function val(o, path) { try { var p = path.split('.'), c = o; for (var i = 0; i < p.length; i++) { c = c[p[i]]; if (c == null) return null; } return c; } catch (err) { return null; } }

// ---- 1. position & speed from Signal K --------------------------------------
var d = msg.payload || {};
var pos = val(d, 'navigation.position.value');
var sogMs = val(d, 'navigation.speedOverGround.value');
var lat = (pos && typeof pos.latitude === 'number') ? pos.latitude : null;
var lon = (pos && typeof pos.longitude === 'number') ? pos.longitude : null;
var fresh = false;
if (lat != null && lon != null) {
    fresh = true;
    global.set('livePos', { lat: lat, lon: lon });
    global.set('lastPos', { lat: lat, lon: lon });
} else {
    // GPS off (typical at anchor): fall back on the last known position
    var lp = global.get('lastPos');
    if (lp && typeof lp.lat === 'number') { lat = lp.lat; lon = lp.lon; }
}
if (lat == null) { node.status({ fill: 'grey', shape: 'ring', text: 'no position known (check Signal K)' }); return null; }

// ---- 2. throttled persistence of the last position ---------------------------
var persistMsg = null;
if (fresh) {
    var lw = context.get('lastWrite') || { t: 0 };
    var moved = (typeof lw.lat === 'number') ? distNM(lat, lon, lw.lat, lw.lon) : 99;
    if (moved > PERSIST_MIN_NM || (Date.now() - lw.t) > PERSIST_MAX_MS) {
        context.set('lastWrite', { lat: lat, lon: lon, t: Date.now() });
        persistMsg = { payload: JSON.stringify({ lat: lat, lon: lon }) };
    }
}

// ---- 3. the three conditions --------------------------------------------------
var home = global.get('homePort');
var kn = (typeof sogMs === 'number') ? sogMs / 0.514444 : 0;   // no SOG -> assumed stationary
var moving = kn > SPEED_MAX_KN;
var now = new Date();
var altNow = sunAlt(now, lat, lon);
var altSoon = sunAlt(new Date(now.getTime() + PRE_SUNSET_MIN * 60000), lat, lon);
var night = (altNow < SUN) || (altSoon < altNow && altSoon < SUN);   // ON 30 min before sunset, OFF at sunrise

var wantOn, why;
if (!home || typeof home.lat !== 'number' || typeof home.lon !== 'number') {
    wantOn = false;                                   // SAFE DEFAULT: no home port declared -> light stays OFF
    why = 'HOME PORT NOT SET - click "Set home port here"';
} else {
    var radius = (typeof home.radius === 'number') ? home.radius : DEFAULT_RADIUS_NM;
    var dist = distNM(lat, lon, home.lat, home.lon);
    var away = dist > radius;
    wantOn = night && away && !moving;
    why = (night ? 'night' : 'day') + ' | ' + (away ? dist.toFixed(1) + ' NM from port' : 'in port') + ' | ' + kn.toFixed(1) + ' kn' + (fresh ? '' : ' (last pos)');
}

// ---- 4. drive the relay: on change, and re-assert every REASSERT_EVERY polls ----
var beat = (context.get('beat') || 0) + 1;
context.set('beat', beat);
var last = context.get('lastState');
var changed = (wantOn !== last);
context.set('lastState', wantOn);
var colour = (!home || typeof home.lat !== 'number') ? 'red' : (wantOn ? 'green' : 'blue');
node.status({ fill: colour, shape: changed ? 'dot' : 'ring', text: (wantOn ? 'LIGHT ON' : 'light off') + ' - ' + why });
if (!changed && (beat % REASSERT_EVERY) !== 0) { return [null, persistMsg]; }
return [{ payload: wantOn ? 1 : 0 }, persistMsg];
