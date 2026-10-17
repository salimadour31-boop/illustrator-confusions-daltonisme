// DOM Illustrator simulé (sous-ensemble) + ScriptUI simulé / simulated Illustrator DOM + ScriptUI
function RGBColor() { this.typename = 'RGBColor'; this.red = 0; this.green = 0; this.blue = 0; }
function CMYKColor() { this.typename = 'CMYKColor'; this.cyan = 0; this.magenta = 0; this.yellow = 0; this.black = 0; }
function GrayColor() { this.typename = 'GrayColor'; this.gray = 0; }
function SpotColor() { this.typename = 'SpotColor'; this.spot = null; this.tint = 100; }
function NoColor() { this.typename = 'NoColor'; }
function rgb(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
function cmyk(c0, m, y, k) { var c = new CMYKColor(); c.cyan = c0; c.magenta = m; c.yellow = y; c.black = k; return c; }
function spot(name, base, tint) { var c = new SpotColor(); c.spot = { name: name, color: base, colorType: 'ColorModel.SPOT' }; c.tint = tint === undefined ? 100 : tint; return c; }
var uid = 0;
function Base(tn) { this.typename = tn; this.uuid = String(++uid); this.hidden = false; this.locked = false; this.selected = false; this.parent = null; this.name = ''; }
function boundsOf(pts) { var l = 1e9, t = -1e9, r = -1e9, b = 1e9; pts.forEach(function (p) { l = Math.min(l, p[0]); r = Math.max(r, p[0]); b = Math.min(b, p[1]); t = Math.max(t, p[1]); }); return [l, t, r, b]; }
function PathItem(pts, o) {
    Base.call(this, 'PathItem'); o = o || {};
    this.pathPoints = pts.map(function (p) { return { anchor: [p[0], p[1]], leftDirection: [p[0], p[1]], rightDirection: [p[0], p[1]] }; });
    this.closed = o.closed !== false; this.filled = o.fill !== null; this.fillColor = o.fill || new NoColor();
    this.stroked = !!o.stroke; this.strokeColor = o.stroke || new NoColor(); this.strokeWidth = o.sw || 1;
    this.evenodd = !!o.evenodd; this.guides = !!o.guides; this.clipping = !!o.clipping;
    if (o.hidden) { this.hidden = true; } if (o.locked) { this.locked = true; }
}
Object.defineProperty(PathItem.prototype, 'visibleBounds', { get: function () { return boundsOf(this.pathPoints.map(function (p) { return p.anchor; })); } });
PathItem.prototype.remove = function () { var a = this.parent._items, i = a.indexOf(this); if (i >= 0) { a.splice(i, 1); } };
function CompoundPathItem(rings, o) { Base.call(this, 'CompoundPathItem'); var self = this; this.pathItems = rings.map(function (r) { var p = new PathItem(r, o); p.parent = self; return p; }); }
Object.defineProperty(CompoundPathItem.prototype, 'visibleBounds', { get: function () { var pts = []; this.pathItems.forEach(function (p) { p.pathPoints.forEach(function (q) { pts.push(q.anchor); }); }); return boundsOf(pts); } });
function GroupItem(items, clipped) { Base.call(this, 'GroupItem'); var self = this; this.pageItems = items; this.clipped = !!clipped; items.forEach(function (i) { i.parent = self; }); }
Object.defineProperty(GroupItem.prototype, 'visibleBounds', { get: function () { var pts = []; this.pageItems.forEach(function (c) { var b = c.visibleBounds; pts.push([b[0], b[1]], [b[2], b[3]]); }); return boundsOf(pts); } });
function TextFrame(bounds, runs) {
    Base.call(this, 'TextFrame'); this._b = bounds;
    this.textRanges = runs.map(function (r) { return { length: r.text.length, contents: r.text, characterAttributes: { fillColor: r.color, size: 12 } }; });
    this.textRange = { characterAttributes: {} }; this.contents = runs.map(function (r) { return r.text; }).join('');
}
Object.defineProperty(TextFrame.prototype, 'visibleBounds', { get: function () { return this._b; } });
function Layer(name, items, o) {
    Base.call(this, 'Layer'); o = o || {}; var self = this; this.name = name; this.visible = o.visible !== false; this.locked = !!o.locked; this.printable = o.printable !== false;
    this._items = []; this.layers = []; this.zOrderCalls = 0;
    (items || []).forEach(function (i) { i.parent = self; self._items.push(i); });
    this.pathItems = { ellipse: function (top, left, w, h) { var p = new PathItem([[left, top - h], [left + w, top - h], [left + w, top], [left, top]], {}); p.parent = self; self._items.push(p); p.kind = 'ellipse'; return p; } };
    this.textFrames = { pointText: function (pt) { var t = new TextFrame([pt[0], pt[1], pt[0] + 5, pt[1] - 5], [{ text: '', color: rgb(0, 0, 0) }]); t.parent = self; self._items.push(t); return t; } };
}
Object.defineProperty(Layer.prototype, 'pageItems', { get: function () {
    // comme Illustrator : tous les objets du calque, y compris dans les groupes / like Illustrator, nested items included
    var out = []; function walk(a) { a.forEach(function (i) { out.push(i); if (i.typename === 'GroupItem') { walk(i.pageItems); } }); } walk(this._items); return out;
} });
Layer.prototype.zOrder = function () { this.zOrderCalls++; };
Layer.prototype.remove = function () { };
function Document(layers, o) {
    o = o || {}; var self = this; this.typename = 'Document'; this.name = 'test.ai'; this.selection = o.selection || [];
    this.documentColorSpace = o.cmyk ? 'DocumentColorSpace.CMYK' : 'DocumentColorSpace.RGB';
    this._layers = layers; layers.forEach(function (L) { L.parent = self; });
    this.layers = layers; this.layers.getByName = function (n) { for (var i = 0; i < layers.length; i++) { if (layers[i].name === n) { return layers[i]; } } throw new Error('no layer'); };
    this.layers.add = function () { var L = new Layer('Calque'); L.parent = self; layers.unshift(L); return L; };
    this.artboards = [{ artboardRect: o.ab || [0, 1000, 1000, 0] }]; this.artboards.getActiveArtboardIndex = function () { return 0; };
}
function rect(l, b, r, t) { return [[l, b], [r, b], [r, t], [l, t]]; }

// ScriptUI simulé : hook(w) peut modifier les contrôles avant show()
function makeUI(hook) {
    function Ctrl(type, text, props) { this.type = type; this.text = text; this.properties = props || {}; this.children = []; this.items = []; this.value = false; this.enabled = true; this.subItems = []; }
    Ctrl.prototype.add = function (type, bounds, text, props) {
        if (type === 'item') { var it = { text: bounds, selected: false, subItems: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }] }; this.items.push(it); return it; }
        var c = new Ctrl(type, typeof text === 'string' ? text : '', props);
        if (type === 'dropdownlist') { c.items = (text || []).map(function (t, i) { return { text: t, index: i }; }); c.selection = c.items[0]; var self = c; Object.defineProperty(c, 'selection', { get: function () { return self._sel; }, set: function (v) { self._sel = typeof v === 'number' ? self.items[v] : v; } }); c.selection = 0; }
        this.children.push(c); return c;
    };
    Ctrl.prototype.find = function (text) { var r = null; (function walk(n) { if (r) { return; } if (n.text && n.text.indexOf(text) >= 0) { r = n; return; } n.children.forEach(walk); })(this); return r; };
    function Window(type, title) { Ctrl.call(this, 'window', title); this.title = title; }
    Window.prototype = Object.create(Ctrl.prototype);
    Window.prototype.show = function () { var r = hook ? hook(this) : 1; return r === undefined ? 1 : r; };
    return Window;
}
module.exports = { RGBColor: RGBColor, CMYKColor: CMYKColor, GrayColor: GrayColor, SpotColor: SpotColor, NoColor: NoColor, rgb: rgb, cmyk: cmyk, spot: spot, PathItem: PathItem, CompoundPathItem: CompoundPathItem, GroupItem: GroupItem, TextFrame: TextFrame, Layer: Layer, Document: Document, rect: rect, makeUI: makeUI };
TextFrame.prototype.remove = PathItem.prototype.remove;
GroupItem.prototype.remove = PathItem.prototype.remove;
CompoundPathItem.prototype.remove = PathItem.prototype.remove;
