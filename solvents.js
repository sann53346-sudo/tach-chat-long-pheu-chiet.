export const DEFAULT_SOLVENTS = [
  { id:"hexane", name:"Hexane", density:0.66, k:8, miscibility:"immiscible", color:"#e7ad45", volume:25, note:"Giá trị mô phỏng gần đúng; kiểm tra nguồn dữ liệu trước khi dùng thực nghiệm.", sourceType:"tham khảo" },
  { id:"ethyl-acetate", name:"Ethyl acetate", density:0.90, k:5, miscibility:"partial", color:"#b99aef", volume:25, note:"Độ hòa tan trong nước không bằng 0; mô hình hai pha là gần đúng.", sourceType:"tham khảo" },
  { id:"cyclohexane", name:"Cyclohexane", density:0.78, k:6, miscibility:"immiscible", color:"#6dc6a5", volume:25, note:"Thông số K là giả định dùng cho mô phỏng.", sourceType:"giả định" }
];
export function loadSolvents(){
  try { const saved=JSON.parse(localStorage.getItem("oilSepSolvents")); if(Array.isArray(saved)&&saved.length) return saved; } catch {}
  return DEFAULT_SOLVENTS.map(x=>({...x}));
}
export function saveSolvents(solvents){ try{localStorage.setItem("oilSepSolvents",JSON.stringify(solvents));}catch{} }
