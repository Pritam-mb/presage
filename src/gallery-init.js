'use strict';
// gallery-init.js — dev-only gallery chart state initialiser
// Runs after charts.js (deferred), so SpoofCharts is available.
(function () {
  if (typeof SpoofCharts === 'undefined') {
    ['chart-empty', 'chart-loading', 'chart-error', 'chart-unavailable'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '(SpoofCharts unavailable in this context)';
    });
    return;
  }
  document.getElementById('chart-empty')
    .append(SpoofCharts.state('No data collected yet', 'empty'));
  document.getElementById('chart-loading')
    .append(SpoofCharts.state('Computing signal…', 'loading'));
  document.getElementById('chart-error')
    .append(SpoofCharts.state('Chart failed to render — check console', 'error'));
  document.getElementById('chart-unavailable')
    .append(SpoofCharts.state('Instrument not available in this session', 'unavailable'));
})();
