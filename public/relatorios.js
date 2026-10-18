(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CaixaReports=factory();})(globalThis,function(){
  'use strict';
  const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):String(value||'');};
  const sum=(rows,key)=>rows.reduce((n,row)=>n+row[key],0);
  function build(state,user,{type='resumido',box='all',source='all',now=new Date()}={}){
    const admin=user.role==='admin';
    if(!admin){box=String(user.box);if(source==='pre-vendas')throw Error('Entre como administrador para consultar as pré-vendas.');}
    const includePresales=admin&&box==='all',presales=includePresales?(state.presales||[]):[];
    const allSales=source==='pre-vendas'?[]:state.sales.filter(s=>box==='all'||s.box===Number(box));
    const sales=allSales.filter(s=>!s.cancelled),active=presales.filter(p=>!p.cancelled);
    const eventTotal=sum(sales,'total'),presaleTotal=sum(active,'amount');
    const sections=[],table=(title,headers,rows,widths)=>sections.push({title,headers,rows:rows.length?rows:[headers.map((_,i)=>i===0?'Nenhum registro.':'')],widths});
    const text=(title,value)=>sections.push({title,text:value});
    const tickets=sales.flatMap(s=>s.items.flatMap(i=>i.numbers)).length+active.reduce((n,p)=>n+p.numbers.length,0);
    text('Total recebido',money(eventTotal+presaleTotal));
    text('Composição',source==='pre-vendas'?'Recebido em pré-vendas: '+money(presaleTotal):'Vendas do evento: '+money(eventTotal)+(includePresales?' | Pré-vendas: '+money(presaleTotal):''));
    text('Quantidade',sales.length+' vendas no evento | '+active.length+' pré-vendas | '+tickets+' tickets');
    text('Cancelamentos excluídos dos totais',allSales.filter(s=>s.cancelled).length+' vendas | '+presales.filter(p=>p.cancelled).length+' pré-vendas');
    const methods=[...new Set(['PIX','PIX maquininha','Dinheiro','Crédito','Débito',...sales.map(s=>s.method),...active.map(p=>p.method)])];
    table('Recebimentos por pagamento',['Pagamento','Evento','Pré-vendas','Total'],methods.map(method=>{const a=sum(sales.filter(s=>s.method===method),'total'),b=sum(active.filter(p=>p.method===method),'amount');return [method,money(a),money(b),money(a+b)];}),[0.28,0.24,0.24,0.24]);
    if(source!=='pre-vendas'){
      const products=new Map();for(const sale of sales)for(const item of sale.items){const row=products.get(item.name)||[item.name,0,0];row[1]+=item.qty;row[2]+=item.qty*item.price;products.set(item.name,row);}
      table('Produtos vendidos no evento',['Produto','Quantidade','Valor'],[...products.values()].map(r=>[r[0],r[1],money(r[2])]),[0.5,0.2,0.3]);
    }
    if(includePresales){
      const sellers=new Map();for(const p of active){const row=sellers.get(p.seller)||[p.seller,0,0,0];row[1]++;row[2]+=p.numbers.length;row[3]+=p.amount;sellers.set(p.seller,row);}
      table('Pré-vendas por vendedor',['Vendedor','Pedidos','Tickets','Recebido'],[...sellers.values()].map(r=>[r[0],r[1],r[2],money(r[3])]),[0.4,0.15,0.15,0.3]);
      const deliveries=active.filter(p=>p.delivery),done=deliveries.filter(p=>p.deliveryStatus==='delivered').length;
      text('Entregas das pré-vendas',deliveries.length+' para entrega | '+done+' entregues | '+(deliveries.length-done)+' pendentes | '+active.filter(p=>!p.delivery).length+' para retirada');
    }
    if(source!=='pre-vendas'){
      const closed=state.sessions.filter(s=>s.closed&&(box==='all'||s.box===Number(box)));
      table('Fechamentos de caixa',['Caixa / responsável','Fundo inicial','Esperado','Contado','Diferença'],closed.map(s=>['Caixa 0'+s.box+' / '+s.operator,money(s.opening),money(s.expected),money(s.counted),money(s.difference)]),[0.32,0.17,0.17,0.17,0.17]);
      text('Conferência','O fundo inicial não é receita. Os fechamentos preservam os valores apurados no encerramento; pré-vendas não entram no caixa do dia.');
    }
    if(type==='detalhado'){
      if(source!=='pre-vendas')table('Vendas do evento - lançamentos',['Pedido / data','Caixa / operador','Produtos e tickets','Pagamento','Valor / situação'],allSales.map(s=>['#'+s.number+'\n'+date(s.at),'Caixa 0'+s.box+'\n'+s.operator,s.items.map(i=>i.qty+' x '+i.name+(i.numbers.length?' | Tickets: '+i.numbers.join(', '):'')).join('\n'),s.method,money(s.total)+'\n'+(s.cancelled?'Cancelada: '+(s.reason||''):'Confirmada')]),[0.2,0.18,0.32,0.13,0.17]);
      if(includePresales)table('Pré-vendas - lançamentos',['Cliente / data','Vendedor / tickets','Recebido / pagamento','Entrega ou retirada'],presales.map(p=>[p.customer+'\n'+p.date.split('-').reverse().join('/'),p.seller+'\nTickets: '+p.numbers.join(', '),money(p.amount)+'\n'+p.method+'\n'+(p.cancelled?'Cancelada':'Confirmada'),(p.delivery?'Entrega: '+(p.deliveryStatus==='delivered'?'Entregue':p.deliveryStatus==='out'?'Saiu para entrega':'Pendente')+'\n'+(p.address||'Localização por link'):'Retirada no evento')+(p.phone?'\nTelefone: '+p.phone:'')]),[0.24,0.28,0.21,0.27]);
    }
    return {title:(source==='pre-vendas'?'Pré-vendas':'Prestação de contas')+' - relatório '+type,event:state.event,subtitle:(source==='pre-vendas'?'Pré-vendas':box==='all'?'Todos os caixas':'Caixa 0'+box)+' | Evento: '+state.date.split('-').reverse().join('/'),generated:date(now),sections,total:eventTotal+presaleTotal,type};
  }
  function html(model){return '<header><p class="eyebrow">Jovens Sagrados</p><h1>'+esc(model.event)+'</h1><h2>'+esc(model.title)+'</h2><p>'+esc(model.subtitle)+'</p><p class="muted">Gerado em '+esc(model.generated)+'</p></header>'+model.sections.map(s=>'<section><h3>'+esc(s.title)+'</h3>'+(s.headers?'<table><colgroup>'+s.widths.map(w=>'<col style="width:'+w*100+'%">').join('')+'</colgroup><thead><tr>'+s.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell).replaceAll('\n','<br>')+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p'+(s.title==='Total recebido'?' class="grand-total"':'')+'>'+esc(s.text)+'</p>')+'</section>').join('')+'<footer>Responsável pela conferência: ____________________________________</footer>';}
  // Usa a mesma estrutura de dados da prévia para não divergir dos totais da tela.
  async function pdf(model,PDFLib){
    const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create();
    const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
    const width=595.28,height=841.89,margin=40,usable=width-margin*2,bottom=45;
    let page,y;const pages=[],compact=model.type==='resumido';
    const safe=value=>String(value??'').replace(/[\u202f\u00a0]/g,' ').replace(/[–—]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'?');
    const draw=(value,x,yy,size=9,font=regular,color=rgb(0.12,0.12,0.12))=>page.drawText(safe(value),{x,y:yy,size,font,color});
    const wrap=(value,available,size=9,font=regular)=>{
      const lines=[];for(const paragraph of safe(value).split('\n')){
        let line='';for(const word of paragraph.split(/\s+/)){
          if(!word)continue;
          const candidate=line?line+' '+word:word;
          if(font.widthOfTextAtSize(candidate,size)<=available){line=candidate;continue;}
          if(line){lines.push(line);line='';}
          if(font.widthOfTextAtSize(word,size)<=available){line=word;continue;}
          for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>available){lines.push(line);line='';}line+=char;}
        }lines.push(line);
      }return lines;
    };
    function newPage(){page=doc.addPage([width,height]);pages.push(page);y=height-margin;for(const line of wrap(model.event,usable,13,bold)){draw(line,margin,y,13,bold);y-=18;}for(const line of wrap(model.title,usable,10,bold)){draw(line,margin,y,10,bold);y-=16;}draw(model.subtitle,margin,y,8);y-=22;}
    function ensure(space){if(y-space<bottom)newPage();}
    function paragraph(value,size=9,font=regular){for(const line of wrap(value,usable,size,font)){ensure(size+7);draw(line,margin,y,size,font);y-=size+5;}}
    newPage();paragraph('Gerado em '+model.generated,8);y-=8;
    for(const section of model.sections){
      ensure(compact?45:65);paragraph(section.title,compact?10:11,bold);y-=3;
      if(!section.headers){paragraph(section.text,section.title==='Total recebido'?18:9,section.title==='Total recebido'?bold:regular);y-=compact?6:12;continue;}
      const widths=section.widths.map(w=>w*usable),lineHeight=12;
      const header=()=>{const h=section.headers.map((cell,i)=>wrap(cell,widths[i]-10,8,bold)),rowHeight=Math.max(...h.map(a=>a.length))*11+10;ensure(rowHeight);page.drawRectangle({x:margin,y:y-rowHeight+4,width:usable,height:rowHeight,color:rgb(0.94,0.93,0.92)});let x=margin;h.forEach((lines,i)=>{lines.forEach((line,j)=>draw(line,x+5,y-8-j*11,8,bold));x+=widths[i];});y-=rowHeight+2;};
      header();
      for(const row of section.rows){
        const cells=row.map((value,i)=>wrap(value,widths[i]-10));let offset=0,total=Math.max(...cells.map(c=>c.length));
        if(y-Math.min(total*lineHeight+10,180)<bottom){newPage();header();}
        while(offset<total){
          if(y-bottom<lineHeight+10){newPage();header();}
          const count=Math.min(total-offset,Math.max(1,Math.floor((y-bottom-10)/lineHeight)));
          let x=margin;cells.forEach((lines,i)=>{let visible=lines.slice(offset,offset+count);if(i===0&&offset>0&&!visible.length)visible=wrap('Continuação: '+String(row[0]).split('\n')[0],widths[0]-10).slice(0,count);visible.forEach((line,j)=>draw(line,x+5,y-8-j*lineHeight));x+=widths[i];});
          y-=count*lineHeight+10;page.drawLine({start:{x:margin,y:y+3},end:{x:width-margin,y:y+3},thickness:0.4,color:rgb(0.8,0.8,0.8)});offset+=count;
        }
      }y-=compact?8:16;
    }
    ensure(35);y-=16;paragraph('Responsável pela conferência: ____________________________________');
    pages.forEach((p,i)=>{p.drawText((i+1)+' / '+pages.length,{x:width-margin-40,y:22,size:8,font:regular});});
    doc.setTitle(model.title+' - '+model.event);doc.setCreator('Jovens Sagrados');
    return doc.save();
  }
  return {build,html,pdf};
});
