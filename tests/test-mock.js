// Tests sur DOM Illustrator simulé / simulated Illustrator DOM tests — node tests/test-mock.js
var M = require('./mock-ai.js'), load = require('./load.js');
var pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL :', msg); } }
var RED = [214, 39, 40], GREEN = [44, 160, 44], BLUE = [31, 119, 180], ORANGE = [230, 159, 0];
function P(r, col, o) { o = o || {}; o.fill = o.fill === undefined ? M.rgb(col[0], col[1], col[2]) : o.fill; return new M.PathItem(r, o); }
var alerts = [];
function env(doc, hook, extra) {
    alerts = [];
    var g = {
        app: { locale: 'fr_FR', documents: doc ? [doc] : [], activeDocument: doc, convertSampleColor: function (s, v) { var k = v[3] / 100; return [255 * (1 - v[0] / 100) * (1 - k), 255 * (1 - v[1] / 100) * (1 - k), 255 * (1 - v[2] / 100) * (1 - k)]; } },
        RGBColor: M.RGBColor, CMYKColor: M.CMYKColor, GrayColor: M.GrayColor, SpotColor: M.SpotColor,
        ZOrderMethod: { BRINGTOFRONT: 'front' }, DocumentColorSpace: { CMYK: 'DocumentColorSpace.CMYK', RGB: 'DocumentColorSpace.RGB' },
        ImageColorSpace: { CMYK: 'cmyk', RGB: 'rgb' }, ColorConvertPurpose: { defaultpurpose: 'def' },
        alert: function (m) { alerts.push(String(m)); }, confirm: function () { return true; },
        Window: M.makeUI(hook), File: { saveDialog: function () { return null; } }
    };
    for (var k in (extra || {})) { g[k] = extra[k]; }
    return load(g);
}
var OPTS = { visions: ['protan', 'deutan', 'tritan'], severity: 1, threshold: 10, grayThreshold: 10, tol: 72 / 25.4, useSep: true, sepWidth: 0.75, textOnBg: true, skipLocked: true, skipNonPrinting: true };
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// --- 1. carte : rouge | vert (voisins), bleu loin, texte rouge sur vert, calque masqué, verrouillé, dégradé
function mapDoc() {
    var r = P(M.rect(0, 0, 100, 100), RED), g = P(M.rect(100, 0, 200, 100), GREEN), b = P(M.rect(400, 0, 500, 100), BLUE);
    var bg = P(M.rect(0, 200, 300, 400), GREEN), txt = new M.TextFrame([20, 300, 120, 280], [{ text: 'Sortie', color: M.rgb(RED[0], RED[1], RED[2]) }, { text: ' ', color: M.rgb(0, 0, 255) }]);
    var grad = P(M.rect(500, 0, 600, 100), null, { fill: { typename: 'GradientColor' } });
    var hiddenGreen = P(M.rect(-100, 0, 0, 100), GREEN);
    var lockedGreen = P(M.rect(0, -100, 100, 0), GREEN, { locked: true });
    var L1 = new M.Layer('Carte', [r, g, b, bg, txt, grad, lockedGreen]), L2 = new M.Layer('Masqué', [hiddenGreen], { visible: false });
    return { doc: new M.Document([L1, L2]), r: r, g: g, b: b, bg: bg, txt: txt, lockedGreen: lockedGreen };
}
var D = mapDoc(), ctx = env(D.doc), UI = ctx.CDV_UI, E = ctx.CDV;
var col = UI.collect(D.doc, 'document', OPTS);
ok(col.paints.length === 5, 'peintures collectées : 4 fonds + 1 texte (espaces ignorés) → ' + col.paints.length);
ok(col.skipped.gradient === 1, 'dégradé compté comme non analysé');
ok(col.skipped.hidden === 0 && col.skipped.locked === 1, 'objet verrouillé ignoré (' + col.skipped.locked + ')');
var res = E.analyse(col.paints, OPTS, UI.CONV);
ok(res.conflicts.length === 1, 'une paire rouge/vert (' + res.conflicts.length + ')');
ok(res.conflicts[0].contacts.length === 2, 'deux contacts : bord commun + texte sur fond (' + res.conflicts[0].contacts.length + ')');
ok(res.conflicts[0].cmp.visions.indexOf('deutan') >= 0, 'deutéranopie en cause');
// --- sélection limitée / selection scope
var colSel = UI.collect(D.doc, 'selection', OPTS); ok(colSel.paints.length === 0, 'sélection vide : rien');
D.doc.selection = [D.r, D.b]; colSel = UI.collect(D.doc, 'selection', OPTS);
ok(E.analyse(colSel.paints, OPTS, UI.CONV).conflicts.length === 0, 'sélection rouge + bleu : pas de confusion');
D.doc.selection = [];
// --- plan de travail actif / active artboard
D.doc.artboards[0].artboardRect = [0, 150, 250, -10];
var colAb = UI.collect(D.doc, 'artboard', OPTS);
ok(colAb.paints.length === 2, 'plan de travail : seules les zones rouge et verte du haut (' + colAb.paints.length + ')');
D.doc.artboards[0].artboardRect = [0, 1000, 1000, 0];
// --- correction / fix
res.palette = false;
var plan = E.planFixes(res, res.conflicts, OPTS, UI.CONV, 25);
var keys = Object.keys(plan.plan);
ok(keys.length === 1 && plan.remaining === 0, 'une couleur retouchée, plus de confusion');
var changedKey = keys[0];
var a = UI.applyPlan(col.paints, plan.plan);
ok(a.changed >= 1 && a.failed === 0, 'couleurs appliquées (' + a.changed + ')');
var col2 = UI.collect(D.doc, 'document', OPTS), res2 = E.analyse(col2.paints, OPTS, UI.CONV);
ok(res2.conflicts.length === 0, 'réanalyse après correction : 0 confusion');
ok(D.lockedGreen.fillColor.green === 160, 'objet verrouillé non retouché');
ok(D.b.fillColor.blue === 180, 'bleu non touché');
// le texte rouge ne garde que la partie rouge modifiée si c'est le rouge qui change
if (changedKey.indexOf('RGB:214,39,40') === 0) { ok(D.txt.textRanges[1].characterAttributes.fillColor.blue === 255, 'espace bleu du texte inchangé'); }
else { ok(D.r.fillColor.red === 214, 'rouge inchangé si c\'est le vert qui change'); }

// --- 2. masque d'écrêtage : contact hors masque ignoré / clipping mask
var clipPath = new M.PathItem(M.rect(0, 0, 50, 100), { fill: null, clipping: true });
var inside = P(M.rect(0, 0, 100, 100), RED);
var grp = new M.GroupItem([clipPath, inside], true);
var nb = P(M.rect(100, 0, 200, 100), GREEN);
var Dc = new M.Document([new M.Layer('L', [grp, nb])]);
ctx = env(Dc); UI = ctx.CDV_UI; E = ctx.CDV;
var colC = UI.collect(Dc, 'document', OPTS);
ok(colC.paints.length === 2, 'masque : tracé de masque non peint ignoré');
ok(E.analyse(colC.paints, OPTS, UI.CONV).conflicts.length === 0, 'masque : le rouge est coupé à 50, il ne touche pas le vert');
clipPath.pathPoints = M.rect(0, 0, 120, 100).map(function (p) { return { anchor: p, leftDirection: p, rightDirection: p }; });
colC = UI.collect(Dc, 'document', OPTS);
ok(E.analyse(colC.paints, OPTS, UI.CONV).conflicts.length === 1, 'masque élargi : contact trouvé');

// --- 3. calque contrôle, tracé composé, contour séparateur, CMJN, ton direct
var donut = new M.CompoundPathItem([M.rect(0, 0, 300, 300), M.rect(100, 100, 200, 200)], { fill: M.cmyk(0, 100, 100, 0), evenodd: true });
var hole = new M.PathItem(M.rect(130, 130, 170, 170), { fill: M.spot('Vert 347', M.cmyk(100, 0, 100, 40), 100) });
var Dk = new M.Document([new M.Layer('L', [donut, hole])], { cmyk: true });
ctx = env(Dk); UI = ctx.CDV_UI; E = ctx.CDV;
var colK = UI.collect(Dk, 'document', OPTS);
ok(E.analyse(colK.paints, OPTS, UI.CONV).conflicts.length === 0, 'objet au milieu du trou à 30 pt : pas voisin');
hole.pathPoints = M.rect(101, 130, 170, 170).map(function (p) { return { anchor: p, leftDirection: p, rightDirection: p }; });
colK = UI.collect(Dk, 'document', OPTS);
var resK = E.analyse(colK.paints, OPTS, UI.CONV);
ok(resK.conflicts.length === 1, 'objet au bord du trou : voisin (' + resK.conflicts.length + ')');
resK.palette = false;
var planK = E.planFixes(resK, resK.conflicts, OPTS, UI.CONV, 25);
var pk = Object.keys(planK.plan)[0], fx = planK.plan[pk];
ok(fx && (fx.spec.space === 'CMYK' || fx.spec.space === 'SPOT'), 'CMJN/ton direct : retouche dans le même espace (' + (fx && fx.spec.space) + ')');
UI.applyPlan(colK.paints, planK.plan);
if (fx.spec.space === 'SPOT') { ok(hole.fillColor.typename === 'SpotColor' && hole.fillColor.spot.name === 'Vert 347' && hole.fillColor.tint < 100, 'ton direct gardé, teinte changée'); }
else { ok(donut.pathItems[0].fillColor.typename === 'CMYKColor', 'CMJN gardé'); }
// contour séparateur blanc 2 pt / white separating stroke
hole.fillColor = M.spot('Vert 347', M.cmyk(100, 0, 100, 40), 100); donut.pathItems[0].fillColor = M.cmyk(0, 100, 100, 0);
hole.stroked = true; hole.strokeColor = M.cmyk(0, 0, 0, 0); hole.strokeWidth = 2;
var colS = UI.collect(Dk, 'document', OPTS), resS = E.analyse(colS.paints, OPTS, UI.CONV);
ok(resS.conflicts.length === 0 && resS.stats.separatedContacts >= 1, 'contour blanc de 2 pt : séparés');
var o3 = clone(OPTS); o3.useSep = false;
ok(E.analyse(UI.collect(Dk, 'document', o3).paints, o3, UI.CONV).conflicts.length >= 1, 'option contour désactivée : confusion');
// repères / marks
var nm = UI.markConflicts(Dk, E.analyse(UI.collect(Dk, 'document', o3).paints, o3, UI.CONV), E.analyse(UI.collect(Dk, 'document', o3).paints, o3, UI.CONV).conflicts, null);
var LC = Dk.layers.getByName(UI.LAYER_NAME);
ok(nm >= 1 && LC.printable === false && LC.locked === true, 'calque de contrôle non imprimable et verrouillé (' + nm + ' repères)');
var before = LC._items.length;
UI.markConflicts(Dk, E.analyse(UI.collect(Dk, 'document', o3).paints, o3, UI.CONV), E.analyse(UI.collect(Dk, 'document', o3).paints, o3, UI.CONV).conflicts, null);
ok(LC._items.length === before, 'relance : anciens repères remplacés (' + LC._items.length + ')');
ok(Dk.layers.length === 2, 'un seul calque de contrôle');
var o4 = clone(o3); o4.skipLocked = false; o4.skipNonPrinting = false;
ok(UI.collect(Dk, 'document', o4).paints.every(function (p) { return p.item.parent !== LC; }), 'le calque de contrôle n\'est jamais analysé, même déverrouillé et imprimable');

// --- 4. groupes : objets imbriqués comptés une fois / nested items counted once
var g1 = new M.GroupItem([P(M.rect(0, 0, 10, 10), RED), new M.GroupItem([P(M.rect(10, 0, 20, 10), GREEN)])]);
var Dg = new M.Document([new M.Layer('L', [g1])]);
ctx = env(Dg); UI = ctx.CDV_UI; E = ctx.CDV;
ok(UI.collect(Dg, 'document', OPTS).paints.length === 2, 'groupes imbriqués : 2 peintures, pas de doublon');


// --- 4b. Illustrator sans uuid (avant 2020) : pas de doublon grâce au test du parent
function stripUuid(it) { delete it.uuid; if (it.pageItems) { it.pageItems.forEach(stripUuid); } }
var g2 = new M.GroupItem([P(M.rect(0, 0, 10, 10), RED), new M.GroupItem([P(M.rect(10, 0, 20, 10), GREEN)])]); stripUuid(g2);
var Dg2 = new M.Document([new M.Layer('L', [g2])]);
ok(UI.collect(Dg2, 'document', OPTS).paints.length === 2, 'sans uuid : 2 peintures, pas de doublon');
// --- 4c. calque verrouillé ignoré / locked layer skipped
var Dl = new M.Document([new M.Layer('Verrou', [P(M.rect(0, 0, 10, 10), RED)], { locked: true }), new M.Layer('L', [P(M.rect(10, 0, 20, 10), GREEN)])]);
ok(UI.collect(Dl, 'document', OPTS).paints.length === 1, 'calque verrouillé ignoré');
var oUnl = clone(OPTS); oUnl.skipLocked = false;
ok(UI.collect(Dl, 'document', oUnl).paints.length === 2, 'option désactivée : calque verrouillé analysé');
// --- 4d. calque non imprimable / non-printing layer
var Dp = new M.Document([new M.Layer('Notes', [P(M.rect(0, 0, 10, 10), RED)], { printable: false }), new M.Layer('L', [P(M.rect(10, 0, 20, 10), GREEN)])]);
ok(UI.collect(Dp, 'document', OPTS).paints.length === 1, 'calque non imprimable ignoré');

// --- 5. parcours complet avec les fenêtres simulées / full run with simulated dialogs
function runWith(doc, actionText, sel) {
    var shown = [];
    var c = env(doc, function (w) {
        shown.push(w.title);
        if (w.title.indexOf('Confusions trouvées') === 0) { var r = w.find(actionText); r.value = true; ['Sélectionner les objets', 'Signaler', 'Appliquer les corrections'].forEach(function (t) { if (t !== actionText) { w.find(t).value = false; } }); }
        return 1;
    });
    if (sel) { doc.selection = sel; }
    c.CDV_UI.run();
    return { shown: shown, alerts: alerts.slice(), ctx: c };
}
var D5 = mapDoc(), r5 = runWith(D5.doc, 'Signaler');
ok(r5.shown.length === 2, 'deux fenêtres : réglages puis résultats');
ok(/repère/.test(r5.alerts[0]), 'signalement annoncé : ' + r5.alerts[0].split('\n')[0]);
D5 = mapDoc(); r5 = runWith(D5.doc, 'Sélectionner les objets');
ok(D5.r.selected && D5.g.selected && D5.bg.selected && D5.txt.selected && !D5.b.selected, 'objets concernés sélectionnés, bleu non');
D5 = mapDoc(); r5 = runWith(D5.doc, 'Appliquer les corrections');
ok(/retouchée/.test(r5.alerts[0]) && !/encore confondues/.test(r5.alerts[0]), 'correction appliquée : ' + r5.alerts[0].split('\n')[0]);
var after5 = r5.ctx.CDV.analyse(r5.ctx.CDV_UI.collect(D5.doc, 'document', OPTS).paints, OPTS, r5.ctx.CDV_UI.CONV);
ok(after5.conflicts.length === 0, 'après le parcours complet : 0 confusion');
// pas de document / no document
var c0 = env(null); c0.CDV_UI.run(); ok(/Ouvrez un document/.test(alerts[0]), 'message sans document');
// rien de coloré / nothing coloured
var De = new M.Document([new M.Layer('Vide', [])]); var ce = env(De); ce.CDV_UI.run(); ok(/Aucun objet coloré/.test(alerts[0]), 'message document sans couleur');
// aucune confusion / no confusion
var Dn = new M.Document([new M.Layer('L', [P(M.rect(0, 0, 10, 10), ORANGE), P(M.rect(10, 0, 20, 10), BLUE)])]);
var cn = env(Dn); cn.CDV_UI.run(); ok(/Aucune confusion trouvée/.test(alerts[0]), 'message aucune confusion');
// annuler / cancel
var Dx = mapDoc(); var cx = env(Dx.doc, function () { return 2; }); cx.CDV_UI.run(); ok(alerts.length === 0 && Dx.r.fillColor.red === 214, 'Annuler : rien ne change');
// anglais / English
var Den = mapDoc(); var cen = env(Den.doc, function (w) { return 1; }); cen.app.locale = 'en_US';
var cEN = load({ app: { locale: 'en_US', documents: [], activeDocument: null }, $: { locale: 'en' }, alert: function (m) { alerts.push(m); } });
alerts = []; cEN.CDV_UI.run(); ok(/Open a document/.test(alerts[0]), 'interface anglaise');

console.log('test-mock : ' + pass + ' réussis, ' + fail + ' échoués');
process.exit(fail ? 1 : 0);
