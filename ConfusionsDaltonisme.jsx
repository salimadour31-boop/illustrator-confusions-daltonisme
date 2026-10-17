/*
 * ConfusionsDaltonisme.jsx — v1.0.0
 * Adobe Illustrator CC 2018 – 2026 (ExtendScript / JavaScript ES3)
 *
 * FR : Trouve, dans un graphique, une carte, une signalétique ou un emballage, les couleurs
 *      DIFFÉRENTES qui SE TOUCHENT (ou un texte posé sur un fond) et que les personnes
 *      daltoniennes (protanopie, deutéranopie, tritanopie) ou une impression en noir et blanc
 *      ne peuvent plus distinguer. Les sélectionne, les signale sur un calque non imprimable
 *      et propose pour chaque paire la plus petite retouche de couleur qui règle la confusion
 *      sans en créer de nouvelle avec les autres voisins.
 * EN : Finds DIFFERENT colours that TOUCH each other (or text over a background) in a chart, map,
 *      sign or package that people with colour vision deficiency (protanopia, deuteranopia,
 *      tritanopia) or a black & white print can no longer tell apart. Selects them, flags them on
 *      a non-printing layer and proposes, for each pair, the smallest colour change that fixes the
 *      confusion without creating a new one with the other neighbours.
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT (voir LICENSE / see LICENSE)
 * Non testé dans Illustrator / Not tested in Illustrator (voir README / see README).
 * Aucun appel réseau, aucune collecte de données / No network access, no data collection.
 * Travaillez sur une copie du fichier / Work on a copy of your file.
 *
 * Références scientifiques / scientific references :
 *  - Machado, Oliveira & Fernandes (2009), « A Physiologically-based Model for Simulation of Color
 *    Vision Deficiency », IEEE TVCG 15(6) — matrices de simulation (sévérité 1,0).
 *  - Sharma, Wu & Dalal (2005), « The CIEDE2000 Color-Difference Formula » — écart ΔE 2000.
 *  - IEC 61966-2-1 (sRGB), CIE 15 (L*a*b*, illuminant D65).
 */

//@target illustrator

var CDV = (function () {
    // =====================================================================================
    // <ENGINE> moteur pur, sans DOM Illustrator / pure engine, no Illustrator DOM
    // =====================================================================================
    var E = {};

    // ---------- outils / helpers ----------
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }
    E.clamp = clamp; E.round = round;

    // ---------- sRGB <-> L*a*b* (D65) ----------
    function toLin(c) { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function fromLin(c) { var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return v * 255; }
    E.toLin = toLin; E.fromLin = fromLin;
    var WX = 0.95047, WY = 1.0, WZ = 1.08883;
    function fLab(t) { return t > 216 / 24389 ? Math.pow(t, 1 / 3) : (24389 / 27 * t + 16) / 116; }
    function fLabInv(t) { var t3 = t * t * t; return t3 > 216 / 24389 ? t3 : (116 * t - 16) / (24389 / 27); }
    function linToLab(r, g, b) {
        var x = 0.4123908 * r + 0.3575843 * g + 0.1804808 * b;
        var y = 0.2126390 * r + 0.7151687 * g + 0.0721923 * b;
        var z = 0.0193308 * r + 0.1191948 * g + 0.9505322 * b;
        var fx = fLab(x / WX), fy = fLab(y / WY), fz = fLab(z / WZ);
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }
    function rgbToLab(rgb) { return linToLab(toLin(rgb[0]), toLin(rgb[1]), toLin(rgb[2])); }
    // Lab -> sRGB 0-255 ; inGamut = faux si une composante sort de 0-255 avant écrêtage
    function labToRgb(lab) {
        var fy = (lab[0] + 16) / 116, fx = fy + lab[1] / 500, fz = fy - lab[2] / 200;
        var x = WX * fLabInv(fx), y = WY * fLabInv(fy), z = WZ * fLabInv(fz);
        var r = 3.2409699 * x - 1.5373832 * y - 0.4986108 * z;
        var g = -0.9692436 * x + 1.8759675 * y + 0.0415551 * z;
        var b = 0.0556301 * x - 0.2039770 * y + 1.0569715 * z;
        var out = [fromLin(Math.max(0, r)), fromLin(Math.max(0, g)), fromLin(Math.max(0, b))], ok = true;
        if (r < -0.001 || g < -0.001 || b < -0.001) { ok = false; }
        for (var i = 0; i < 3; i++) { if (out[i] > 255.5) { ok = false; } out[i] = clamp(out[i], 0, 255); }
        return { rgb: out, inGamut: ok };
    }
    E.rgbToLab = rgbToLab; E.labToRgb = labToRgb;

    // ---------- ΔE 2000 (Sharma 2005) ----------
    function dE00(l1, l2) {
        var L1 = l1[0], a1 = l1[1], b1 = l1[2], L2 = l2[0], a2 = l2[1], b2 = l2[2];
        var C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2), Cm = (C1 + C2) / 2;
        var Cm7 = Math.pow(Cm, 7), G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625)));
        var a1p = (1 + G) * a1, a2p = (1 + G) * a2;
        var C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
        var RAD = Math.PI / 180;
        var h1p = (b1 === 0 && a1p === 0) ? 0 : Math.atan2(b1, a1p) / RAD; if (h1p < 0) { h1p += 360; }
        var h2p = (b2 === 0 && a2p === 0) ? 0 : Math.atan2(b2, a2p) / RAD; if (h2p < 0) { h2p += 360; }
        var dLp = L2 - L1, dCp = C2p - C1p, dhp;
        if (C1p * C2p === 0) { dhp = 0; } else { dhp = h2p - h1p; if (dhp > 180) { dhp -= 360; } else if (dhp < -180) { dhp += 360; } }
        var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * RAD / 2);
        var Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2, hpm;
        if (C1p * C2p === 0) { hpm = h1p + h2p; }
        else if (Math.abs(h1p - h2p) <= 180) { hpm = (h1p + h2p) / 2; }
        else if (h1p + h2p < 360) { hpm = (h1p + h2p + 360) / 2; }
        else { hpm = (h1p + h2p - 360) / 2; }
        var T = 1 - 0.17 * Math.cos((hpm - 30) * RAD) + 0.24 * Math.cos(2 * hpm * RAD) + 0.32 * Math.cos((3 * hpm + 6) * RAD) - 0.20 * Math.cos((4 * hpm - 63) * RAD);
        var dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
        var Cpm7 = Math.pow(Cpm, 7), RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 6103515625));
        var Lq = (Lpm - 50) * (Lpm - 50), SL = 1 + 0.015 * Lq / Math.sqrt(20 + Lq);
        var SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T, RT = -Math.sin(2 * dTheta * RAD) * RC;
        var tl = dLp / SL, tc = dCp / SC, th = dHp / SH;
        return Math.sqrt(tl * tl + tc * tc + th * th + RT * tc * th);
    }
    E.dE00 = dE00;

    // ---------- simulation (Machado 2009, sévérité 1, RVB linéaire) ----------
    var MATS = {
        protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
        deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
        tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900]
    };
    E.MATS = MATS;
    E.VISIONS = ['protan', 'deutan', 'tritan', 'gray'];
    // Lab perçu par une vision donnée / Lab as seen by a given vision
    // severity 0..1 : interpolation linéaire entre vision normale et dichromatie (approximation)
    function simLab(rgb, vision, severity) {
        var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
        if (vision === 'normal') { return linToLab(r, g, b); }
        if (vision === 'gray') {
            var y = 0.2126390 * r + 0.7151687 * g + 0.0721923 * b;
            return [116 * fLab(y) - 16, 0, 0];
        }
        var m = MATS[vision], s = severity === undefined ? 1 : severity;
        var r2 = m[0] * r + m[1] * g + m[2] * b, g2 = m[3] * r + m[4] * g + m[5] * b, b2 = m[6] * r + m[7] * g + m[8] * b;
        r2 = clamp(s * r2 + (1 - s) * r, 0, 1); g2 = clamp(s * g2 + (1 - s) * g, 0, 1); b2 = clamp(s * b2 + (1 - s) * b, 0, 1);
        return linToLab(r2, g2, b2);
    }
    E.simLab = simLab;

    // Profil d'une couleur : Lab normal + Lab de chaque vision cochée
    function profile(rgb, opts) {
        var p = { rgb: rgb, normal: simLab(rgb, 'normal') };
        for (var i = 0; i < opts.visions.length; i++) { p[opts.visions[i]] = simLab(rgb, opts.visions[i], opts.severity); }
        return p;
    }
    E.profile = profile;

    // Compare deux profils / compares two profiles
    // conflict = distinctes en vision normale (ΔE ≥ seuil) mais confondues dans au moins une vision
    function compare(pa, pb, opts) {
        var res = { dNormal: dE00(pa.normal, pb.normal), d: {}, worst: null, minSim: 1e9, conflict: false, visions: [] };
        for (var i = 0; i < opts.visions.length; i++) {
            var v = opts.visions[i], thr = v === 'gray' ? opts.grayThreshold : opts.threshold;
            var d = dE00(pa[v], pb[v]); res.d[v] = d;
            if (d < res.minSim) { res.minSim = d; res.worst = v; }
            if (d < thr) { res.visions.push(v); }
        }
        res.distinct = res.dNormal >= opts.threshold;
        res.conflict = res.distinct && res.visions.length > 0;
        return res;
    }
    E.compare = compare;

    // ---------- couleurs du document (description neutre) ----------
    // spec : {space:'RGB', v:[r,g,b]} | {space:'CMYK', v:[c,m,y,k]} | {space:'GRAY', v:[g]}
    //        | {space:'SPOT', name, tint, base:spec}   (g Illustrator : 0 = blanc, 100 = noir)
    function keyOf(spec) {
        if (spec.space === 'SPOT') { return 'SPOT:' + spec.name + '@' + round(spec.tint, 1); }
        var s = spec.space + ':';
        for (var i = 0; i < spec.v.length; i++) { s += (i ? ',' : '') + round(spec.v[i], 1); }
        return s;
    }
    E.keyOf = keyOf;
    // Conversion CMJN approximative quand Illustrator ne peut pas convertir (tests, repli)
    function naiveCmyk(v) {
        var k = v[3] / 100;
        return [255 * (1 - v[0] / 100) * (1 - k), 255 * (1 - v[1] / 100) * (1 - k), 255 * (1 - v[2] / 100) * (1 - k)];
    }
    E.naiveCmyk = naiveCmyk;
    // conv = { cmykToRgb: function(v)->[r,g,b] } fourni par Illustrator ou par les tests
    function specToRgb(spec, conv) {
        if (spec.space === 'RGB') { return [spec.v[0], spec.v[1], spec.v[2]]; }
        if (spec.space === 'GRAY') { var gv = 255 * (1 - spec.v[0] / 100); return [gv, gv, gv]; }
        if (spec.space === 'CMYK') { return (conv && conv.cmykToRgb) ? conv.cmykToRgb(spec.v) : naiveCmyk(spec.v); }
        if (spec.space === 'LAB') { return labToRgb(spec.v).rgb; }
        if (spec.space === 'SPOT') {
            var t = clamp(spec.tint, 0, 100) / 100, b = spec.base;
            if (b.space === 'CMYK') { return specToRgb({ space: 'CMYK', v: [b.v[0] * t, b.v[1] * t, b.v[2] * t, b.v[3] * t] }, conv); }
            if (b.space === 'GRAY') { return specToRgb({ space: 'GRAY', v: [b.v[0] * t] }, conv); }
            var full = specToRgb(b, conv);
            return [255 - (255 - full[0]) * t, 255 - (255 - full[1]) * t, 255 - (255 - full[2]) * t];
        }
        return [0, 0, 0];
    }
    E.specToRgb = specToRgb;
    function describe(spec, fr) {
        var v = spec.v, r = Math.round;
        if (spec.space === 'SPOT') { return spec.name + (spec.tint < 99.95 ? ' ' + round(spec.tint, 0) + ' %' : ''); }
        if (spec.space === 'RGB') { return (fr ? 'R' : 'R') + r(v[0]) + (fr ? ' V' : ' G') + r(v[1]) + ' B' + r(v[2]); }
        if (spec.space === 'CMYK') { return 'C' + r(v[0]) + ' M' + r(v[1]) + (fr ? ' J' : ' Y') + r(v[2]) + (fr ? ' N' : ' K') + r(v[3]); }
        if (spec.space === 'GRAY') { return (fr ? 'Gris ' : 'Grey ') + r(v[0]) + ' %'; }
        return '?';
    }
    E.describe = describe;
    function hex(rgb) {
        var s = '#';
        for (var i = 0; i < 3; i++) { var h = Math.round(clamp(rgb[i], 0, 255)).toString(16); s += (h.length < 2 ? '0' : '') + h; }
        return s.toUpperCase();
    }
    E.hex = hex;

    // ---------- géométrie / geometry ----------
    // Aplatit un tracé Bézier. pts : [{a:[x,y], l:[x,y], r:[x,y]}]
    function flatten(pts, closed, tolPt) {
        var out = [], n = pts.length, tol = tolPt || 0.25;
        if (!n) { return out; }
        out.push([pts[0].a[0], pts[0].a[1]]);
        var last = closed ? n : n - 1;
        for (var i = 0; i < last; i++) {
            var p0 = pts[i].a, p1 = pts[i].r, q = pts[(i + 1) % n], p2 = q.l, p3 = q.a;
            var straight = p1[0] === p0[0] && p1[1] === p0[1] && p2[0] === p3[0] && p2[1] === p3[1];
            if (straight) { out.push([p3[0], p3[1]]); continue; }
            // nombre de pas selon la longueur du polygone de contrôle / steps from control polygon length
            var len = Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2)) + Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)) + Math.sqrt(Math.pow(p3[0] - p2[0], 2) + Math.pow(p3[1] - p2[1], 2));
            var steps = clamp(Math.ceil(Math.sqrt(len / tol) * 0.7), 2, 64);
            for (var s = 1; s <= steps; s++) {
                var t = s / steps, u = 1 - t;
                var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
                out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
            }
        }
        if (closed && out.length > 1) { var f = out[0], z = out[out.length - 1]; if (f[0] === z[0] && f[1] === z[1]) { out.pop(); } }
        return out;
    }
    E.flatten = flatten;
    function boxOf(rings, grow) {
        var l = 1e15, b = 1e15, r = -1e15, t = -1e15, g = grow || 0;
        for (var i = 0; i < rings.length; i++) { for (var j = 0; j < rings[i].length; j++) {
            var p = rings[i][j]; if (p[0] < l) { l = p[0]; } if (p[0] > r) { r = p[0]; } if (p[1] < b) { b = p[1]; } if (p[1] > t) { t = p[1]; }
        } }
        return [l - g, b - g, r + g, t + g];
    }
    E.boxOf = boxOf;
    function boxesMeet(a, b, d) { return a[0] - d <= b[2] && b[0] - d <= a[2] && a[1] - d <= b[3] && b[1] - d <= a[3]; }
    E.boxesMeet = boxesMeet;
    // Distance point-segment, renvoie [distance, x, y du point le plus proche]
    function ptSeg(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = 0;
        if (L > 0) { t = clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1); }
        var x = ax + t * dx, y = ay + t * dy;
        return [Math.sqrt((px - x) * (px - x) + (py - y) * (py - y)), x, y];
    }
    // Distance entre segments [d, mx, my] (point milieu de la plus courte liaison)
    function segSeg(a, b, c, d) {
        var r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
        if (r !== 0) {
            var t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r;
            var u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { return [0, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }
        }
        var best = null, q, k;
        var cands = [[a, c, d, 0], [b, c, d, 0], [c, a, b, 1], [d, a, b, 1]];
        for (k = 0; k < 4; k++) {
            var P = cands[k][0], S1 = cands[k][1], S2 = cands[k][2];
            q = ptSeg(P[0], P[1], S1[0], S1[1], S2[0], S2[1]);
            if (!best || q[0] < best[0]) { best = [q[0], (P[0] + q[1]) / 2, (P[1] + q[2]) / 2]; }
        }
        return best;
    }
    E.segSeg = segSeg;
    // Point dans un ensemble d'anneaux (règle pair-impair ou non nulle)
    function inRings(x, y, rings, evenodd) {
        var wind = 0, cross = 0;
        for (var i = 0; i < rings.length; i++) {
            var R = rings[i], n = R.length;
            for (var j = 0, k = n - 1; j < n; k = j++) {
                var yi = R[j][1], yk = R[k][1];
                if ((yi > y) !== (yk > y)) {
                    var xi = R[j][0], xk = R[k][0], xc = xk + (y - yk) * (xi - xk) / (yi - yk);
                    if (x < xc) { cross++; wind += (yi > yk) ? 1 : -1; }
                }
            }
        }
        return evenodd ? (cross % 2 === 1) : (wind !== 0);
    }
    E.inRings = inRings;
    // Segments d'une forme / segments of a shape
    function segsOf(sh) {
        if (sh._segs) { return sh._segs; }
        var out = [];
        for (var i = 0; i < sh.rings.length; i++) {
            var R = sh.rings[i], n = R.length, m = (sh.area || sh.closedLoop) ? n : n - 1;
            if (n === 1) { out.push([R[0], R[0]]); }
            for (var j = 0; j < m; j++) {
                var p = R[j], q = R[(j + 1) % n];
                out.push([p, q, Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]);
            }
        }
        for (var s = 0; s < out.length; s++) { if (out[s].length < 3) { var a = out[s][0]; out[s] = [a, a, a[0], a[1], a[0], a[1]]; } }
        sh._segs = out; return out;
    }
    // Les formes A et B se touchent-elles (à tol près, demi-épaisseurs de contour comprises) ?
    // shape : {rings:[[...]], area:bool (surface remplie), hw: demi-épaisseur, evenodd, box, accept(x,y)}
    // Renvoie null ou [x, y] (un point de contact accepté par les deux formes)
    function touch(A, B, tol) {
        var lim = tol + (A.hw || 0) + (B.hw || 0);
        if (!boxesMeet(A.box, B.box, lim)) { return null; }
        function ok(x, y) { return (!A.accept || A.accept(x, y)) && (!B.accept || B.accept(x, y)); }
        var sa = segsOf(A), sb = segsOf(B), i, j;
        for (i = 0; i < sa.length; i++) {
            var s = sa[i];
            if (s[2] - lim > B.box[2] || s[4] + lim < B.box[0] || s[3] - lim > B.box[3] || s[5] + lim < B.box[1]) { continue; }
            for (j = 0; j < sb.length; j++) {
                var t = sb[j];
                if (s[2] - lim > t[4] || t[2] - lim > s[4] || s[3] - lim > t[5] || t[3] - lim > s[5]) { continue; }
                var d = segSeg(s[0], s[1], t[0], t[1]);
                if (d[0] <= lim && ok(d[1], d[2])) { return [d[1], d[2]]; }
            }
        }
        // inclusion sans bord commun / containment without a shared edge
        var pairs = [[A, B], [B, A]];
        for (var k = 0; k < 2; k++) {
            var In = pairs[k][0], Out = pairs[k][1];
            if (!Out.area) { continue; }
            for (i = 0; i < In.rings.length; i++) {
                var R = In.rings[i], step = Math.max(1, Math.floor(R.length / 16));
                for (j = 0; j < R.length; j += step) {
                    if (inRings(R[j][0], R[j][1], Out.rings, Out.evenodd) && ok(R[j][0], R[j][1])) { return [R[j][0], R[j][1]]; }
                }
            }
        }
        return null;
    }
    E.touch = touch;

    // Paires de formes voisines (balayage sur x) / neighbouring shape pairs (sweep on x)
    // filter(i, j) -> bool (faux = ne pas tester). progress(k, n) facultatif.
    function neighbours(shapes, tol, filter, progress) {
        var idx = [], i, out = [];
        for (i = 0; i < shapes.length; i++) { idx.push(i); }
        idx.sort(function (a, b) { return shapes[a].box[0] - shapes[b].box[0]; });
        for (var p = 0; p < idx.length; p++) {
            var A = shapes[idx[p]], reachA = A.box[2] + tol + (A.hw || 0) + 50;
            if (progress && p % 50 === 0) { progress(p, idx.length); }
            for (var q = p + 1; q < idx.length; q++) {
                var B = shapes[idx[q]];
                if (B.box[0] > reachA + (B.hw || 0)) { break; }
                var a = idx[p], b = idx[q];
                if (filter && !filter(a, b)) { continue; }
                var pt = touch(A, B, tol);
                if (pt) { out.push({ a: Math.min(a, b), b: Math.max(a, b), pt: pt }); }
            }
        }
        return out;
    }
    E.neighbours = neighbours;

    // ---------- analyse / analysis ----------
    // paints : [{key, spec, kind:'fill'|'stroke'|'text', obj, shape, sep:{key,spec,width}|null}]
    // colors : {key: {spec, rgb, prof, count, area}}
    // opts : {visions, severity, threshold, grayThreshold, tol, sepWidth, useSep, textOnBg, palette}
    function buildColors(paints, opts, conv) {
        var colors = {}, list = [];
        function addColor(key, spec, area) {
            if (!colors[key]) {
                var rgb = specToRgb(spec, conv);
                colors[key] = { key: key, spec: spec, rgb: rgb, prof: profile(rgb, opts), count: 0, area: 0 };
                list.push(key);
            }
            colors[key].count += area === undefined ? 0 : 1; colors[key].area += area || 0;
        }
        for (var i = 0; i < paints.length; i++) {
            var P = paints[i], bx = P.shape.box;
            addColor(P.key, P.spec, Math.max(1, (bx[2] - bx[0]) * (bx[3] - bx[1])));
            if (P.sep) { addColor(P.sep.key, P.sep.spec); }
        }
        return { map: colors, keys: list };
    }
    E.buildColors = buildColors;

    function pairKey(k1, k2) { return k1 < k2 ? k1 + '||' + k2 : k2 + '||' + k1; }
    E.pairKey = pairKey;

    // Un contour net sépare-t-il deux zones ? / does a clear stroke separate two areas?
    function separated(P, Q, colors, opts) {
        if (!opts.useSep) { return false; }
        var cand = [P.sep, Q.sep];
        for (var i = 0; i < 2; i++) {
            var s = cand[i];
            if (!s || s.width < opts.sepWidth) { continue; }
            var ps = colors.map[s.key].prof;
            var c1 = compare(ps, colors.map[P.key].prof, opts), c2 = compare(ps, colors.map[Q.key].prof, opts);
            if (c1.visions.length === 0 && c2.visions.length === 0 && c1.distinct && c2.distinct) { return true; }
        }
        return false;
    }
    E.separated = separated;

    function analyse(paints, opts, conv, progress) {
        var colors = buildColors(paints, opts, conv), pairs = {}, order = [], i;
        var stats = { paints: paints.length, colors: colors.keys.length, contacts: 0, separatedContacts: 0, similarForAll: 0 };
        function getPair(k1, k2) {
            var pk = pairKey(k1, k2);
            if (!pairs[pk]) {
                var A = k1 < k2 ? k1 : k2, B = k1 < k2 ? k2 : k1;
                pairs[pk] = { id: pk, a: A, b: B, cmp: compare(colors.map[A].prof, colors.map[B].prof, opts), contacts: [], separated: 0, paintIdx: {} };
                order.push(pk);
            }
            return pairs[pk];
        }
        if (opts.palette) {
            // seules les couleurs réellement peintes (pas celles des contours séparateurs seuls)
            var byKey = {}, painted = [];
            for (i = 0; i < paints.length; i++) { var pk0 = paints[i].key; if (!byKey[pk0]) { byKey[pk0] = []; painted.push(pk0); } byKey[pk0].push(i); }
            for (i = 0; i < painted.length; i++) {
                for (var j = i + 1; j < painted.length; j++) {
                    var PR = getPair(painted[i], painted[j]), z;
                    for (z = 0; z < byKey[painted[i]].length; z++) { PR.paintIdx[byKey[painted[i]][z]] = true; }
                    for (z = 0; z < byKey[painted[j]].length; z++) { PR.paintIdx[byKey[painted[j]][z]] = true; }
                }
            }
        } else {
            var shapes = [];
            for (i = 0; i < paints.length; i++) { shapes.push(paints[i].shape); }
            var nb = neighbours(shapes, opts.tol, function (a, b) {
                var P = paints[a], Q = paints[b];
                if (P.key === Q.key) { return false; }
                if (P.obj === Q.obj && P.obj !== undefined) { return false; }       // fond et contour du même objet
                if (P.kind === 'text' && Q.kind === 'text') { return false; }
                if ((P.kind === 'text' || Q.kind === 'text') && !opts.textOnBg) { return false; }
                if (P.kind === 'text' && Q.kind !== 'fill') { return false; }
                if (Q.kind === 'text' && P.kind !== 'fill') { return false; }
                return true;
            }, progress);
            for (i = 0; i < nb.length; i++) {
                var c = nb[i], P2 = paints[c.a], Q2 = paints[c.b], pr = getPair(P2.key, Q2.key);
                stats.contacts++;
                if (P2.kind === 'fill' && Q2.kind === 'fill' && separated(P2, Q2, colors, opts)) { pr.separated++; stats.separatedContacts++; continue; }
                pr.contacts.push({ pt: c.pt, a: c.a, b: c.b });
                pr.paintIdx[c.a] = true; pr.paintIdx[c.b] = true;
            }
        }
        var conflicts = [];
        for (i = 0; i < order.length; i++) {
            var X = pairs[order[i]];
            if (!opts.palette && X.contacts.length === 0) { continue; }
            if (!X.cmp.distinct) { stats.similarForAll++; continue; }
            if (X.cmp.conflict) { conflicts.push(X); }
        }
        conflicts.sort(function (p, q) { return p.cmp.minSim - q.cmp.minSim; });
        return { colors: colors, pairs: pairs, order: order, conflicts: conflicts, stats: stats };
    }
    E.analyse = analyse;

    // Voisins d'une couleur (paires dont au moins un contact non séparé, ou toutes en mode palette)
    function neighbourKeys(res, key) {
        var out = [];
        for (var i = 0; i < res.order.length; i++) {
            var X = res.pairs[res.order[i]];
            if (!res.palette && X.contacts.length === 0) { continue; }
            if (X.a === key) { out.push(X.b); } else if (X.b === key) { out.push(X.a); }
        }
        return out;
    }
    E.neighbourKeys = neighbourKeys;

    // ---------- correction / fixing ----------
    // Candidats de remplacement dans le même espace colorimétrique / replacement candidates
    function candidates(spec) {
        var out = [], i, j;
        if (spec.space === 'RGB') {
            var lab = rgbToLab(spec.v), L = lab[0], C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]), h = Math.atan2(lab[2], lab[1]);
            var cf = [1, 0.8, 1.2, 0.6, 1.4], hs = [0, 10, -10, 20, -20];
            for (var dL = -70; dL <= 70; dL += 2) {
                var L2 = L + dL; if (L2 < 0 || L2 > 100) { continue; }
                for (i = 0; i < cf.length; i++) { for (j = 0; j < hs.length; j++) {
                    if (C < 3 && (i > 0 || j > 0)) { continue; }
                    var C2 = C * cf[i], h2 = h + hs[j] * Math.PI / 180;
                    var r = labToRgb([L2, C2 * Math.cos(h2), C2 * Math.sin(h2)]);
                    if (!r.inGamut && (i > 0 || j > 0)) { continue; }
                    out.push({ space: 'RGB', v: [Math.round(r.rgb[0]), Math.round(r.rgb[1]), Math.round(r.rgb[2])] });
                } }
            }
        } else if (spec.space === 'CMYK') {
            var v = spec.v, sc, ak, ss;
            for (sc = 0.2; sc <= 1.6001; sc += 0.05) {
                for (ak = 0; ak <= 70; ak += 5) {
                    var c = [clamp(v[0] * sc, 0, 100), clamp(v[1] * sc, 0, 100), clamp(v[2] * sc, 0, 100), clamp(v[3] * (sc < 1 ? sc : 1) + ak, 0, 100)];
                    out.push({ space: 'CMYK', v: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(c[3])] });
                }
            }
            // déplacements de teinte légers : une encre en plus ou en moins / small hue moves
            for (i = 0; i < 3; i++) { for (ss = -30; ss <= 30; ss += 10) { if (!ss) { continue; }
                var w = [v[0], v[1], v[2], v[3]]; w[i] = clamp(w[i] + ss, 0, 100);
                for (ak = 0; ak <= 40; ak += 10) { out.push({ space: 'CMYK', v: [Math.round(w[0]), Math.round(w[1]), Math.round(w[2]), Math.round(clamp(w[3] + ak, 0, 100))] }); }
            } }
        } else if (spec.space === 'GRAY') {
            for (i = 0; i <= 100; i++) { out.push({ space: 'GRAY', v: [i] }); }
        } else if (spec.space === 'SPOT') {
            for (i = 5; i <= 100; i++) { out.push({ space: 'SPOT', name: spec.name, tint: i, base: spec.base }); }
        }
        return out;
    }
    E.candidates = candidates;

    // Meilleure retouche d'une couleur face à des voisins (Lab/profils actuels)
    // current : {key: prof} profils actuels (avec retouches déjà prévues) ; neighbours : [key]
    function bestFix(spec, neigh, current, opts, conv, maxChange) {
        var orig = rgbToLab(specToRgb(spec, conv)), cands = candidates(spec), seen = {}, list = [], i;
        var margin = opts.fixMargin === undefined ? 1.5 : opts.fixMargin;
        var o2 = { visions: opts.visions, severity: opts.severity, threshold: opts.threshold + margin, grayThreshold: opts.grayThreshold + margin };
        // 1) écart de chaque candidat à la couleur d'origine, 2) on teste du plus proche au plus loin
        for (i = 0; i < cands.length; i++) {
            var k = keyOf(cands[i]); if (seen[k]) { continue; } seen[k] = true;
            var rgb = specToRgb(cands[i], conv), change = dE00(orig, rgbToLab(rgb));
            if (change <= maxChange) { list.push({ spec: cands[i], key: k, rgb: rgb, change: change }); }
        }
        list.sort(function (p, q) { return p.change - q.change; });
        for (i = 0; i < list.length; i++) {
            var pc = profile(list[i].rgb, opts), ok = true;
            for (var j = 0; j < neigh.length && ok; j++) {
                var cmp = compare(pc, current[neigh[j]], o2);
                if (!cmp.distinct || cmp.visions.length) { ok = false; }
            }
            if (ok) { list[i].prof = pc; return list[i]; }
        }
        return null;
    }
    E.bestFix = bestFix;

    // Plan de corrections pour une liste de conflits (gloutonne, couleur la moins utilisée d'abord)
    // locked(key) -> vrai si la couleur ne doit pas être retouchée
    function planFixes(res, conflictList, opts, conv, maxChange, locked, prefer) {
        var current = {}, plan = {}, i, k, out = [];
        for (i = 0; i < res.colors.keys.length; i++) { k = res.colors.keys[i]; current[k] = res.colors.map[k].prof; }
        res.palette = !!opts.palette;
        for (i = 0; i < conflictList.length; i++) {
            var X = conflictList[i];
            var cmp = compare(current[X.a], current[X.b], opts);
            if (!cmp.conflict) { out.push({ pair: X, status: 'solved' }); continue; }
            var A = res.colors.map[X.a], B = res.colors.map[X.b], first, second;
            if (prefer && prefer[X.id]) { first = prefer[X.id] === 'a' ? A : B; second = first === A ? B : A; }
            else { first = (A.area <= B.area) ? A : B; second = first === A ? B : A; }
            var tries = [first, second], done = false;
            for (var t = 0; t < 2 && !done; t++) {
                var C = tries[t];
                if (locked && locked(C.key)) { continue; }
                var fx = bestFix(C.spec, neighbourKeys(res, C.key), current, opts, conv, maxChange);
                if (fx) {
                    plan[C.key] = { from: C, spec: fx.spec, key: fx.key, change: fx.change, rgb: fx.rgb };
                    current[C.key] = fx.prof; done = true;
                    out.push({ pair: X, status: 'fixed', color: C.key, to: fx });
                }
            }
            if (!done) { out.push({ pair: X, status: 'nofix' }); }
        }
        // vérification finale de toutes les paires voisines / final check of all neighbour pairs
        var remaining = 0;
        for (i = 0; i < res.order.length; i++) {
            var Y = res.pairs[res.order[i]];
            if (!opts.palette && Y.contacts.length === 0) { continue; }
            if (compare(current[Y.a], current[Y.b], opts).conflict) { remaining++; }
        }
        return { plan: plan, steps: out, remaining: remaining };
    }
    E.planFixes = planFixes;

    // ---------- textes de l'interface / UI strings ----------
    E.VISION_NAMES = {
        fr: { protan: 'protanopie (rouge)', deutan: 'deutéranopie (vert)', tritan: 'tritanopie (bleu)', gray: 'noir et blanc' },
        en: { protan: 'protanopia (red)', deutan: 'deuteranopia (green)', tritan: 'tritanopia (blue)', gray: 'black & white' }
    };
    // </ENGINE>
    return E;
})();

// =========================================================================================
// Partie Illustrator / Illustrator part
// =========================================================================================
var CDV_UI = (function (E) {
    var FR = true;
    try { FR = String(app.locale || $.locale || 'fr').toLowerCase().indexOf('fr') === 0; } catch (eLoc) { FR = true; }
    function T(fr, en) { return FR ? fr : en; }
    var MM = 72 / 25.4;
    var LAYER_NAME = T('Daltonisme – contrôle', 'Colour blindness – check');

    // --- conversion CMJN par Illustrator (profil du document) / CMYK conversion by Illustrator ---
    var convCache = {};
    var CONV = {
        cmykToRgb: function (v) {
            var k = v[0] + ',' + v[1] + ',' + v[2] + ',' + v[3];
            if (convCache[k]) { return convCache[k]; }
            var out = null;
            try {
                var r = app.convertSampleColor(ImageColorSpace.CMYK, [v[0], v[1], v[2], v[3]], ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose);
                if (r && r.length >= 3) { out = [Number(r[0]), Number(r[1]), Number(r[2])]; }
            } catch (e) { out = null; }
            if (!out) { out = E.naiveCmyk(v); }
            convCache[k] = out; return out;
        }
    };

    // --- lecture des couleurs Illustrator / reading Illustrator colours ---
    function specOf(col) {
        if (!col) { return null; }
        var tn = col.typename;
        if (tn === 'RGBColor') { return { space: 'RGB', v: [col.red, col.green, col.blue] }; }
        if (tn === 'CMYKColor') { return { space: 'CMYK', v: [col.cyan, col.magenta, col.yellow, col.black] }; }
        if (tn === 'GrayColor') { return { space: 'GRAY', v: [col.gray] }; }
        if (tn === 'SpotColor') {
            var base = specOf(col.spot.color);
            if (col.spot.color && col.spot.color.typename === 'LabColor') { var lc = col.spot.color; base = { space: 'LAB', v: [lc.l, lc.a, lc.b] }; }
            if (!base) { return null; }
            if (col.spot.name === '[Registration]' || col.spot.name === '[Repérage]') { return null; }
            return { space: 'SPOT', name: col.spot.name, tint: col.tint, base: base, global: true };
        }
        return null; // dégradé, motif, aucune / gradient, pattern, none
    }
    function makeColor(spec, original) {
        var c;
        if (spec.space === 'RGB') { c = new RGBColor(); c.red = spec.v[0]; c.green = spec.v[1]; c.blue = spec.v[2]; return c; }
        if (spec.space === 'CMYK') { c = new CMYKColor(); c.cyan = spec.v[0]; c.magenta = spec.v[1]; c.yellow = spec.v[2]; c.black = spec.v[3]; return c; }
        if (spec.space === 'GRAY') { c = new GrayColor(); c.gray = spec.v[0]; return c; }
        if (spec.space === 'SPOT') { c = new SpotColor(); c.spot = original.spot; c.tint = spec.tint; return c; }
        return null;
    }

    // --- visibilité / verrouillage hérités / inherited visibility & lock ---
    function hiddenOrLocked(it, skipLocked) {
        var p = it;
        while (p && p.typename !== 'Document') {
            if (p.typename === 'Layer') { if (!p.visible) { return 'hidden'; } if (skipLocked && p.locked) { return 'locked'; } }
            else { if (p.hidden) { return 'hidden'; } if (skipLocked && p.locked) { return 'locked'; } }
            p = p.parent;
        }
        return null;
    }
    function ptsOf(pi) {
        var out = [], pp = pi.pathPoints;
        for (var i = 0; i < pp.length; i++) { var q = pp[i]; out.push({ a: q.anchor, l: q.leftDirection, r: q.rightDirection }); }
        return out;
    }
    // masque d'écrêtage le plus proche / nearest clipping mask
    function clipAcceptOf(it) {
        var p = it.parent;
        while (p && p.typename === 'GroupItem') {
            if (p.clipped) {
                for (var i = 0; i < p.pageItems.length; i++) {
                    var c = p.pageItems[i];
                    if (c.typename === 'PathItem' && c.clipping) {
                        var rings = [E.flatten(ptsOf(c), true, 0.5)];
                        return function (x, y) { return E.inRings(x, y, rings, false); };
                    }
                    if (c.typename === 'CompoundPathItem' && c.pathItems.length && c.pathItems[0].clipping) {
                        var rr = [];
                        for (var j = 0; j < c.pathItems.length; j++) { rr.push(E.flatten(ptsOf(c.pathItems[j]), true, 0.5)); }
                        return function (x, y) { return E.inRings(x, y, rr, true); };
                    }
                }
                return null;
            }
            p = p.parent;
        }
        return null;
    }

    // Collecte des peintures / collect paints
    // scope : 'selection' | 'artboard' | 'document'
    function collect(doc, scope, opts) {
        var paints = [], skipped = { gradient: 0, other: 0, hidden: 0, locked: 0 }, objs = [], ab = null, seen = {};
        if (scope === 'artboard') { ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; }
        function inAb(it) {
            if (!ab) { return true; }
            var b = it.visibleBounds; // [g, h, d, b]
            return b[0] <= ab[2] && b[2] >= ab[0] && b[3] <= ab[1] && b[1] >= ab[3];
        }
        function addObj(it) { objs.push(it); return objs.length - 1; }
        function paintFromPath(it, owner, ringsSrc, evenodd, objId, accept) {
            var first = ringsSrc[0];
            var rings = [];
            for (var i = 0; i < ringsSrc.length; i++) { var pts = ptsOf(ringsSrc[i]); if (pts.length) { rings.push(E.flatten(pts, ringsSrc[i].closed || first.filled, 0.3)); } }
            if (!rings.length) { return; }
            var fillSpec = first.filled ? specOf(first.fillColor) : null;
            var strokeSpec = (first.stroked && first.strokeWidth > 0) ? specOf(first.strokeColor) : null;
            if (first.filled && !fillSpec && first.fillColor && first.fillColor.typename !== 'NoColor') { skipped.gradient++; }
            if (first.stroked && !strokeSpec && first.strokeColor && first.strokeColor.typename !== 'NoColor') { skipped.gradient++; }
            var sep = strokeSpec ? { key: E.keyOf(strokeSpec), spec: strokeSpec, width: first.strokeWidth } : null;
            if (fillSpec) {
                var shF = { rings: rings, area: true, hw: 0, evenodd: evenodd, box: E.boxOf(rings), accept: accept };
                paints.push({ key: E.keyOf(fillSpec), spec: fillSpec, kind: 'fill', obj: objId, item: owner, prop: 'fill', shape: shF, sep: sep });
            }
            if (strokeSpec) {
                var hw = first.strokeWidth / 2;
                var shS = { rings: rings, area: false, hw: hw, evenodd: evenodd, box: E.boxOf(rings, hw), accept: accept };
                // un tracé fermé contouré : on le parcourt en boucle / closed stroked path: walk as a loop
                if (first.closed) { shS.closedLoop = true; }
                paints.push({ key: E.keyOf(strokeSpec), spec: strokeSpec, kind: 'stroke', obj: objId, item: owner, prop: 'stroke', shape: shS, sep: null });
            }
        }
        function visit(it) {
            if (seen[it.uuid || ''] && it.uuid) { return; }
            if (it.uuid) { seen[it.uuid] = true; }
            var hl = hiddenOrLocked(it, opts.skipLocked);
            if (hl === 'hidden') { skipped.hidden++; return; }
            if (hl === 'locked') { skipped.locked++; return; }
            var tn = it.typename;
            if (tn === 'GroupItem') { for (var i = 0; i < it.pageItems.length; i++) { visit(it.pageItems[i]); } return; }
            if (tn === 'PathItem') {
                if (it.guides || it.clipping || !inAb(it)) { return; }
                paintFromPath(it, it, [it], !!it.evenodd, addObj(it), clipAcceptOf(it)); return;
            }
            if (tn === 'CompoundPathItem') {
                if (!it.pathItems.length || it.pathItems[0].clipping || it.pathItems[0].guides || !inAb(it)) { return; }
                var subs = []; for (var j = 0; j < it.pathItems.length; j++) { subs.push(it.pathItems[j]); }
                paintFromPath(it, it, subs, !!it.pathItems[0].evenodd, addObj(it), clipAcceptOf(it)); return;
            }
            if (tn === 'TextFrame') {
                if (!inAb(it) || !opts.textOnBg) { return; }
                var b = it.visibleBounds, oid = addObj(it), keys = {}, runs = it.textRanges;
                var rings = [[[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]]];
                for (var k = 0; k < runs.length; k++) {
                    var tr = runs[k], sp = null;
                    try { if (tr.length === 0 || /^\s*$/.test(tr.contents)) { continue; } sp = specOf(tr.characterAttributes.fillColor); } catch (eTr) { sp = null; }
                    if (!sp) { continue; }
                    var key = E.keyOf(sp); if (keys[key]) { continue; } keys[key] = true;
                    paints.push({ key: key, spec: sp, kind: 'text', obj: oid, item: it, prop: 'text', shape: { rings: rings, area: true, hw: 0, box: E.boxOf(rings), accept: clipAcceptOf(it) }, sep: null });
                }
                return;
            }
            skipped.other++;
        }
        var i;
        if (scope === 'selection') { var sel = doc.selection; for (i = 0; i < sel.length; i++) { visit(sel[i]); } }
        else {
            for (i = 0; i < doc.layers.length; i++) { visitLayer(doc.layers[i]); }
        }
        function visitLayer(L) {
            if (!L.visible) { return; }
            if (opts.skipLocked && L.locked) { return; }
            if (L.name === LAYER_NAME) { return; }
            if (opts.skipNonPrinting && !L.printable) { return; }
            for (var a = 0; a < L.pageItems.length; a++) {
                // enfants directs seulement (comparaison par type et nom : les références DOM ne se comparent pas toujours)
                var par = L.pageItems[a].parent;
                if (par && par.typename === 'Layer' && par.name === L.name) { visit(L.pageItems[a]); }
            }
            for (var b2 = 0; b2 < L.layers.length; b2++) { visitLayer(L.layers[b2]); }
        }
        return { paints: paints, skipped: skipped, objs: objs };
    }

    // --- actions sur le document / document actions ---
    function itemsOfPair(res, X, paints) {
        var out = [], seenObj = {};
        for (var k in X.paintIdx) { if (X.paintIdx.hasOwnProperty(k)) {
            var P = paints[Number(k)];
            if (P.key !== X.a && P.key !== X.b) { continue; }
            if (!seenObj[P.obj]) { seenObj[P.obj] = true; out.push(P.item); }
        } }
        return out;
    }
    function selectItems(doc, items) {
        var n = 0; doc.selection = null;
        for (var i = 0; i < items.length; i++) { try { if (!items[i].locked) { items[i].selected = true; n++; } } catch (e) { } }
        return n;
    }
    function getMarkLayer(doc) {
        var L = null;
        try { L = doc.layers.getByName(LAYER_NAME); } catch (e) { L = null; }
        if (L) { L.locked = false; L.visible = true; while (L.pageItems.length) { L.pageItems[0].remove(); } }
        else { L = doc.layers.add(); L.name = LAYER_NAME; }
        L.printable = false; L.zOrder(ZOrderMethod.BRINGTOFRONT);
        return L;
    }
    function markConflicts(doc, res, list, paints) {
        var L = getMarkLayer(doc), mag = new RGBColor(); mag.red = 255; mag.green = 0; mag.blue = 200;
        if (doc.documentColorSpace === DocumentColorSpace.CMYK) { mag = new CMYKColor(); mag.cyan = 0; mag.magenta = 100; mag.yellow = 0; mag.black = 0; }
        var n = 0, MAXM = 400;
        for (var i = 0; i < list.length && n < MAXM; i++) {
            var X = list[i], pts = X.contacts.length ? X.contacts : [];
            if (!pts.length && paints) {
                // mode palette : un repère au centre de chaque objet concerné / palette mode: mark object centres
                var its = itemsOfPair(res, X, paints);
                for (var q = 0; q < its.length && q < 24; q++) { var vb = its[q].visibleBounds; pts.push({ pt: [(vb[0] + vb[2]) / 2, (vb[1] + vb[3]) / 2] }); }
            }
            var step = Math.max(1, Math.floor(pts.length / 12));
            for (var j = 0; j < pts.length && n < MAXM; j += step) {
                var p = pts[j].pt, r = 7;
                var c = L.pathItems.ellipse(p[1] + r, p[0] - r, 2 * r, 2 * r);
                c.filled = false; c.stroked = true; c.strokeColor = mag; c.strokeWidth = 1.2;
                var t = L.textFrames.pointText([p[0] + r + 1, p[1] + r]);
                t.contents = String(i + 1); t.textRange.characterAttributes.size = 8; t.textRange.characterAttributes.fillColor = mag;
                n++;
            }
        }
        L.locked = true;
        return n;
    }
    function sameKey(col, key) { var s = specOf(col); return s ? E.keyOf(s) === key : false; }
    function applyPlan(paints, plan) {
        var changed = 0, failed = 0, done = {};
        for (var i = 0; i < paints.length; i++) {
            var P = paints[i], fx = plan[P.key];
            if (!fx) { continue; }
            var it = P.item, tag = P.obj + ':' + P.prop + ':' + P.key;
            if (done[tag]) { continue; } done[tag] = true;
            try {
                if (P.prop === 'text') {
                    var runs = it.textRanges;
                    for (var k = 0; k < runs.length; k++) { var ca = runs[k].characterAttributes; if (sameKey(ca.fillColor, P.key)) { ca.fillColor = makeColor(fx.spec, ca.fillColor); changed++; } }
                } else {
                    var targets = it.typename === 'CompoundPathItem' ? [it.pathItems[0]] : [it];
                    for (var t = 0; t < targets.length; t++) {
                        var pi = targets[t];
                        if (P.prop === 'fill' && sameKey(pi.fillColor, P.key)) { pi.fillColor = makeColor(fx.spec, pi.fillColor); changed++; }
                        if (P.prop === 'stroke' && sameKey(pi.strokeColor, P.key)) { pi.strokeColor = makeColor(fx.spec, pi.strokeColor); changed++; }
                    }
                }
            } catch (e) { failed++; }
        }
        return { changed: changed, failed: failed };
    }

    function visionList(cmp) {
        var names = E.VISION_NAMES[FR ? 'fr' : 'en'], s = [];
        for (var i = 0; i < cmp.visions.length; i++) { s.push(names[cmp.visions[i]]); }
        return s.join(', ');
    }
    function colorLabel(res, key) { var c = res.colors.map[key]; return E.describe(c.spec, FR) + ' (' + E.hex(c.rgb) + ')'; }
    function f1(v) { return String(Math.round(v * 10) / 10).replace('.', FR ? ',' : '.'); }

    function report(res, planRes, opts, docName) {
        var L = [], names = E.VISION_NAMES[FR ? 'fr' : 'en'];
        L.push('ConfusionsDaltonisme.jsx — ' + docName);
        L.push(T('Seuil ΔE 2000 : ', 'ΔE 2000 threshold: ') + opts.threshold + T(' ; noir et blanc : ', '; black & white: ') + opts.grayThreshold + T(' ; sévérité : ', '; severity: ') + Math.round(opts.severity * 100) + ' %');
        L.push(T('Couleurs analysées : ', 'Colours analysed: ') + res.stats.colors + T(' ; contacts : ', '; contacts: ') + res.stats.contacts + T(' ; séparés par un contour : ', '; separated by a stroke: ') + res.stats.separatedContacts);
        L.push('');
        for (var i = 0; i < res.conflicts.length; i++) {
            var X = res.conflicts[i];
            L.push((i + 1) + '. ' + colorLabel(res, X.a) + '  ↔  ' + colorLabel(res, X.b));
            var det = []; for (var v in X.cmp.d) { if (X.cmp.d.hasOwnProperty(v)) { det.push(names[v] + ' ' + f1(X.cmp.d[v])); } }
            L.push('   ' + T('ΔE normal ', 'normal ΔE ') + f1(X.cmp.dNormal) + ' ; ' + det.join(' ; '));
            L.push('   ' + T('Confondues pour : ', 'Confused for: ') + visionList(X.cmp) + (opts.palette ? '' : T(' ; contacts : ', '; contacts: ') + X.contacts.length));
        }
        if (planRes) {
            L.push(''); L.push(T('Corrections proposées :', 'Proposed fixes:'));
            for (var k in planRes.plan) { if (planRes.plan.hasOwnProperty(k)) { var p = planRes.plan[k]; L.push('   ' + colorLabel(res, k) + '  →  ' + E.describe(p.spec, FR) + ' (' + E.hex(p.rgb) + ')  ΔE ' + f1(p.change)); } }
        }
        return L.join('\n');
    }

    // ---------- fenêtres / dialogs ----------
    function settingsDialog(hasSel, prev) {
        var w = new Window('dialog', T('Confusions de couleurs pour les daltoniens', 'Colour confusions for colour-blind viewers'));
        w.orientation = 'column'; w.alignChildren = 'fill';
        var gS = w.add('panel', undefined, T('Où chercher', 'Where to look')); gS.orientation = 'row';
        var rSel = gS.add('radiobutton', undefined, T('Sélection', 'Selection'));
        var rAb = gS.add('radiobutton', undefined, T('Plan de travail actif', 'Active artboard'));
        var rDoc = gS.add('radiobutton', undefined, T('Document', 'Document'));
        rSel.enabled = hasSel; if (hasSel) { rSel.value = true; } else { rAb.value = true; }
        var gM = w.add('panel', undefined, T('Quelles couleurs comparer', 'Which colours to compare')); gM.alignChildren = 'left';
        var rNb = gM.add('radiobutton', undefined, T('Celles qui se touchent (cartes, schémas, emballages)', 'Those that touch (maps, diagrams, packaging)'));
        var gTol = gM.add('group'); gTol.add('statictext', undefined, T('   Écart maximal entre deux zones voisines (mm) :', '   Maximum gap between neighbouring areas (mm):'));
        var eTol = gTol.add('edittext', undefined, '1'); eTol.characters = 5;
        var cTxt = gM.add('checkbox', undefined, T('   Aussi le texte posé sur un fond coloré', '   Also text over a coloured background'));
        var cSep = gM.add('checkbox', undefined, T('   Un contour net autour d\'une zone la sépare de ses voisines', '   A clear stroke around an area separates it from its neighbours'));
        var gSw = gM.add('group'); gSw.add('statictext', undefined, T('      épaisseur minimale (pt) :', '      minimum weight (pt):'));
        var eSw = gSw.add('edittext', undefined, '0.75'); eSw.characters = 5;
        var rPal = gM.add('radiobutton', undefined, T('Toutes entre elles (graphique et sa légende, palette)', 'All against each other (chart and legend, palette)'));
        rNb.value = true; cTxt.value = true; cSep.value = true;
        var gV = w.add('panel', undefined, T('Visions à simuler', 'Visions to simulate')); gV.orientation = 'row';
        var vP = gV.add('checkbox', undefined, T('Protanopie', 'Protanopia')), vD = gV.add('checkbox', undefined, T('Deutéranopie', 'Deuteranopia'));
        var vT = gV.add('checkbox', undefined, T('Tritanopie', 'Tritanopia')), vG = gV.add('checkbox', undefined, T('Noir et blanc', 'Black & white'));
        vP.value = vD.value = vT.value = true; vG.value = false; // noir et blanc : à cocher pour une photocopie / B&W: tick for photocopies
        var gO = w.add('panel', undefined, T('Exigence', 'Strictness')); gO.alignChildren = 'left';
        var g1 = gO.add('group'); g1.add('statictext', undefined, T('Écart minimal ΔE 2000 :', 'Minimum ΔE 2000:'));
        var ddT = g1.add('dropdownlist', undefined, [T('Souple (7)', 'Lenient (7)'), T('Recommandé (10)', 'Recommended (10)'), T('Strict (14)', 'Strict (14)')]); ddT.selection = 1;
        var g2 = gO.add('group'); g2.add('statictext', undefined, T('Sévérité :', 'Severity:'));
        var ddS = g2.add('dropdownlist', undefined, [T('Forte : dichromatie (prudent)', 'Strong: dichromacy (safe)'), T('Moyenne : anomalie (≈ 60 %)', 'Medium: anomaly (≈ 60 %)')]); ddS.selection = 0;
        var cLock = gO.add('checkbox', undefined, T('Ignorer les objets et calques verrouillés', 'Skip locked objects and layers')); cLock.value = true;
        var cNP = gO.add('checkbox', undefined, T('Ignorer les calques non imprimables', 'Skip non-printing layers')); cNP.value = true;
        w.add('statictext', undefined, T('Conseil : travaillez sur une copie. Les corrections se défont avec Ctrl/Cmd+Z.', 'Tip: work on a copy. Fixes can be undone with Ctrl/Cmd+Z.'));
        var gB = w.add('group'); gB.alignment = 'right';
        var bC = gB.add('button', undefined, T('Annuler', 'Cancel'), { name: 'cancel' }), bOk = gB.add('button', undefined, T('Analyser', 'Analyse'), { name: 'ok' });
        function sync() { var nb = rNb.value; eTol.enabled = cTxt.enabled = cSep.enabled = nb; eSw.enabled = nb && cSep.value; }
        rNb.onClick = rPal.onClick = cSep.onClick = sync; sync();
        if (prev) { /* réservé : réglages précédents */ }
        if (w.show() !== 1) { return null; }
        var vis = []; if (vP.value) { vis.push('protan'); } if (vD.value) { vis.push('deutan'); } if (vT.value) { vis.push('tritan'); } if (vG.value) { vis.push('gray'); }
        var thr = [7, 10, 14][ddT.selection.index];
        var tol = parseFloat(String(eTol.text).replace(',', '.')); if (isNaN(tol) || tol < 0) { tol = 1; }
        var sw = parseFloat(String(eSw.text).replace(',', '.')); if (isNaN(sw) || sw < 0) { sw = 0.75; }
        return {
            scope: rSel.value ? 'selection' : (rAb.value ? 'artboard' : 'document'),
            palette: rPal.value, tol: tol * MM, textOnBg: cTxt.value, useSep: cSep.value, sepWidth: sw,
            visions: vis, threshold: thr, grayThreshold: thr, severity: ddS.selection.index === 0 ? 1 : 0.6,
            skipLocked: cLock.value, skipNonPrinting: cNP.value
        };
    }

    function resultsDialog(res, opts, planAll) {
        var w = new Window('dialog', T('Confusions trouvées : ', 'Confusions found: ') + res.conflicts.length);
        w.orientation = 'column'; w.alignChildren = 'fill';
        var lb = w.add('listbox', [0, 0, 820, 300], undefined, {
            multiselect: true, numberOfColumns: 5, showHeaders: true,
            columnTitles: ['#', T('Couleur A', 'Colour A'), T('Couleur B', 'Colour B'), T('Confondues pour (ΔE)', 'Confused for (ΔE)'), T('Correction proposée', 'Proposed fix')],
            columnWidths: [30, 170, 170, 250, 190]
        });
        var stepOf = {};
        for (var s = 0; s < planAll.steps.length; s++) { stepOf[planAll.steps[s].pair.id] = planAll.steps[s]; }
        for (var i = 0; i < res.conflicts.length; i++) {
            var X = res.conflicts[i], st = stepOf[X.id], fix = '';
            if (st && st.status === 'fixed') { fix = (st.color === X.a ? 'A' : 'B') + ' → ' + E.describe(st.to.spec, FR) + ' (ΔE ' + f1(st.to.change) + ')'; }
            else if (st && st.status === 'solved') { fix = T('réglée par une autre', 'solved by another'); }
            else if (st) { fix = T('aucune simple : contour, motif ou libellé', 'none simple: stroke, pattern or label'); }
            else { fix = T('calculée à l\'application', 'computed when applied'); }
            var it = lb.add('item', String(i + 1));
            it.subItems[0].text = colorLabel(res, X.a); it.subItems[1].text = colorLabel(res, X.b);
            it.subItems[2].text = visionList(X.cmp) + ' (' + f1(X.cmp.minSim) + ')'; it.subItems[3].text = fix;
            it.selected = true;
        }
        var st2 = w.add('statictext', undefined, T('ΔE normal = écart vu par une vision normale ; (n) = plus petit écart simulé. Les lignes sélectionnées sont traitées.', 'Normal ΔE = difference for normal vision; (n) = smallest simulated difference. Selected rows are processed.'), { multiline: true });
        st2.preferredSize = [820, 32];
        var gA = w.add('panel', undefined, T('Action sur les lignes sélectionnées', 'Action on selected rows')); gA.orientation = 'row';
        var aSel = gA.add('radiobutton', undefined, T('Sélectionner les objets', 'Select the objects'));
        var aMark = gA.add('radiobutton', undefined, T('Signaler (calque non imprimable)', 'Flag (non-printing layer)'));
        var aFix = gA.add('radiobutton', undefined, T('Appliquer les corrections', 'Apply the fixes'));
        aMark.value = true;
        var gB = w.add('group'); gB.alignment = 'right';
        var bRep = gB.add('button', undefined, T('Enregistrer le rapport…', 'Save report…'));
        var bC = gB.add('button', undefined, T('Fermer', 'Close'), { name: 'cancel' }), bOk = gB.add('button', undefined, T('Exécuter', 'Run'), { name: 'ok' });
        var out = { action: null, rows: [] };
        bRep.onClick = function () {
            var f = File.saveDialog(T('Enregistrer le rapport', 'Save report'), '*.txt');
            if (f) { f.encoding = 'UTF-8'; f.lineFeed = 'Windows'; if (f.open('w')) { f.write('\uFEFF' + report(res, planAll, opts, app.activeDocument.name)); f.close(); } }
        };
        if (w.show() !== 1) { return null; }
        for (var r = 0; r < lb.items.length; r++) { if (lb.items[r].selected) { out.rows.push(r); } }
        out.action = aSel.value ? 'select' : (aMark.value ? 'mark' : 'fix');
        return out;
    }

    function run() {
        if (!app.documents.length) { alert(T('Ouvrez un document puis relancez le script.', 'Open a document and run the script again.')); return; }
        var doc = app.activeDocument, sel = doc.selection, hasSel = sel && sel.length > 0 && sel.typename !== 'TextRange';
        var opts = settingsDialog(hasSel);
        if (!opts) { return; }
        if (!opts.visions.length) { alert(T('Cochez au moins une vision à simuler.', 'Tick at least one vision to simulate.')); return; }
        var col = collect(doc, opts.scope, opts);
        if (!col.paints.length) {
            alert(T('Aucun objet coloré à analyser (couleurs unies, tons directs ou textes) dans la zone choisie.', 'No coloured object to analyse (solid colours, spot colours or text) in the chosen scope.'));
            return;
        }
        if (col.paints.length > 6000 && !confirm(T('Il y a ' + col.paints.length + ' zones colorées : l\'analyse peut être longue. Continuer ?', 'There are ' + col.paints.length + ' coloured areas: analysis may take a while. Continue?'))) { return; }
        var res = E.analyse(col.paints, opts, CONV);
        res.palette = !!opts.palette;
        var skippedTxt = '';
        if (col.skipped.gradient) { skippedTxt += '\n' + T('Dégradés et motifs non analysés : ', 'Gradients and patterns not analysed: ') + col.skipped.gradient; }
        if (col.skipped.other) { skippedTxt += '\n' + T('Images, symboles et autres objets non analysés : ', 'Images, symbols and other objects not analysed: ') + col.skipped.other; }
        if (!res.conflicts.length) {
            alert(T('Aucune confusion trouvée.', 'No confusion found.') + '\n' + T('Couleurs : ', 'Colours: ') + res.stats.colors + T(' ; contacts testés : ', '; contacts tested: ') + res.stats.contacts +
                (res.stats.separatedContacts ? '\n' + T('Contacts séparés par un contour : ', 'Contacts separated by a stroke: ') + res.stats.separatedContacts : '') +
                (res.stats.similarForAll ? '\n' + T('Paires déjà proches pour tout le monde (non comptées) : ', 'Pairs already close for everyone (not counted): ') + res.stats.similarForAll : '') + skippedTxt);
            return;
        }
        var locked = function (key) { return false; };
        var planAll = E.planFixes(res, res.conflicts.length > 80 ? res.conflicts.slice(0, 80) : res.conflicts, opts, CONV, 25, locked);
        var choice = resultsDialog(res, opts, planAll);
        if (!choice || !choice.rows.length) { return; }
        var list = []; for (var i = 0; i < choice.rows.length; i++) { list.push(res.conflicts[choice.rows[i]]); }
        if (choice.action === 'select') {
            var items = []; for (i = 0; i < list.length; i++) { items = items.concat(itemsOfPair(res, list[i], col.paints)); }
            var n = selectItems(doc, items);
            alert(n + T(' objet(s) sélectionné(s).', ' object(s) selected.') + skippedTxt);
        } else if (choice.action === 'mark') {
            var m = markConflicts(doc, res, list, col.paints);
            alert(m + T(' repère(s) posé(s) sur le calque « ', ' mark(s) placed on layer “') + LAYER_NAME + T(' » (non imprimable). Les numéros renvoient à la liste.', '” (non-printing). Numbers refer to the list.') + skippedTxt);
        } else {
            var pr = E.planFixes(res, list, opts, CONV, 25, locked);
            var a = applyPlan(col.paints, pr.plan), nofix = 0;
            for (i = 0; i < pr.steps.length; i++) { if (pr.steps[i].status === 'nofix') { nofix++; } }
            alert(a.changed + T(' couleur(s) d\'objet retouchée(s).', ' object colour(s) changed.') +
                (nofix ? '\n' + nofix + T(' paire(s) sans correction simple : ajoutez un contour, un motif ou un libellé.', ' pair(s) without a simple fix: add a stroke, pattern or label.') : '') +
                (pr.remaining ? '\n' + T('Paires encore confondues dans la zone : ', 'Pairs still confused in scope: ') + pr.remaining : '') +
                (a.failed ? '\n' + T('Objets non modifiés (verrouillés ?) : ', 'Objects not changed (locked?): ') + a.failed : '') +
                '\n' + T('Ctrl/Cmd+Z pour annuler.', 'Ctrl/Cmd+Z to undo.'));
        }
    }
    return { run: run, collect: collect, applyPlan: applyPlan, markConflicts: markConflicts, CONV: CONV, specOf: specOf, settingsDialog: settingsDialog, resultsDialog: resultsDialog, LAYER_NAME: LAYER_NAME };
})(CDV);

if (typeof CDV_NO_AUTORUN === 'undefined') {
    try { CDV_UI.run(); } catch (err) { alert('ConfusionsDaltonisme.jsx\n' + err + (err.line ? ' (ligne ' + err.line + ')' : '')); }
}
