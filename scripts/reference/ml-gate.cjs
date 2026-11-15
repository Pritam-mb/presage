// G7 ML (soft unless evidence/ml/results.json exists, then hard)
(function () {
  if (!exists('evidence/ml/results.json')) return add('G7.1', 'ML add-on not used (allowed)', false, true);
  let r = null; try { r = JSON.parse(read('evidence/ml/results.json')); } catch (e) {}
  add('G7.1', 'ML results are real, grouped, leak-free, and report both AUCs', true,
      !!r && r.synthetic === false && Array.isArray(r.leak_features) && r.leak_features.length === 0 &&
      r.n_groups >= 6 && typeof r.grouped_auc === 'number' && typeof r.ungrouped_auc === 'number' && typeof r.seed === 'number');
})();
