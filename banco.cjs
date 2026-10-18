const {Pool}=require('pg');
const validate=require('./validate.cjs');
function createStore(connectionString){
  if(!connectionString)throw Error('DATABASE_URL não configurada.');
  const pool=new Pool({connectionString,max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:30000,query_timeout:20000});
  pool.on('error',e=>console.error('Conexão com Neon interrompida. Código: '+(e.code||'REDE')));
  async function get(){const result=await pool.query("SELECT revision,state FROM public.js_caixa_estado WHERE id='noite-lasanha'");if(!result.rows.length)throw Error('Execute npm run banco para inicializar o banco.');return result.rows[0];}
  async function save(revision,next){validate(next);const result=await pool.query("UPDATE public.js_caixa_estado SET state=$1::jsonb,revision=revision+1,updated_at=now() WHERE id='noite-lasanha' AND revision=$2 RETURNING revision,state",[JSON.stringify(next),revision]);if(result.rows.length)return {ok:true,...result.rows[0]};return {ok:false,...await get()};}
  return {get,save,close:()=>pool.end()};
}
module.exports=createStore;
