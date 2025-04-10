// Browser polyfills
global.Buffer = global.Buffer || require('buffer').Buffer;
global.process = global.process || {
  env: {},
  version: '',
  nextTick: function(fn) { setTimeout(fn, 0); },
  browser: true
};