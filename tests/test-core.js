// Tests du moteur pur / pure engine tests — node tests/test-core.js
// culori (MIT) sert seulement d'oracle indépendant / used only as an independent oracle:
//   npm install culori@4 (dans /tmp/cul ou ailleurs) puis CULORI=/chemin/node_modules/culori
var E = require('./load.js')().CDV;
var culori = null;
try { culori = require(process.env.CULORI || 'culori'); } catch (e) { try { culori = require('/tmp/cul/node_modules/culori'); } catch (e2) { culori = null; } }
var pass = 0, fail = 0;
function ok(c, msg) { if (c) { pass++; } else { fail++; console.log('ÉCHEC / FAIL :', msg); } }
function near(a, b, eps, msg) { ok(Math.abs(a - b) <= eps, msg + ' (' + a + ' vs ' + b + ')'); }
var rnd = (function () { var s = 12345; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
function h(x) { return [parseInt(x.substr(1, 2), 16), parseInt(x.substr(3, 2), 16), parseInt(x.substr(5, 2), 16)]; }

// 1. ΔE 2000 : données de Sharma, Wu & Dalal (2005)
var sharma = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412], [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[50, 0, 0], [50, -1, 2], 2.3669], [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082], [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630], [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
    [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373], [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441]
];
sharma.forEach(function (t, i) { near(E.dE00(t[0], t[1]), t[2], 1e-4, 'Sharma ' + i); near(E.dE00(t[1], t[0]), t[2], 1e-4, 'Sharma sym ' + i); });

// 2. Lab, coefficients de simulation et ΔE comparés à des bibliothèques indépendantes
//    culori (MIT) : Lab D65 et matrices de Machado (culori les applique au RVB gamma ; ici on
//    vérifie donc les coefficients, le script les applique au RVB linéaire comme le recommande l'article)
//    color-diff (MIT) : ΔE 2000
var colorDiff = null;
try { colorDiff = require(process.env.COLORDIFF || 'color-diff'); } catch (e) { try { colorDiff = require('/tmp/cul/node_modules/color-diff'); } catch (e2) { colorDiff = null; } }
if (culori) {
    var toLab = culori.converter('lab65'), maxLab = 0, maxMat = 0;
    var filt = { protan: culori.filterDeficiencyProt(1), deutan: culori.filterDeficiencyDeuter(1), tritan: culori.filterDeficiencyTrit(1) };
    for (var i = 0; i < 3000; i++) {
        var rgb = [Math.round(rnd() * 255), Math.round(rnd() * 255), Math.round(rnd() * 255)];
        var c = { mode: 'rgb', r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255 };
        var L1 = E.rgbToLab(rgb), L2 = toLab(c);
        maxLab = Math.max(maxLab, Math.abs(L1[0] - L2.l), Math.abs(L1[1] - L2.a), Math.abs(L1[2] - L2.b));
        ['protan', 'deutan', 'tritan'].forEach(function (v) {
            var m = E.MATS[v], o = filt[v](c);
            var mine = [m[0] * c.r + m[1] * c.g + m[2] * c.b, m[3] * c.r + m[4] * c.g + m[5] * c.b, m[6] * c.r + m[7] * c.g + m[8] * c.b];
            maxMat = Math.max(maxMat, Math.abs(mine[0] - o.r), Math.abs(mine[1] - o.g), Math.abs(mine[2] - o.b));
        });
    }
    ok(maxLab < 0.05, 'Lab vs culori, écart max ' + maxLab);
    ok(maxMat < 1e-4, 'matrices de Machado = culori (' + maxMat + ')');
    console.log('culori : 3000 couleurs, écart Lab max ' + maxLab.toFixed(4) + ', matrices écart max ' + maxMat.toExponential(1));
} else { console.log('(culori absent : comparaisons sautées)'); }
if (colorDiff) {
    var maxDe = 0;
    for (i = 0; i < 20000; i++) {
        var x = [rnd() * 100, rnd() * 200 - 100, rnd() * 200 - 100], y = [rnd() * 100, rnd() * 200 - 100, rnd() * 200 - 100];
        maxDe = Math.max(maxDe, Math.abs(E.dE00(x, y) - colorDiff.diff({ L: x[0], a: x[1], b: x[2] }, { L: y[0], a: y[1], b: y[2] })));
    }
    ok(maxDe < 1e-9, 'ΔE00 = color-diff sur 20 000 paires (' + maxDe + ')');
    console.log('color-diff : 20 000 paires Lab, écart ΔE00 max ' + maxDe.toExponential(1));
} else { console.log('(color-diff absent : comparaison sautée)'); }
// simulation : propriétés physiques / simulation: physical properties
var grayKept = 0, neutr = 0;
for (i = 0; i <= 255; i += 15) { ['protan', 'deutan', 'tritan'].forEach(function (v) { var s0 = E.simLab([i, i, i], v, 1); if (Math.abs(s0[1]) < 1 && Math.abs(s0[2]) < 1) { grayKept++; } neutr++; }); }
ok(grayKept === neutr, 'les gris restent gris pour toutes les visions (' + grayKept + '/' + neutr + ')');
var sameDeut = E.dE00(E.simLab([255, 0, 0], 'deutan', 0), E.rgbToLab([255, 0, 0]));
ok(sameDeut < 1e-9, 'sévérité 0 = vision normale');

// 3. Aller-retour Lab -> RVB / round trip
var maxRt = 0;
for (i = 0; i < 2000; i++) { var r0 = [rnd() * 255, rnd() * 255, rnd() * 255], lb = E.rgbToLab(r0), back = E.labToRgb(lb); ok(back.inGamut, 'gamut aller-retour'); maxRt = Math.max(maxRt, Math.abs(back.rgb[0] - r0[0]), Math.abs(back.rgb[1] - r0[1]), Math.abs(back.rgb[2] - r0[2])); }
ok(maxRt < 0.01, 'aller-retour RVB ' + maxRt);
ok(!E.labToRgb([50, 120, 0]).inGamut, 'hors gamut détecté');

// 4. Paires connues / known pairs
var opts = { visions: ['protan', 'deutan', 'tritan'], severity: 1, threshold: 10, grayThreshold: 10 };
function conflict(a, b, o) { return E.compare(E.profile(h(a), o || opts), E.profile(h(b), o || opts), o || opts); }
ok(conflict('#D62728', '#2CA02C').conflict, 'rouge/vert tab10 confondus');
ok(conflict('#D62728', '#2CA02C').visions.indexOf('deutan') >= 0, 'rouge/vert : deutéranopie');
ok(conflict('#FF0000', '#00A000').conflict, 'rouge/vert purs confondus');
ok(!conflict('#E69F00', '#56B4E9').conflict, 'orange/bleu ciel Okabe-Ito distincts');
var oi = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000'], oiBad = 0;
for (i = 0; i < oi.length; i++) { for (var j = i + 1; j < oi.length; j++) { if (conflict(oi[i], oi[j]).conflict) { oiBad++; } } }
ok(oiBad === 0, 'palette Okabe-Ito sans confusion daltonienne (' + oiBad + ')');
var og = { visions: ['gray'], severity: 1, threshold: 10, grayThreshold: 10 };
ok(conflict('#E69F00', '#56B4E9', og).conflict, 'orange/bleu ciel confondus en noir et blanc');
ok(!conflict('#777777', '#787878').distinct, 'gris voisins : déjà proches pour tous, pas une confusion');
ok(!conflict('#777777', '#787878').conflict, 'gris voisins non signalés');
var sev = { visions: ['deutan'], severity: 0.6, threshold: 10, grayThreshold: 10 };
ok(E.compare(E.profile(h('#D62728'), sev), E.profile(h('#2CA02C'), sev), sev).d.deutan > conflict('#D62728', '#2CA02C').d.deutan, 'sévérité moyenne : écart plus grand');

// 5. Couleurs du document / document colours
ok(E.keyOf({ space: 'CMYK', v: [0, 100, 100, 0] }) === 'CMYK:0,100,100,0', 'clé CMJN');
ok(E.keyOf({ space: 'SPOT', name: 'PANTONE 485 C', tint: 50 }) === 'SPOT:PANTONE 485 C@50', 'clé ton direct');
var g = E.specToRgb({ space: 'GRAY', v: [100] }); ok(g[0] === 0, 'gris 100 = noir');
var sp = E.specToRgb({ space: 'SPOT', name: 'X', tint: 50, base: { space: 'CMYK', v: [0, 100, 0, 0] } });
near(sp[0], 255, 0.01, 'ton direct 50 % : rouge'); near(sp[1], 127.5, 0.01, 'ton direct 50 % : vert');
ok(E.describe({ space: 'CMYK', v: [10, 20, 30, 40] }, true) === 'C10 M20 J30 N40', 'libellé CMJN français');
ok(E.hex([255, 0, 128]) === '#FF0080', 'hexa');

// 6. Géométrie / geometry
function rect(l, b, r, t) { return [[l, b], [r, b], [r, t], [l, t]]; }
function shape(rings, area, hw) { return { rings: rings, area: area !== false, hw: hw || 0, box: E.boxOf(rings, hw || 0) }; }
var A = shape([rect(0, 0, 10, 10)]), B = shape([rect(10, 0, 20, 10)]), Cc = shape([rect(12, 0, 20, 10)]), D = shape([rect(3, 3, 6, 6)]);
ok(!!E.touch(A, B, 0.01), 'bord à bord');
ok(!E.touch(A, Cc, 1), 'écart 2 > 1 : pas voisin');
ok(!!E.touch(A, Cc, 2.5), 'écart 2 < 2,5 : voisin');
ok(!!E.touch(A, D, 0.1), 'inclusion sans bord commun');
var line = shape([[[-5, 5], [25, 5]]], false, 1);
ok(!!E.touch(line, Cc, 0), 'trait qui traverse une zone');
var lineFar = shape([[[-5, 13], [25, 13]]], false, 1);
ok(!E.touch(lineFar, A, 1), 'trait à 3 pt (demi-épaisseur 1, tol 1) : pas voisin');
ok(!!E.touch(lineFar, A, 2.1), 'trait à 3 pt (tol 2,1) : voisin');
var ring = shape([[[0, 0], [10, 0], [10, 10], [0, 10]]], false, 0.5); ring.closedLoop = true;
var right = shape([rect(-30, 4, -0.2, 6)]);
ok(!!E.touch(ring, right, 0.0), 'contour fermé : dernier côté pris en compte');
// trou d'un tracé composé (pair-impair) / compound hole
var donut = shape([rect(0, 0, 30, 30), rect(10, 10, 20, 20)]); donut.evenodd = true;
var inHole = shape([rect(13, 13, 17, 17)]);
ok(!E.touch(donut, inHole, 1), 'objet dans le trou : pas voisin');
ok(!!E.touch(donut, inHole, 3.5), 'objet dans le trou, tolérance 3,5 : voisin');
// masque : contact accepté seulement dans le masque / clip accept
var Am = shape([rect(0, 0, 10, 10)]); Am.accept = function (x, y) { return x < 5; };
ok(!E.touch(Am, B, 0.01), 'contact hors du masque ignoré');
var Bm = shape([rect(-10, 0, 0, 10)]);
ok(!!E.touch(Am, Bm, 0.01), 'contact dans le masque gardé');
// Bézier : cercle aplati / flattened circle
var k = 0.5523 * 10, circ = [{ a: [10, 0], l: [10, -k], r: [10, k] }, { a: [0, 10], l: [k, 10], r: [-k, 10] }, { a: [-10, 0], l: [-10, k], r: [-10, -k] }, { a: [0, -10], l: [-k, -10], r: [k, -10] }];
var fl = E.flatten(circ, true, 0.1), maxr = 0;
fl.forEach(function (p) { maxr = Math.max(maxr, Math.abs(Math.sqrt(p[0] * p[0] + p[1] * p[1]) - 10)); });
ok(maxr < 0.05 && fl.length > 16, 'cercle aplati, écart au rayon ' + maxr);
// propriété : distance de deux rectangles aléatoires / property: random rectangles
var nProp = 0, bad = 0;
for (i = 0; i < 3000; i++) {
    var x1 = rnd() * 100, y1 = rnd() * 100, w1 = 1 + rnd() * 30, h1 = 1 + rnd() * 30, x2 = rnd() * 100, y2 = rnd() * 100, w2 = 1 + rnd() * 30, h2 = 1 + rnd() * 30, tol = rnd() * 5;
    var dx = Math.max(0, Math.max(x1, x2) - Math.min(x1 + w1, x2 + w2)), dy = Math.max(0, Math.max(y1, y2) - Math.min(y1 + h1, y2 + h2));
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dist - tol) < 1e-6) { continue; }
    var got = !!E.touch(shape([rect(x1, y1, x1 + w1, y1 + h1)]), shape([rect(x2, y2, x2 + w2, y2 + h2)]), tol);
    nProp++; if (got !== (dist <= tol)) { bad++; }
}
ok(bad === 0, 'rectangles aléatoires : ' + bad + ' erreurs sur ' + nProp);
// balayage = force brute / sweep equals brute force
var shapes = []; for (i = 0; i < 150; i++) { var X0 = rnd() * 300, Y0 = rnd() * 300; shapes.push(shape([rect(X0, Y0, X0 + 3 + rnd() * 25, Y0 + 3 + rnd() * 25)])); }
var sw = E.neighbours(shapes, 1), set = {}; sw.forEach(function (p) { set[p.a + '-' + p.b] = 1; });
var brute = 0, miss = 0;
for (i = 0; i < shapes.length; i++) { for (j = i + 1; j < shapes.length; j++) { if (E.touch(shapes[i], shapes[j], 1)) { brute++; if (!set[i + '-' + j]) { miss++; } } } }
ok(miss === 0 && brute === sw.length, 'balayage = force brute (' + sw.length + '/' + brute + ')');

// 7. Analyse : carte simple rouge/vert + contour séparateur / analysis
function paint(key, rgb, rings, kind, obj, sep) {
    return { key: key, spec: { space: 'RGB', v: rgb }, kind: kind || 'fill', obj: obj, shape: shape(rings, kind !== 'stroke', kind === 'stroke' ? 0.5 : 0), sep: sep || null };
}
var ao = { visions: ['protan', 'deutan', 'tritan'], severity: 1, threshold: 10, grayThreshold: 10, tol: 1, useSep: true, sepWidth: 0.75, textOnBg: true };
var red = h('#D62728'), green = h('#2CA02C'), blue = h('#1F77B4'), white = [255, 255, 255];
var map = [paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0), paint('G', green, [rect(10, 0, 20, 10)], 'fill', 1), paint('B', blue, [rect(40, 0, 50, 10)], 'fill', 2), paint('G', green, [rect(50, 0, 60, 10)], 'fill', 3)];
var res = E.analyse(map, ao);
ok(res.conflicts.length === 1 && res.conflicts[0].contacts.length === 1, 'carte : une confusion rouge/vert, un contact');
ok(res.conflicts[0].a === 'G' && res.conflicts[0].b === 'R', 'paire ordonnée');
var palRes = E.analyse(map, { visions: ao.visions, severity: 1, threshold: 10, grayThreshold: 10, palette: true });
ok(palRes.conflicts.length >= 1, 'mode palette : rouge/vert trouvés même loin');
var sepW = { key: 'W', spec: { space: 'RGB', v: white }, width: 1 };
var map2 = [paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0, sepW), paint('G', green, [rect(10, 0, 20, 10)], 'fill', 1)];
var res2 = E.analyse(map2, ao);
ok(res2.conflicts.length === 0 && res2.stats.separatedContacts === 1, 'contour blanc de 1 pt : séparés');
var thin = { key: 'W', spec: { space: 'RGB', v: white }, width: 0.25 };
ok(E.analyse([paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0, thin), map2[1]], ao).conflicts.length === 1, 'contour trop fin : pas séparés');
var sepSame = { key: 'G2', spec: { space: 'RGB', v: h('#2DA12D') }, width: 2 };
ok(E.analyse([paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0, sepSame), map2[1]], ao).conflicts.length === 1, 'contour vert sur rouge/vert : pas séparés');
// texte rouge sur fond vert / red text on green
var txt = [paint('G', green, [rect(0, 0, 100, 50)], 'fill', 0), paint('R', red, [rect(10, 10, 40, 20)], 'text', 1)];
ok(E.analyse(txt, ao).conflicts.length === 1, 'texte rouge sur fond vert');
ao.textOnBg = false; ok(E.analyse(txt, ao).conflicts.length === 0, 'option texte désactivée'); ao.textOnBg = true;
// fond et contour d'un même objet ignorés / own fill & stroke ignored
ok(E.analyse([paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0), paint('G', green, [rect(0, 0, 10, 10)], 'stroke', 0)], ao).conflicts.length === 0, 'fond/contour du même objet ignorés');
ok(E.analyse([paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0), paint('G', green, [[[-5, 5], [5, 5]]], 'stroke', 1)], ao).conflicts.length === 1, 'route verte sur zone rouge');

// 8. Corrections : propriétés / fixes: properties
var nFix = 0, solved = 0, newConf = 0, maxChg = 0, nofix = 0;
for (i = 0; i < 300; i++) {
    var cols = [], ps = [];
    for (j = 0; j < 6; j++) { cols.push([Math.round(rnd() * 255), Math.round(rnd() * 255), Math.round(rnd() * 255)]); }
    // bande de 6 zones voisines / strip of 6 neighbouring areas
    for (j = 0; j < 6; j++) { ps.push(paint('K' + j, cols[j], [rect(j * 10, 0, j * 10 + 10, 10)], 'fill', j)); }
    var r1 = E.analyse(ps, ao); if (!r1.conflicts.length) { continue; }
    r1.palette = false;
    var pl = E.planFixes(r1, r1.conflicts, ao, null, 25);
    nFix++;
    // appliquer le plan et réanalyser / apply plan and re-analyse
    var ps2 = ps.map(function (p) { var f = pl.plan[p.key]; return f ? paint(f.key, f.spec.v, p.shape.rings, 'fill', p.obj) : p; });
    var r2 = E.analyse(ps2, ao);
    var unsolved = pl.steps.filter(function (s) { return s.status === 'nofix'; }).length;
    nofix += unsolved;
    if (r2.conflicts.length === 0) { solved++; } else if (!unsolved) { newConf++; }
    ok(r2.conflicts.length === pl.remaining, 'reste annoncé = reste réel (' + r2.conflicts.length + '/' + pl.remaining + ')');
    for (var kk in pl.plan) { maxChg = Math.max(maxChg, pl.plan[kk].change); }
}
ok(newConf === 0, 'corrections : aucune nouvelle confusion créée (' + newConf + ')');
ok(maxChg <= 25, 'retouche maximale ≤ 25 ΔE (' + maxChg.toFixed(1) + ')');
console.log('corrections : ' + nFix + ' bandes à confusions, ' + solved + ' entièrement réglées, ' + nofix + ' paires sans correction simple, retouche max ΔE ' + maxChg.toFixed(1));
ok(solved / nFix > 0.8, 'au moins 80 % des bandes réglées (' + solved + '/' + nFix + ')');
// minimalité : aucune autre couleur candidate plus proche ne convient / minimality
var one = [paint('R', red, [rect(0, 0, 10, 10)], 'fill', 0), paint('G', green, [rect(10, 0, 20, 10)], 'fill', 1)];
var rr = E.analyse(one, ao); rr.palette = false;
var fx = E.bestFix({ space: 'RGB', v: green }, ['R'], { R: rr.colors.map.R.prof }, ao, null, 40);
ok(fx && fx.change > 0, 'rouge/vert : retouche trouvée (ΔE ' + (fx && fx.change.toFixed(1)) + ', ' + (fx && E.hex(fx.rgb)) + ')');
var after = E.compare(fx.prof, rr.colors.map.R.prof, ao); ok(!after.conflict && after.minSim >= 10, 'après retouche : distinctes (' + after.minSim.toFixed(1) + ')');
var better = 0;
E.candidates({ space: 'RGB', v: green }).forEach(function (c) {
    var p2 = E.profile(c.v, ao), chg = E.dE00(E.rgbToLab(green), p2.normal), cc = E.compare(p2, rr.colors.map.R.prof, { visions: ao.visions, severity: 1, threshold: 11.5, grayThreshold: 11.5 });
    if (chg < fx.change - 1e-9 && cc.distinct && !cc.visions.length) { better++; }
});
ok(better === 0, 'retouche minimale parmi les candidats (' + better + ')');
// CMJN et ton direct / CMYK and spot
var cm = E.bestFix({ space: 'CMYK', v: [0, 100, 100, 0] }, ['G'], { G: E.profile(green, ao) }, ao, null, 40);
ok(cm && cm.spec.space === 'CMYK', 'retouche CMJN reste en CMJN (' + (cm && cm.spec.v.join(',')) + ')');
var spf = E.bestFix({ space: 'SPOT', name: 'P', tint: 100, base: { space: 'CMYK', v: [0, 100, 100, 0] } }, ['G'], { G: E.profile(green, ao) }, ao, null, 40);
ok(spf && spf.spec.space === 'SPOT' && spf.spec.tint < 100, 'ton direct : retouche par la teinte (' + (spf && spf.spec.tint) + ' %)');
ok(E.bestFix({ space: 'RGB', v: green }, ['R'], { R: rr.colors.map.R.prof }, ao, null, 0.5) === null, 'retouche plafonnée : rien');

console.log('test-core : ' + pass + ' réussis, ' + fail + ' échoués');
process.exit(fail ? 1 : 0);
