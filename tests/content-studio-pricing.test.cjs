const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../components/content-pixeling/studioPricing.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};new Function('exports',compiled)(exportsObject);
const {annualTotal,productionCredits}=exportsObject;
test('annual discounts discard sub-100 KRW amounts and preserve unconfigured prices',()=>{
 assert.equal(annualTotal(29900,13),312100);
 assert.equal(annualTotal(49900,22),467000);
 assert.equal(annualTotal(139900,30),1175100);
 assert.equal(annualTotal(null,13),null);
});
test('duration quotes round up the final fractional credit at ten-second boundaries',()=>{
 for(const [seconds,credits] of [[30,20],[60,20],[60.01,21],[70,21],[70.01,22],[80,22],[90,23],[120,25],[150,28],[180,30]])assert.equal(productionCredits(seconds),credits);
 for(const seconds of [0,-1,181,NaN,Infinity])assert.throws(()=>productionCredits(seconds),RangeError);
});
