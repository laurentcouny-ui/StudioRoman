'use strict';
/* Polyfill RegExp.leftContext / rightContext (SpiderMonkey) pour Chromium — Gramalecte gc_engine */
;(function () {
  if (typeof RegExp.leftContext === 'string') return
  const origExec = RegExp.prototype.exec
  RegExp.prototype.exec = function (str) {
    const m = origExec.call(this, str)
    if (m && typeof str === 'string') {
      RegExp.leftContext = str.slice(0, m.index)
      RegExp.rightContext = str.slice(m.index + m[0].length)
    } else {
      RegExp.leftContext = typeof str === 'string' ? str : ''
      RegExp.rightContext = ''
    }
    return m
  }
})()
