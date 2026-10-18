'use strict';
function canCancelSale(v){return !v.cancelled&&(currentUser?.role==='admin'||(v.box===currentUser?.box&&v.session===state.boxes[v.box]?.session&&state.sessions.some(s=>s.id===v.session&&!s.closed&&s.operator===currentUser.name)&&v.operator===currentUser.name));}
let salesSearch='';
const renderBeforeSales=render;
render=function(){
 let button=document.querySelector('[data-tab="sales"]');if(!button){button=document.createElement('button');button.dataset.tab='sales';button.textContent='Vendas e cancelamentos';document.querySelector('.tabs').append(button);}
 const selected=tab==='sales';if(selected)tab='sale';renderBeforeSales();
 if(selected){tab='sales';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderSalesScreen();}
};
function renderSalesScreen(){
 $('content').innerHTML='<section class="panel"><h2>Vendas · Caixa 0'+box+'</h2><p class="muted">Consulte os pedidos, veja a foto do Pix ou cancele uma venda informando o motivo. O histórico será preservado.</p><label for="salesSearch">Buscar pedido, ticket ou pagamento</label><input id="salesSearch" placeholder="Ex.: 12 ou Pix" value="'+esc(salesSearch)+'"><div id="salesRows" class="scroll"></div></section>';
 $('salesSearch').oninput=e=>{salesSearch=e.target.value;renderSalesRows();};renderSalesRows();
}
function renderSalesRows(){
 const q=salesSearch.trim().toLowerCase().replace(/^#/,''),rows=state.sales.filter(v=>v.box===box&&(!q||String(v.number)===q||v.items.some(i=>(i.numbers||[]).some(n=>String(n)===q))||v.method.toLowerCase().includes(q))).slice().reverse();
 $('salesRows').innerHTML='<table><thead><tr><th>Pedido / horário</th><th>Itens / tickets</th><th>Pagamento / valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+rows.map(v=>'<tr><td>#'+v.number+'<br><span class="muted">'+esc(new Date(v.at).toLocaleString('pt-BR'))+'</span></td><td>'+v.items.map(i=>esc(i.qty+'× '+i.name)+(i.numbers.length?'<br><span class="muted">Tickets: '+esc(i.numbers.join(', '))+'</span>':'')).join('<br>')+'</td><td>'+esc(v.method)+'<br><strong>'+money(v.total)+'</strong></td><td>'+(v.cancelled?'<span class="danger">Cancelada</span><br><span class="muted">'+esc(v.reason||'')+(v.cancelledBy?'<br>Por '+esc(v.cancelledBy):'')+'</span>':'Confirmada')+'</td><td><div class="row"><button class="small" data-receipt="'+esc(v.id)+'">Comprovante da venda</button>'+(/^PIX/.test(v.method)?'<button class="small" data-photo="'+esc(v.id)+'">Ver foto Pix</button>':'')+(canCancelSale(v)?'<button class="small danger" data-cancel="'+esc(v.id)+'">Cancelar venda</button>':'')+'</div></td></tr>').join('')+'</tbody></table>'+(!rows.length?'<p class="empty">Nenhuma venda encontrada.</p>':'');
}
cancelSale=function(id){
 const v=state.sales.find(s=>s.id===id);if(!v||!canCancelSale(v))return toast('Cancelamento indisponível para este turno.');
 showDialog('<h2>Cancelar pedido #'+v.number+'</h2><p><strong>'+money(v.total)+'</strong> · '+esc(v.method)+'</p><p class="muted" style="margin-top:12px">O histórico e a foto serão preservados. Os tickets serão liberados e esta venda deixará de somar nos relatórios. Confira os tickets físicos se o pedido já foi entregue. O estorno do pagamento deve ser feito separadamente.</p><form id="cancelForm"><label for="reason">Motivo do cancelamento</label><input id="reason" required maxlength="200" placeholder="Ex.: pedido lançado por engano"><div class="row" style="margin-top:18px"><button class="danger" id="confirmSaleCancel">Confirmar cancelamento</button><button type="button" id="keepSale">Voltar sem cancelar</button></div></form>');
 $('keepSale').onclick=()=>$('modal').close();$('cancelForm').onsubmit=async e=>{e.preventDefault();const reason=$('reason').value.trim();if(!reason)return;const button=$('confirmSaleCancel');button.disabled=true;
 try{if(await change(s=>{const sale=s.sales.find(x=>x.id===id);if(!sale||sale.cancelled)throw Error('Esta venda já foi cancelada ou não está disponível.');Object.assign(sale,{cancelled:true,reason,cancelledAt:new Date().toISOString(),cancelledBy:currentUser.name,cancelledById:currentUser.id});})){$('modal').close();render();toast('Venda cancelada. Tickets liberados e relatórios atualizados.');}}finally{if(button.isConnected)button.disabled=false;}
 };
};
