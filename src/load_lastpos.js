// ============================================================================
//  "Load last position" node — runs once at start-up.
//  Restores the last known GPS position so that the decision keeps working
//  after a reboot even if the GPS is switched off (typical at anchor).
// ============================================================================
try {
    var p = JSON.parse(msg.payload);
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number') {
        global.set('lastPos', p);
        node.status({ fill: 'green', shape: 'dot', text: 'last position restored ' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) });
        return null;
    }
} catch (err) { /* empty or invalid file */ }
node.status({ fill: 'grey', shape: 'ring', text: 'no saved position yet' });
return null;
