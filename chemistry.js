export const WATER_DENSITY = 1.00;
export const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
export function validatePositive(value,label,{min=0.001,max=Infinity}={}){
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max) throw new Error(`${label} phải là số trong khoảng ${min}–${max}.`);
  return n;
}
export function phaseOrder(waterDensity, organicDensity){
  if(Math.abs(waterDensity-organicDensity)<0.015) return {top:"organic",bottom:"water",close:true,explanation:"Khối lượng riêng hai pha gần nhau; thứ tự mô phỏng dùng giá trị nhập, nhưng mặt phân cách ngoài thực tế có thể khó quan sát."};
  return organicDensity < waterDensity
    ? {top:"organic",bottom:"water",close:false,explanation:"Pha hữu cơ nhẹ hơn nên nằm trên pha nước trong mô hình hai pha không trộn lẫn."}
    : {top:"water",bottom:"organic",close:false,explanation:"Pha nước nhẹ hơn dung môi đã khai báo nên nằm trên; thứ tự không được cố định theo tên pha."};
}
export function remainingAfterExtraction(mass, waterVolume, organicVolume, K){
  const m=validatePositive(mass,"Lượng tinh dầu",{min:0,max:Infinity});
  const va=validatePositive(waterVolume,"Thể tích pha nước");
  const vo=validatePositive(organicVolume,"Thể tích dung môi");
  const k=validatePositive(K,"Hệ số phân bố K");
  return m*va/(va+k*vo);
}
export function extractionStep(mass, waterVolume, organicVolume, K){
  const remaining=remainingAfterExtraction(mass,waterVolume,organicVolume,K);
  return {remaining, extracted:Math.max(0,mass-remaining)};
}
export function percent(value,total){return total>0?100*value/total:0;}
