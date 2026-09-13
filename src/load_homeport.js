// ============================================================================
//  "Load home port" node — runs once at start-up (after a reboot or a deploy).
//  Reads the home-port file written by "Set home port". If the file is missing
//  or invalid, NO home port is set and the decision node keeps the light OFF.
// ============================================================================
try {
    var h = JSON.parse(msg.payload);
    if (h && typeof h.lat === 'number' && typeof h.lon === 'number') {
        global.set('homePort', h);
        node.status({ fill: 'green', shape: 'dot', text: 'home port ' + h.lat.toFixed(3) + ', ' + h.lon.toFixed(3) + ' (r=' + (h.radius || 3) + ' NM)' });
        return null;
    }
} catch (err) { /* empty or invalid file */ }
global.set('homePort', null);
node.status({ fill: 'red', shape: 'ring', text: 'no home port saved - click "Set home port here"' });
return null;
