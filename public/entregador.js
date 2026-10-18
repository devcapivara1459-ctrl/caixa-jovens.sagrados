'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentUser=null,state={presales:[]},revision=0,busy=false,tab='routes',pollingDriver=false;
function render(){}
function activePresales(){return state.presales;}
let toastTimer;function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
function showDialog(html){$('modal').innerHTML=html;$('modal').showModal();$('modal').querySelector('input')?.focus();}
function presaleTable(rows){return '<table><thead><tr><th>Cliente / telefone</th><th>Tickets</th><th>Endereço</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.customer)+'<br>'+esc(p.phone)+'</td><td>'+esc(p.numbers.join(', '))+'</td><td>'+esc(p.address)+'</td></tr>').join('')+'</tbody></table>';}
function print(html){$('printArea').innerHTML=html;window.print();}
async function request(url,method='GET',data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Requested-With':'caixa'},...(data?{body:JSON.stringify(data)}:{}),signal:controller.signal});const body=await r.json();if(r.status===401){location.replace('/');throw Error('Entre novamente para continuar.');}if(!r.ok)throw Object.assign(Error(body.error||'Os pedidos foram atualizados. Confira e tente novamente.'),{status:r.status,data:body});return body;}finally{clearTimeout(timer);}
}
async function change(fn){
 if(busy)return false;busy=true;const next=structuredClone(state);
 try{fn(next);const data=await request('/api/delivery','POST',{revision,state:next});state=data.state;revision=data.revision;return true;}
 catch(e){if(e.status===409){state=e.data.state;revision=e.data.revision;}toast(e.name==='AbortError'?'A conexão demorou. Confira a internet e tente novamente.':e.message);return false;}finally{busy=false;}
}
async function bootDriver(){
 try{currentUser=(await request('/api/me')).user;if(!['entregador','admin'].includes(currentUser.role)){location.replace('/');return;}$('driverName').textContent=currentUser.name+' · '+(currentUser.role==='admin'?'Administrador':'Entregador');const data=await request('/api/delivery');state=data.state;revision=data.revision;$('driverLoading').hidden=true;render();}
 catch(e){$('driverLoading').textContent='Não foi possível carregar as entregas. '+e.message;return;}
 setInterval(async()=>{if(document.hidden||busy||pollingDriver||$('modal').open||['INPUT','SELECT'].includes(document.activeElement?.tagName))return;pollingDriver=true;try{const data=await request('/api/delivery');if(data.revision!==revision){const changed=JSON.stringify(state)!==JSON.stringify(data.state);state=data.state;revision=data.revision;if(changed)render();}}catch(e){toast(e.message);}finally{pollingDriver=false;}},5000);
}
$('driverLogout').onclick=async()=>{try{await request('/api/logout','POST',{});location.replace('/');}catch(e){toast(e.message);}};
$('driverPassword').onclick=()=>{
 showDialog('<h2>Minha senha</h2><form id="driverPasswordForm"><label for="driverOldPassword">Senha atual</label><input id="driverOldPassword" type="password" autocomplete="current-password" required><label for="driverNewPassword">Nova senha (mínimo 10 caracteres)</label><input id="driverNewPassword" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><label for="driverRepeatPassword">Repita a nova senha</label><input id="driverRepeatPassword" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><div class="row" style="margin-top:18px"><button class="primary" id="driverSavePassword">Salvar senha</button><button type="button" id="driverClosePassword">Voltar</button></div></form>');
 $('driverClosePassword').onclick=()=>$('modal').close();$('driverPasswordForm').onsubmit=async e=>{e.preventDefault();if($('driverNewPassword').value!==$('driverRepeatPassword').value)return toast('As senhas não coincidem.');$('driverSavePassword').disabled=true;try{await request('/api/password','POST',{current:$('driverOldPassword').value,password:$('driverNewPassword').value});location.replace('/');}catch(error){toast(error.message);$('driverSavePassword').disabled=false;}};
};

