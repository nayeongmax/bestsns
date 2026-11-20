// Integer arithmetic: discard amounts below 100 KRW after the annual discount.
export function annualTotal(monthlyPrice:number|null, discountPercent:number):number|null {
 if(monthlyPrice===null)return null;
 return Math.floor(monthlyPrice*12*(100-discountPercent)/10000)*100;
}
// Display quote only. The studio remains in non-billing operator test mode.
export function productionCredits(seconds:number):number {
 if(!Number.isFinite(seconds)||seconds<=0||seconds>180)throw new RangeError('Supported duration: 1–180 seconds');
 const blocks=Math.ceil(Math.max(0,seconds-60)/10);
 return 20+Math.ceil(blocks*5/6);
}
