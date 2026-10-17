// Charge ConfusionsDaltonisme.jsx dans Node sans lancer run() / loads the script without running it
var fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(globals) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'ConfusionsDaltonisme.jsx'), 'utf8').replace(/^\uFEFF/, '').replace(/^#.*$/mg, '');
    var ctx = Object.assign({ CDV_NO_AUTORUN: true, Math: Math, String: String, Number: Number, parseFloat: parseFloat, isNaN: isNaN, Error: Error }, globals || {});
    if (!ctx.app) { ctx.app = { locale: 'fr_FR' }; }
    if (!ctx.$) { ctx.$ = { locale: 'fr' }; }
    vm.createContext(ctx);
    vm.runInContext(src + '\n;this.CDV = CDV; this.CDV_UI = CDV_UI;', ctx, { filename: 'ConfusionsDaltonisme.jsx' });
    return ctx;
};
