'use strict';
(()=>{
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 let token='',selected=null,photo=null,uploading=false,polling=false,stopped=false,pending=[],lastSuccess='';
 try{token=location.hash.slice(1)||sessionStorage.getItem('caixa-photo-token')||'';if(location.hash){sessionStorage.setItem('caixa-photo-token',token);history.replaceState(null,'',location.pathname);}}catch{token=location.hash.slice(1);history.replaceState(null,'',location.pathname);}
 async function api(method='GET',body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{const r=await fetch('/api/phone-receipts',{method,headers:{'Content-Type':'application/json','X-Requested-With':'caixa','Authorization':'Bearer '+token},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});const data=await r.json();if(!r.ok){if(r.status===401)stopped=true;throw Error(data.error||'Não foi possível enviar.');}return data;}finally{clearTimeout(timer);}
 }
 function status(text){$('status').textContent=text;}
 async function refresh(){
  if(polling||uploading||stopped)return;polling=true;
  try{const data=await api();$('title').textContent='Celular do Caixa 0'+data.box;pending=data.sales.filter(s=>!s.received);
   if(!selected){status(lastSuccess+(pending.length?pending.length+' pedido(s) aguardando foto. Toque no pedido correto.':'Tudo em dia. A próxima venda Pix aparecerá aqui.'));
    $('orders').innerHTML=pending.length?pending.map(s=>'<article class="card"><div class="row"><h2>Pedido #'+s.number+'</h2><strong>'+money(s.total)+'</strong></div><p class="muted">'+esc(new Date(s.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))+' · Tickets: '+esc(s.tickets.join(', ')||'Sem tickets')+'</p><button class="camera" data-sale="'+esc(s.id)+'">Fotografar pedido #'+s.number+'</button></article>').join(''):'<div class="card"><h2 class="ok">Nenhuma foto pendente</h2><p class="muted">Pode manter esta página aberta. O notebook continua atendendo normalmente.</p></div>';
   }
  }catch(e){status(stopped?e.message:(e.name==='AbortError'?'A conexão demorou. Toque em Atualizar pedidos.':'Sem conexão. '+e.message));}finally{polling=false;}
 }
 function choose(s){selected=s;photo=null;lastSuccess='';$('orders').hidden=true;$('capture').hidden=false;$('captureTitle').textContent='Pedido #'+s.number+' · '+money(s.total);$('captureDetails').textContent='Tickets: '+(s.tickets.join(', ')||'Sem tickets');$('preview').hidden=true;$('send').hidden=true;$('send').textContent='Enviar foto';status('Fotografe o comprovante deste pedido.');$('camera').value='';$('camera').click();}
 $('orders').onclick=e=>{const b=e.target.closest('[data-sale]');if(b){const sale=pending.find(s=>s.id===b.dataset.sale);if(sale)choose(sale);}};
 async function compress(file){
  if(file.size>25*1024*1024)throw Error('Imagem muito grande. Tire outra foto.');
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir a imagem. Use a câmera ou um arquivo JPEG.'));img.src=url;});
   const scale=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   let data;for(const quality of [.76,.6,.45]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<680000)return data;}throw Error('Foto muito grande. Aproxime a câmera do comprovante e tente novamente.');
  }finally{URL.revokeObjectURL(url);}
 }
 $('camera').onchange=async()=>{const file=$('camera').files[0],sale=selected;if(!file||!sale)return;$('retake').disabled=true;status('Preparando foto…');try{const data=await compress(file);if(selected!==sale)return;photo=data;$('preview').src=data;$('preview').hidden=false;$('send').hidden=false;await send();}catch(e){status(e.message);}finally{$('retake').disabled=false;}};
 async function send(){
  if(!selected||!photo||uploading)return;uploading=true;$('send').disabled=true;$('cancel').disabled=true;$('retake').disabled=true;const number=selected.number;status('Enviando foto do pedido #'+number+'…');
  try{await api('POST',{saleId:selected.id,image:photo});selected=null;photo=null;$('preview').removeAttribute('src');$('capture').hidden=true;$('orders').hidden=false;lastSuccess='Foto do pedido #'+number+' recebida! ';status(lastSuccess);}
  catch(e){status((e.name==='AbortError'?'A conexão demorou.':e.message)+' A foto continua aqui. Toque em Tentar enviar novamente.');$('send').textContent='Tentar enviar novamente';}
  finally{uploading=false;$('send').disabled=false;$('cancel').disabled=false;$('retake').disabled=false;if(!selected)await refresh();}
 }
 $('send').onclick=send;$('retake').onclick=()=>{if(uploading)return;photo=null;$('send').hidden=true;$('preview').hidden=true;$('camera').value='';$('camera').click();};$('cancel').onclick=()=>{if(photo&&!confirm('Descartar a foto que ainda não foi enviada?'))return;selected=null;photo=null;$('preview').removeAttribute('src');$('capture').hidden=true;$('orders').hidden=false;refresh();};
 $('refresh').onclick=()=>{if(stopped){status('Leia um novo QR Code no notebook para conectar novamente.');return;}refresh();};
 if(!/^[a-f0-9]{64}$/.test(token)){stopped=true;status('Abra Comprovantes Pix no notebook e leia o QR Code para conectar este celular.');}else refresh();
 setInterval(()=>{if(!document.hidden)refresh();},4000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('beforeunload',e=>{if(photo){e.preventDefault();e.returnValue='';}});
})();
