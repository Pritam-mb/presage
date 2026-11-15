// Supplied workflow summary is preserved verbatim in reference/. Legacy exports support historical reports only.
if(require.main===module){require('./reference/summarize.cjs');require('./enrich-summary.cjs');}else module.exports=require('./legacy-summarize.cjs');
