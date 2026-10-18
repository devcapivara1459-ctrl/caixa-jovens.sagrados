'use strict';
(async()=>{
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  const type=params.get('tipo')==='detalhado'?'detalhado':'resumido',box=['1','2'].includes(params.get('caixa'))?params.get('caixa'):'all',source=params.get('fonte')==='pre-vendas'?'pre-vendas':'all';
  async function get(path){const response=await fetch(path,{cache:'no-store'});if(response.status===401)throw Error('Entre no sistema e abra o relatório novamente.');if(!response.ok)throw Error('Não foi possível carregar os dados. Atualize esta página para tentar novamente.');return response.json();}
  try{
    const [{user},{state}]=await Promise.all([get('/api/me'),get('/api/state')]);
    const model=CaixaReports.build(state,user,{type,box,source});
    document.title=model.title+' - '+state.event;$('report').innerHTML=CaixaReports.html(model);$('status').textContent=type==='detalhado'?'Relatório detalhado':'Relatório resumido';
    $('print').disabled=false;$('pdf').disabled=false;
    $('print').onclick=()=>{if(typeof window.print==='function')window.print();$('message').textContent='Se a impressão não abrir neste navegador, use Baixar PDF e imprima o arquivo.';};
    $('pdf').onclick=async()=>{
      $('pdf').disabled=true;$('status').textContent='Gerando PDF…';
      try{
        const bytes=await CaixaReports.pdf(model,PDFLib),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
        link.href=url;link.download=(source==='pre-vendas'?'pre-vendas':'prestacao-de-contas')+'-'+type+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('status').textContent='PDF gerado.';
      }catch(error){$('message').textContent='Não foi possível gerar o PDF. Tente Imprimir / Salvar como PDF.';$('status').textContent='Falha ao gerar PDF.';}
      finally{$('pdf').disabled=false;}
    };
  }catch(error){$('status').textContent='Relatório indisponível';$('message').textContent=error.message;}
})();
