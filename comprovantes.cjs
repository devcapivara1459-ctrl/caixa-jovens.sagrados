'use strict';
const {createHash,randomBytes}=require('crypto');
const hash=t=>createHash('sha256').update(t).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const isPix=s=>s.method==='PIX'||s.method==='PIX maquininha';
function activeSession(state,box){const id=state.boxes[box]?.session;return state.sessions.find(s=>s.id===id&&s.box===box&&!s.closed);}
function allowed(user,box){if(![1,2].includes(box)||(user.role!=='admin'&&user.box!==box))throw fail(403,'Caixa não autorizado.');}
function decodeImage(data){
 if(typeof data!=='string'||data.length>699076||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw fail(400,'Envie uma foto JPEG de até 512 KB.');
 const image=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
 if(image.length<4||image.length>524288||image[0]!==255||image[1]!==216||image[2]!==255||image.at(-2)!==255||image.at(-1)!==217)throw fail(400,'Foto inválida. Tire novamente.');
 return image;
}
function createReceipts(connectionString,{pool,qr}={}){
 pool=pool||new(require('pg').Pool)({connectionString,max:2,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,query_timeout:20000});
 pool.on?.('error',e=>console.error('Conexão dos comprovantes: '+(e.code||'REDE')));
 async function pair(user,state,box,origin){
  allowed(user,box);const ss=activeSession(state,box);if(!ss)throw fail(409,'Abra o caixa antes de conectar o celular.');
  const token=randomBytes(32).toString('hex'),phoneUrl=origin+'/comprovante.html#'+token;
  const svg=await (qr||require('qrcode')).toString(phoneUrl,{type:'svg',margin:2,width:260,errorCorrectionLevel:'M'});
  await pool.query('INSERT INTO public.js_caixa_foto_celulares(token_hash,user_id,session_id,box,expires_at) VALUES($1,$2,$3,$4,now()+interval \'12 hours\') ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash,user_id=excluded.user_id,expires_at=excluded.expires_at',[hash(token),user.id,ss.id,box]);
  return {phoneUrl,qr:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),box,session:ss.id};
 }
 async function phone(token,state){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw fail(401,'Conecte o celular pelo QR Code do caixa.');
  const result=await pool.query('SELECT p.user_id,p.session_id,p.box FROM public.js_caixa_foto_celulares p JOIN public.js_caixa_usuarios u ON u.id=p.user_id WHERE p.token_hash=$1 AND p.expires_at>now() AND u.active=true AND (u.role=\'admin\' OR u.box=p.box)',[hash(token)]);
  const p=result.rows[0];if(!p||activeSession(state,p.box)?.id!==p.session_id)throw fail(401,'Conexão encerrada. Leia um novo QR Code no caixa.');return p;
 }
 async function list(state,box,sessionId){
  const rows=await pool.query('SELECT sale_id,created_at FROM public.js_caixa_comprovantes WHERE session_id=$1',[sessionId]);
  const done=new Map(rows.rows.map(r=>[r.sale_id,r.created_at]));
  const sales=state.sales.filter(s=>s.box===box&&s.session===sessionId&&!s.cancelled&&isPix(s)).map(s=>({id:s.id,number:s.number,total:s.total,at:s.at,tickets:s.items.flatMap(i=>i.numbers||[]),received:done.has(s.id),receivedAt:done.get(s.id)||null}));
  return {box,session:sessionId,pending:sales.filter(s=>!s.received).length,sales:sales.reverse()};
 }
 async function upload(p,state,data){
  const sale=state.sales.find(s=>s.id===data.saleId&&s.box===p.box&&s.session===p.session_id&&!s.cancelled&&isPix(s));
  if(!sale)throw fail(403,'Esse pedido não pertence às vendas Pix deste turno.');
  const image=decodeImage(data.image);
  await pool.query('INSERT INTO public.js_caixa_comprovantes(sale_id,session_id,box,uploaded_by,image) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sale_id) DO NOTHING',[sale.id,p.session_id,p.box,p.user_id,image]);
  return {ok:true,saleId:sale.id};
 }
 async function image(user,id){
  if(typeof id!=='string'||id.length>120)throw fail(400,'Pedido inválido.');
  const result=await pool.query('SELECT box,image FROM public.js_caixa_comprovantes WHERE sale_id=$1',[id]);
  const row=result.rows[0];if(!row)throw fail(404,'Comprovante não encontrado.');allowed(user,row.box);return row.image;
 }
 async function notebook(user,state,box,sessionId){
  allowed(user,box);const ss=state.sessions.find(s=>s.box===box&&s.id===sessionId);if(!ss)return {box,pending:0,sales:[]};return list(state,box,ss.id);
 }
 return {pair,phone,list,upload,image,notebook,close:()=>pool.end()};
}
module.exports=createReceipts;
module.exports.decodeImage=decodeImage;
module.exports.activeSession=activeSession;
