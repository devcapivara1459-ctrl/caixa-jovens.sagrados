'use strict';
// A foto é enviada fora do fluxo de confirmação da venda.
let receiptView=0,receiptSession='',receiptBox=0,receiptLoading=false;
const renderBeforeReceipts=render;
render=function(){
 let button=document.querySelector('[data-tab="receipts"]');
 if(!button){button=document.createElement('button');button.dataset.tab='receipts';button.textContent='Comprovantes Pix';document.querySelector('.tabs').append(button);}
 const selected=tab==='receipts';if(selected)tab='sale';renderBeforeReceipts();
 if(selected){tab='receipts';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderReceiptScreen();}
 else if(tab==='sale'){
  const note=document.createElement('div');note.className='notice';note.style.marginTop='18px';
  note.innerHTML='Use o celular para fotografar os comprovantes Pix. O caixa pode continuar atendendo. <button id="receiptShortcut" class="small">Celular e comprovantes</button>';
  $('content').append(note);$('receiptShortcut').onclick=()=>{tab='receipts';render();};
 }
};
function renderReceiptScreen(){
 const sessions=state.sessions.filter(s=>s.box===box).slice().reverse();
 if(receiptBox!==box||!sessions.some(s=>s.id===receiptSession)){receiptBox=box;receiptSession=session()?.id||sessions[0]?.id||'';}
 $('content').innerHTML='<section class="panel"><div class="row" style="justify-content:space-between"><div><h2>Comprovantes Pix · Caixa 0'+box+'</h2><p class="muted">Conecte o celular uma vez. As fotos chegam aqui sem interromper as vendas.</p></div><button id="pairPhone" class="primary" '+(!session()?'disabled':'')+'>Conectar celular por QR Code</button></div>'+(!session()?'<p class="notice" style="margin-top:16px">Abra o caixa para conectar um celular.</p>':'')+'<label for="receiptSession">Turno</label><select id="receiptSession">'+sessions.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===receiptSession?'selected':'')+'>'+esc(s.operator)+' · '+esc(new Date(s.opened).toLocaleString('pt-BR'))+(s.closed?' · Fechado':' · Aberto')+'</option>').join('')+'</select><p class="muted" id="receiptStatus" role="status" style="margin-top:18px">Carregando comprovantes…</p><div id="receiptRows" class="scroll"></div><button id="refreshReceipts" style="margin-top:18px">Atualizar</button></section>';
 $('pairPhone').onclick=connectReceiptPhone;$('receiptSession').onchange=e=>{receiptSession=e.target.value;refreshReceiptScreen();};$('refreshReceipts').onclick=()=>refreshReceiptScreen();refreshReceiptScreen();
}
async function refreshReceiptScreen(){
 const requestId=++receiptView,requestedBox=box,requestedSession=receiptSession;
 try{
  const data=await request('/api/receipts?box='+box+'&session='+encodeURIComponent(receiptSession));
  if(requestId!==receiptView||tab!=='receipts'||requestedBox!==box||requestedSession!==receiptSession||!$('receiptRows'))return;
  $('receiptStatus').textContent=data.pending?data.pending+' comprovante(s) pendente(s) de foto.':'Todos os comprovantes deste turno foram recebidos.';
  $('receiptRows').innerHTML=data.sales.length?'<table><thead><tr><th>Pedido</th><th>Horário</th><th>Tickets</th><th>Valor</th><th>Foto / ações</th></tr></thead><tbody>'+data.sales.map(s=>{const sale=state.sales.find(v=>v.id===s.id);return '<tr><td>#'+s.number+'</td><td>'+esc(new Date(s.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))+'</td><td>'+esc(s.tickets.join(', ')||'Sem tickets')+'</td><td>'+money(s.total)+'</td><td><div class="row">'+(s.received?'<button class="small" data-photo="'+esc(s.id)+'">Ver foto Pix</button>':'<span class="muted">Pendente de foto</span>')+(sale&&canCancelSale(sale)?'<button class="small danger" data-cancel="'+esc(s.id)+'">Cancelar venda</button>':'')+'</div></td></tr>';}).join('')+'</tbody></table>':'<p class="empty">Nenhuma venda Pix neste turno.</p>';
 }catch(e){if(requestId===receiptView&&$('receiptStatus'))$('receiptStatus').textContent=e.message+' Use Atualizar para tentar novamente.';}
}
async function connectReceiptPhone(){
 const button=$('pairPhone');button.disabled=true;
 try{
  const data=await request('/api/receipt-pair','POST',{box});
  showDialog('<h2>Celular do Caixa 0'+data.box+'</h2><p class="muted">Leia este QR Code com o celular da equipe. Mantenha a página aberta para fotografar cada pedido Pix.</p><img alt="QR Code para conectar o celular" src="'+esc(data.qr)+'" width="260" height="260" style="display:block;margin:12px auto;max-width:100%;height:auto"><p class="muted">Válido até encerrar o turno ou por 12 horas. Um novo QR Code desconecta o celular anterior.</p><div class="row" style="margin-top:18px"><button id="copyPhoneLink">Copiar link do celular</button><button id="closePhoneQr" class="primary">Continuar atendendo</button></div>');
  $('copyPhoneLink').onclick=async()=>{try{await navigator.clipboard.writeText(data.phoneUrl);toast('Link copiado. Envie somente ao celular da equipe.');}catch{toast('Leia o QR Code com o celular.');}};
  $('closePhoneQr').onclick=()=>{$('modal').close();tab='sale';render();};
 }catch(e){toast(e.message);}finally{if(button.isConnected)button.disabled=false;}
}
setInterval(async()=>{
 if(receiptLoading||!currentUser||document.hidden||tab!=='receipts')return;
 receiptLoading=true;try{await refreshReceiptScreen();}finally{receiptLoading=false;}
},8000);
function viewPixPhoto(id){
 const sale=state.sales.find(s=>s.id===id);if(!sale)return;
 showDialog('<div class="row" style="justify-content:space-between"><h2>Foto Pix · Pedido #'+sale.number+'</h2><button id="closePixPhoto" aria-label="Fechar foto">Fechar</button></div><p class="muted">'+money(sale.total)+' · Caixa 0'+sale.box+(sale.cancelled?' · Venda cancelada':'')+'</p><p id="photoStatus" class="muted" role="status" style="margin:12px 0">Carregando foto…</p><img id="pixPhoto" alt="Comprovante Pix do pedido '+sale.number+'" style="display:block;max-width:100%;max-height:70vh;object-fit:contain;margin:12px auto" hidden><button id="retryPixPhoto" hidden>Tentar carregar novamente</button>');
 const modal=$('modal');modal.style.maxWidth='1000px';modal.addEventListener('close',()=>{modal.style.maxWidth='';},{once:true});$('closePixPhoto').onclick=()=>modal.close();
 const image=$('pixPhoto'),status=$('photoStatus'),retry=$('retryPixPhoto');
 image.onload=()=>{image.hidden=false;status.textContent='';retry.hidden=true;};image.onerror=()=>{image.hidden=true;status.textContent='Foto indisponível. Ela pode ainda não ter sido enviada. Tente carregar novamente.';retry.hidden=false;};
 const load=()=>{image.hidden=true;status.textContent='Carregando foto…';retry.hidden=true;image.src='/api/receipt-image?id='+encodeURIComponent(id)+'&t='+Date.now();};retry.onclick=load;load();
}
document.addEventListener('click',e=>{const button=e.target.closest('button[data-photo]');if(button)viewPixPhoto(button.dataset.photo);});
