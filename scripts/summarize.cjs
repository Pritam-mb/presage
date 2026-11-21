if(require.main===module){
  require('./refresh-ledger.cjs').refresh().catch(error=>{console.error(error.message);process.exitCode=1;});
}else module.exports=require('./legacy-summarize.cjs');
