'use strict';
// A parada só avança depois da confirmação do servidor.
let driverStopId='',driverMapTarget='',driverMapReady=false,driverDelivering=false;
function driverStops(){return orderedDeliveries().filter(p=>deliveryState(p)!=='delivered'&&deliverySelected.has(p.id)&&deliveryTarget(p));}
function driverNavigateUrl(target){return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:target,travelmode:'driving',dir_action:'navigate'});}
function driverEmbedUrl(target){return 'https://maps.google.com/maps?'+new URLSearchParams({q:target,z:'16',output:'embed',hl:'pt-BR'});}
const renderDeliveryBeforeMap=renderDeliveryRoute;
renderDeliveryRoute=function(){renderDeliveryBeforeMap();renderDriverMap();};
function renderDriverMap(){
 if(!currentUser)return;
 let panel=$('driverMapPanel');
 if(!panel){panel=document.createElement('section');panel.id='driverMapPanel';panel.className='panel';panel.style.marginBottom='18px';$('content').before(panel);}
 const stops=driverStops(),current=stops[0];
 if(!current){driverStopId='';driverMapTarget='';driverMapReady=false;panel.innerHTML='<h2>'+((state.presales||[]).some(p=>deliveryState(p)!=='delivered')?'Selecione as próximas entregas':'Entregas concluídas')+'</h2><p class="muted">'+((state.presales||[]).some(p=>deliveryState(p)!=='delivered')?'Use a lista abaixo para incluir pedidos na rota. Pedidos sem endereço precisam de uma localização.':'Todas as entregas disponíveis foram concluídas. Novos pedidos aparecerão na lista abaixo.')+'</p>';return;}
 const changed=driverStopId!==current.id;driverStopId=current.id;
 if(!driverMapReady){
  panel.innerHTML='<div class="row" style="justify-content:space-between"><h2>Entrega atual</h2><span class="tag" id="driverStopCount"></span></div><h3 id="driverStopName" style="font-size:23px;margin:16px 0 8px"></h3><p id="driverStopAddress" style="margin:8px 0"></p><p id="driverStopTickets" class="muted"></p><a id="driverStopPhone" class="route-link" style="margin:12px 0" hidden>Ligar para o cliente</a><a id="driverStartRoute" class="primary" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;text-decoration:none;border-radius:10px;padding:17px 12px;font-size:20px;font-weight:700;margin:12px 0">Iniciar rota</a><p class="muted" style="margin:10px 0">Abre o Google Maps até este cliente. Ao chegar, volte aqui e toque em Entregue.</p><iframe id="driverEmbeddedMap" title="Mapa da entrega atual" width="100%" height="360" style="border:0;border-radius:12px;background:#f7f5f1;height:min(38vh,360px);min-height:220px" referrerpolicy="no-referrer" loading="eager" allowfullscreen></iframe><p id="driverNextStop" class="muted" style="margin:12px 0" aria-live="polite"></p><button id="driverCompleteStop" class="success" style="width:100%;min-height:58px;font-size:18px;position:sticky;bottom:12px;z-index:3;box-shadow:0 4px 18px #0002">Entregue · ir para a próxima</button><p id="driverStopSaving" role="status" class="muted" style="margin-top:10px"></p>';
  driverMapReady=true;
 }
 $('driverStopName').textContent=current.customer;$('driverStopAddress').textContent=current.address||'Localização enviada pelo cliente';$('driverStopTickets').textContent='Tickets: '+current.numbers.map(n=>'#'+String(n).padStart(3,'0')).join(', ');$('driverStopCount').textContent=stops.length+' restante(s) nesta seleção';
 const phone=String(current.phone||'').replace(/[^\d+]/g,'');$('driverStopPhone').hidden=!phone;if(phone)$('driverStopPhone').href='tel:'+phone;
 const target=deliveryTarget(current);$('driverStartRoute').href=driverNavigateUrl(target);if(target!==driverMapTarget){$('driverEmbeddedMap').src=driverEmbedUrl(target);driverMapTarget=target;}
 const next=stops.find(p=>p.id!==current.id);$('driverNextStop').textContent=next?'Próxima: '+next.customer:'Esta é a última entrega da seleção.';
 $('driverCompleteStop').disabled=driverDelivering;$('driverCompleteStop').onclick=()=>completeDriverStop(current.id);
 if(changed)$('driverStopSaving').textContent='';
}
async function completeDriverStop(id){
 if(driverDelivering||busy)return;const current=state.presales.find(p=>p.id===id);if(!current||deliveryState(current)==='delivered')return;
 driverDelivering=true;$('driverCompleteStop').disabled=true;$('driverStopSaving').textContent='Salvando entrega…';
 try{
  const ok=await change(s=>{const p=s.presales.find(p=>p.id===id);if(!p)throw Error('Entrega não encontrada. Atualize a lista.');p.deliveryStatus='delivered';p.deliveredAt=new Date().toISOString();});
  if(ok){deliverySelected.delete(id);driverStopId='';render();toast('Entrega salva. '+(driverStops().length?'Próximo cliente no mapa.':'Seleção concluída.'));}
  else if(!state.presales.some(p=>p.id===id&&deliveryState(p)!=='delivered')){driverStopId='';render();toast('A lista foi atualizada: esta entrega já foi concluída ou removida.');}
  else if($('driverStopSaving'))$('driverStopSaving').textContent='Não foi possível confirmar. Confira a conexão e tente novamente; a parada não foi avançada.';
 }finally{driverDelivering=false;if($('driverCompleteStop'))$('driverCompleteStop').disabled=false;}
}

