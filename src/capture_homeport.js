// ============================================================================
//  "Set home port" node
//  Triggered by the inject "Set home port HERE (click while at your berth)"
//  or by "Set home port MANUALLY" whose payload is {"lat": .., "lon": .., "radius": ..}.
//  Saves the home port in the global context and returns it to be written to disk.
// ============================================================================
var DEFAULT_RADIUS_NM = 3;
var lat, lon, radius;

if (msg.payload && typeof msg.payload === 'object' && typeof msg.payload.lat === 'number' && typeof msg.payload.lon === 'number') {
    lat = msg.payload.lat; lon = msg.payload.lon;                       // manual coordinates
    radius = (typeof msg.payload.radius === 'number') ? msg.payload.radius : DEFAULT_RADIUS_NM;
} else {
    var lp = global.get('livePos') || global.get('lastPos');            // current GPS position
    if (!lp || typeof lp.lat !== 'number') {
        node.status({ fill: 'red', shape: 'ring', text: 'no GPS position yet - cannot set home port' });
        return null;
    }
    lat = lp.lat; lon = lp.lon;
    var ex = global.get('homePort') || {};
    radius = (typeof ex.radius === 'number') ? ex.radius : DEFAULT_RADIUS_NM;
}
if (lat === 0 && lon === 0) {                                          // the manual inject was not edited
    node.status({ fill: 'red', shape: 'ring', text: 'edit lat/lon in the inject node first' });
    return null;
}
var home = { lat: lat, lon: lon, radius: radius };
global.set('homePort', home);
node.status({ fill: 'green', shape: 'dot', text: 'home port ' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ' - radius ' + radius + ' NM' });
msg.payload = JSON.stringify(home);
return msg;
