'use strict';
const defaultDeliveryOrigin = 'R. Maj. Silvério J. Nery, 2 - Núcleo 3 - Cidade Nova, Manaus - AM, 69094-160';
const defaultDeliveryOriginLocation = 'https://maps.google.com/?q=-3.0417546,-59.9804056';
let deliverySelected = new Set(), deliverySelectionInitialized = false;
const deliveryTarget = p => MapsLocation.parse(p.mapsUrl || '')?.target || p.address.trim();
const deliveryState = p => p.deliveryStatus || 'pending';
function orderedDeliveries() {
  const order = state.deliveryOrder || [];
  const rows = activePresales().filter(p => p.delivery);
  return rows.sort((a,b) => {
    const ai=order.indexOf(a.id), bi=order.indexOf(b.id);
    return (ai<0?Number.MAX_SAFE_INTEGER:ai)-(bi<0?Number.MAX_SAFE_INTEGER:bi);
  });
}
function deliverySegments(rows, origin) {
  const segments=[];
  let start=origin;
  for(let i=0;i<rows.length;i+=4){
    const group=rows.slice(i,i+4), targets=group.map(deliveryTarget);
    segments.push({rows:group, url:MapsLocation.directions(start,targets)});
    start=targets.at(-1);
  }
  return segments;
}
const renderBeforeRoutes = render;
render = function () {
  const admin=currentUser?.role==='admin';
  let button=document.querySelector('[data-tab="routes"]');
  if(!button){button=document.createElement('button');button.dataset.tab='routes';button.textContent='Rota de entregas';document.querySelector('.tabs').append(button);}
  button.hidden=!admin;
  const routeTab=admin&&tab==='routes';
  if(tab==='routes')tab='sale';
  renderBeforeRoutes();
  if(routeTab){tab='routes';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderDeliveryRoute();}
};
function renderDeliveryRoute() {
  const rows=orderedDeliveries(), pending=rows.filter(p=>deliveryState(p)!=='delivered');
  const eligible=p=>deliveryState(p)!=='delivered'&&Boolean(deliveryTarget(p));
  if(!deliverySelectionInitialized){pending.filter(eligible).forEach(p=>deliverySelected.add(p.id));deliverySelectionInitialized=true;}
  const missing=pending.filter(p=>!MapsLocation.parse(p.mapsUrl||''));
  const origin=state.deliveryOrigin||defaultDeliveryOrigin;
  const selected=pending.filter(p=>deliverySelected.has(p.id)&&eligible(p));
  const originPoint=MapsLocation.parse(state.deliveryOriginLocation===undefined?defaultDeliveryOriginLocation:state.deliveryOriginLocation)?.target;
  const originCoordinates=MapsLocation.coordinates(originPoint||'');
  const segments=deliverySegments(selected,originPoint||origin);
  const link=(href,label)=>'<a class="route-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
  $('content').innerHTML='<section class="panel"><h2>Rota de entregas</h2><p class="muted">Selecione as entregas e ajuste a ordem com as setas. O Google Maps calcula o caminho nessa ordem; use a sugestão por proximidade para organizar as paradas. A sugestão não considera trânsito, ruas de mão única ou restrições de acesso.</p><form id="routeOriginForm" class="row" style="align-items:end;margin:16px 0"><div style="flex:1;min-width:220px"><label for="routeOrigin">Ponto de partida</label><input id="routeOrigin" required maxlength="500" value="'+esc(origin)+'"></div><div style="flex:1;min-width:220px"><label for="routeOriginLocation">Localização exata da partida (Google Maps)</label><input id="routeOriginLocation" maxlength="2000" placeholder="Cole o link ou latitude,longitude" value="'+esc(state.deliveryOriginLocation===undefined?defaultDeliveryOriginLocation:state.deliveryOriginLocation)+'"></div><button>Salvar partida</button></form><div class="row" style="margin-bottom:16px"><span class="tag">'+pending.length+' pendentes</span><span class="tag">'+(rows.length-pending.length)+' entregues</span><button id="routeSuggest" class="primary" '+(!originCoordinates?'disabled':'')+'>Sugerir ordem por proximidade</button><button id="routeSelectAll">Selecionar pendentes</button><button id="routeClearAll">Limpar seleção</button><button id="routePrint">Imprimir lista</button><select id="routeView" aria-label="Filtrar entregas" style="max-width:230px"><option value="pending">Pendentes</option><option value="all">Todas</option><option value="delivered">Entregues</option><option value="missing">Sem link de localização</option></select></div><div id="routeLinks" class="notice"><strong>'+selected.length+' paradas selecionadas</strong><div class="row" style="margin-top:12px">'+(segments.map((s,i)=>link(s.url,segments.length===1?'Abrir rota no Google Maps':'Abrir trecho '+(i+1)+' · '+s.rows.length+' paradas')).join('')||'<span>Selecione uma entrega com endereço ou coordenadas para gerar a rota.</span>')+'</div>'+(segments.length>1?'<p class="muted" style="margin-top:10px">Abra os trechos em sequência. Cada trecho continua da última parada do anterior.</p>':'')+'<p class="muted" style="margin-top:10px">Confira as paradas no Maps antes de sair. Em cada pedido, “Navegar até o cliente” usa sua posição atual no Maps.</p></div><div id="routeList"></div></section>';
  const updateList=()=>{
    const view=$('routeView').value;
    $('routeList').innerHTML=rows.filter(p=>view==='missing'?deliveryState(p)!=='delivered'&&!MapsLocation.parse(p.mapsUrl||''):view==='all'||(view==='delivered')===(deliveryState(p)==='delivered')).map(p=>{
      const target=deliveryTarget(p), parsed=MapsLocation.parse(p.mapsUrl||''), done=deliveryState(p)==='delivered';
      const status=done?'Entregue':deliveryState(p)==='out'?'Saiu para entrega':'Pendente';
      const nav=target?'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:target,travelmode:'driving',dir_action:'navigate'}):null;
      return '<article class="panel route-stop" style="margin-top:12px"><div class="row" style="justify-content:space-between"><div><strong>'+esc(p.customer)+'</strong> <span class="tag">'+status+'</span><p class="muted">Vendedor: '+esc(p.seller)+' · Tickets: '+p.numbers.map(n=>'#'+String(n).padStart(3,'0')).join(', ')+'</p></div><div class="row">'+(!done?'<label class="route-checkbox"><input type="checkbox" data-route-select="'+esc(p.id)+'" '+(deliverySelected.has(p.id)&&target?'checked':'')+' '+(!target?'disabled':'')+'> Incluir na rota</label><button data-route-up="'+esc(p.id)+'" aria-label="Mover '+esc(p.customer)+' para cima">↑</button><button data-route-down="'+esc(p.id)+'" aria-label="Mover '+esc(p.customer)+' para baixo">↓</button>':'')+'</div></div><p style="margin:12px 0">'+esc(p.address||'Localização enviada pelo cliente')+'</p>'+(!parsed&&!done?'<p class="danger"><strong>Sem link de localização.</strong> Adicione o link enviado por este cliente antes de organizar a rota.</p>':'')+(p.phone?'<p class="muted">Telefone: '+esc(p.phone)+'</p>':'')+(!target?'<p class="danger">Este link abre o mapa, mas ainda não identifica uma parada para a rota. Edite a pré-venda e informe o endereço completo ou um link com coordenadas.</p>':'')+'<div class="row" style="margin-top:12px">'+(nav?link(nav,'Navegar até o cliente'):'')+(parsed?link(parsed.url,'Abrir localização enviada'):'')+'<button data-route-edit="'+esc(p.id)+'">' +(parsed?'Editar localização':'Adicionar link')+ '</button>'+(!done?'<button data-route-status="out" data-route-id="'+esc(p.id)+'" '+(deliveryState(p)==='out'?'disabled':'')+'>Saiu para entrega</button><button class="success" data-route-status="delivered" data-route-id="'+esc(p.id)+'">Marcar entregue</button>':'<button data-route-status="pending" data-route-id="'+esc(p.id)+'">Voltar para pendente</button>')+'</div></article>';
    }).join('')||'<p class="muted">Nenhuma entrega nesta lista. Cadastre uma pré-venda com a opção de entrega no endereço.</p>';
  };
  if(missing.length){
    const warning=document.createElement('div');warning.className='notice';warning.setAttribute('role','alert');
    warning.innerHTML='<strong>Atenção: '+missing.length+' pedido(s) sem link de localização</strong><p style="margin:8px 0">'+missing.map(p=>esc(p.customer)+' · '+p.numbers.map(n=>'#'+String(n).padStart(3,'0')).join(', ')).join('<br>')+'</p><button id="routeShowMissing">Ver pedidos sem link</button>';
    $('routeLinks').before(warning);
    $('routeShowMissing').onclick=()=>{$('routeView').value='missing';updateList();};
  }
  $('routeView').onchange=updateList;
  $('routeOriginForm').onsubmit=async event=>{event.preventDefault();const value=$('routeOrigin').value.trim(),location=$('routeOriginLocation').value.trim();if(!value)return;if(location&&!MapsLocation.parse(location))return toast('Informe um link válido do Google Maps ou coordenadas.');if(await change(s=>{s.deliveryOrigin=value;s.deliveryOriginLocation=location;})){render();toast('Ponto de partida salvo.');}};
  $('routeSuggest').onclick=async()=>{
    const chosen=pending.filter(p=>deliverySelected.has(p.id)), precise=chosen.map(p=>({id:p.id,point:MapsLocation.coordinates(MapsLocation.parse(p.mapsUrl||'')?.target||'')})).filter(p=>p.point);
    if(!originCoordinates)return toast('Salve a localização exata da partida para sugerir a ordem.');
    if(precise.length<2)return toast('Selecione pelo menos duas entregas com coordenadas para comparar a ordem.');
    const ids=MapsLocation.suggest(originCoordinates,precise), rest=rows.filter(p=>!ids.includes(p.id)).map(p=>p.id);
    if(await change(s=>{s.deliveryOrder=[...ids,...rest];})){render();toast('Sequência sugerida por proximidade. Entregas sem coordenadas ficam ao final; confira no Maps.');}
  };
  if(!originCoordinates)$('routeLinks').insertAdjacentHTML('beforeend','<p class="muted">Para sugerir a ordem automaticamente, salve também o link com as coordenadas do ponto de partida.</p>');
  $('routeSelectAll').onclick=()=>{deliverySelected=new Set(pending.filter(eligible).map(p=>p.id));renderDeliveryRoute();};
  $('routeClearAll').onclick=()=>{deliverySelected.clear();renderDeliveryRoute();};
  $('routePrint').onclick=()=>print('<h1>Rota de entregas · '+esc(state.event)+'</h1><p>Partida: '+esc(origin)+'</p>'+presaleTable(selected));
  updateList();
}
document.addEventListener('change',event=>{
  const id=event.target.dataset?.routeSelect;if(!id)return;
  if(event.target.checked)deliverySelected.add(id);else deliverySelected.delete(id);
  renderDeliveryRoute();
});
function editDeliveryLocation(id) {
  const p=activePresales().find(p=>p.id===id);
  if(!p||!p.delivery||currentUser?.role!=='admin')return;
  showDialog('<h2>Localização da entrega</h2><p class="muted">'+esc(p.customer)+' · Tickets '+p.numbers.map(n=>'#'+String(n).padStart(3,'0')).join(', ')+'</p><form id="deliveryLocationForm"><label for="deliveryMaps">Link enviado pelo cliente</label><input id="deliveryMaps" required maxlength="2000" placeholder="Cole o link do Google Maps" value="'+esc(p.mapsUrl||'')+'"><label for="deliveryAddress">Endereço e referência (opcional)</label><input id="deliveryAddress" maxlength="500" value="'+esc(p.address)+'"><p id="deliveryLocationError" class="danger" role="alert" style="margin-top:12px"></p><div class="row" style="margin-top:16px"><button class="primary" id="deliveryLocationSave">Salvar localização</button><button type="button" id="deliveryLocationClose">Voltar</button></div></form>');
  $('deliveryLocationClose').onclick=()=>$('modal').close();
  $('deliveryLocationForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const location=$('deliveryMaps').value.trim(),address=$('deliveryAddress').value.trim();
    if(!MapsLocation.parse(location)){$('deliveryLocationError').textContent='Cole um link válido do Google Maps ou coordenadas no formato latitude,longitude.';return;}
    $('deliveryLocationSave').disabled=true;
    try{if(await change(s=>{const current=s.presales.find(p=>p.id===id);current.mapsUrl=location;current.address=address;})){$('modal').close();render();toast('Localização salva. O pedido saiu da lista de entregas sem link.');}}
    finally{if($('deliveryLocationSave'))$('deliveryLocationSave').disabled=false;}
  };
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b||currentUser?.role!=='admin'||busy)return;
  if(b.dataset.routeEdit)return editDeliveryLocation(b.dataset.routeEdit);
  if(b.dataset.routeUp||b.dataset.routeDown){
    const id=b.dataset.routeUp||b.dataset.routeDown, rows=orderedDeliveries().filter(p=>deliveryState(p)!=='delivered');
    const index=rows.findIndex(p=>p.id===id), other=index+(b.dataset.routeUp?-1:1);
    if(index<0||other<0||other>=rows.length)return;
    [rows[index],rows[other]]=[rows[other],rows[index]];
    if(await change(s=>{s.deliveryOrder=rows.map(p=>p.id);})){render();}
  }
  if(b.dataset.routeStatus){
    const id=b.dataset.routeId,status=b.dataset.routeStatus;
    if(await change(s=>{const p=s.presales.find(p=>p.id===id);if(!p||p.cancelled||!p.delivery)throw Error('Entrega indisponível.');p.deliveryStatus=status;if(status==='delivered')p.deliveredAt=new Date().toISOString();else delete p.deliveredAt;})){
      if(status==='delivered')deliverySelected.delete(id);
      render();toast(status==='delivered'?'Entrega concluída.':'Situação da entrega atualizada.');
    }
  }
});
const routeStyle=document.createElement('style');
routeStyle.textContent='.route-link{display:inline-block;background:#822c3c;color:white;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600}.route-checkbox{display:flex;align-items:center;gap:8px;margin:0}.route-checkbox input{width:auto}.route-stop{overflow-wrap:anywhere}#routeLinks .route-link{background:#24684e}';
document.head.append(routeStyle);
