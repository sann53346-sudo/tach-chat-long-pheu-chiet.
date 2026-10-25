export function loadSettings(){
  try{return JSON.parse(localStorage.getItem("oilSepSettings")||"{}");}catch{return {};}
}
export function saveSettings(settings){try{localStorage.setItem("oilSepSettings",JSON.stringify(settings));}catch{}}
