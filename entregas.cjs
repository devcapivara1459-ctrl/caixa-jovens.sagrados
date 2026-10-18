'use strict';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=['id','customer','seller','numbers','delivery','address','phone','mapsUrl','deliveryStatus','deliveredAt'];
function view(state){return {version:1,event:state.event,date:state.date,...Object.fromEntries(['deliveryOrigin','deliveryOriginLocation','deliveryOrder'].filter(k=>state[k]!==undefined).map(k=>[k,state[k]])),presales:(state.presales||[]).filter(p=>p.delivery&&!p.cancelled).map(p=>Object.fromEntries(fields.filter(k=>p[k]!==undefined).map(k=>[k,p[k]])))};}
function merge(state,input){
 const base=view(state),next=structuredClone(state);
 if(!input||!Array.isArray(input.presales)||input.presales.length!==base.presales.length)throw Error('Lista de entregas inválida. Atualize a página.');
 for(const key of ['deliveryOrigin','deliveryOriginLocation','deliveryOrder']){if(input[key]!==undefined){base[key]=input[key];next[key]=input[key];}else if(base[key]!==undefined)throw Error('A configuração da rota não pode ser removida.');}
 for(let i=0;i<base.presales.length;i++){
  const original=base.presales[i],update=input.presales[i],full=next.presales.find(p=>p.id===original.id);
  if(!update||update.id!==original.id)throw Error('Não é permitido incluir ou excluir pedidos.');
  for(const key of ['address','mapsUrl','deliveryStatus'])if(update[key]!==undefined){original[key]=update[key];full[key]=update[key];}else if(original[key]!==undefined)throw Error('Dados da entrega não podem ser removidos.');
  const previous=state.presales.find(p=>p.id===original.id);
  if((update.deliveryStatus||'pending')!==(previous.deliveryStatus||'pending')){
   if(update.deliveryStatus==='delivered'){if(!Number.isFinite(Date.parse(update.deliveredAt)))throw Error('Data de entrega inválida.');original.deliveredAt=update.deliveredAt;full.deliveredAt=new Date().toISOString();}
   else{delete original.deliveredAt;delete full.deliveredAt;}
  }
 }
 if(!same(base,input))throw Error('O entregador pode alterar somente a rota, a localização e a situação da entrega.');
 return next;
}
module.exports={view,merge};
