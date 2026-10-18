'use strict';
// Registros históricos ficam no mesmo estado/revisão das vendas do evento.
const activePresales = () => (state.presales || []).filter(p => !p.cancelled);
const presaleTotal = () => activePresales().reduce((sum, p) => sum + p.amount, 0);
const originalSave = save;
save = async function (next) {
  const buttons = [...document.querySelectorAll('main button')].map(button => [button, button.disabled]);
  try { return await originalSave(next); }
  finally { for (const [button, disabled] of buttons) if (button.isConnected) button.disabled = disabled; }
};
const originalOccupied = occupied;
occupied = function () { return new Set([...originalOccupied(), ...activePresales().flatMap(p => p.numbers)]); };

const originalRender = render;
render = function () {
  const admin = currentUser?.role === 'admin';
  let button = document.querySelector('[data-tab="presales"]');
  if (!button) {
    button = document.createElement('button');
    button.dataset.tab = 'presales';
    button.textContent = 'Pré-vendas e entregas';
    document.querySelector('.tabs').append(button);
  }
  button.hidden = !admin;
  const presalesTab = admin && tab === 'presales';
  if (tab === 'presales') tab = 'sale';
  originalRender();
  if (presalesTab) {
    tab = 'presales';
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    renderPresales();
  }
  if (admin) {
    const received = liveSales().reduce((sum, sale) => sum + sale.total, 0);
    const first = $('stats').querySelector('.stat');
    if (first) first.innerHTML = '<span>Arrecadação total · evento + pré-vendas</span><strong>' + money(received + presaleTotal()) + '</strong>';
    const ticketCount = $('stats').querySelectorAll('.stat strong')[2];
    if (ticketCount) ticketCount.textContent = liveSales().flatMap(s => s.items.flatMap(i => i.numbers)).length + activePresales().reduce((n, p) => n + p.numbers.length, 0);
    $('stats').insertAdjacentHTML('beforeend', '<div class="stat"><span>Pré-vendas recebidas</span><strong>' + money(presaleTotal()) + '</strong></div>');
  }
};

function presaleRows(rows, actions = false) {
  return rows.map(p => '<tr><td><strong>' + esc(p.customer) + '</strong><br><span class="muted">' + esc(p.date.split('-').reverse().join('/')) + '</span>' + (p.cancelled ? '<br><span class="danger">Cancelada</span>' : '') + '</td><td>' + esc(p.seller) + '</td><td>' + p.numbers.map(n => '#' + String(n).padStart(3, '0')).join(', ') + '</td><td>' + money(p.amount) + '<br><span class="muted">' + esc(p.method) + '</span></td><td>' + (p.delivery ? '<strong>Entrega no endereço</strong><br>' + esc(p.address) : 'Retirada no evento') + (p.phone ? '<br><span class="muted">' + esc(p.phone) + '</span>' : '') + '</td>' + (actions ? '<td>' + (!p.cancelled ? '<button class="small" data-presale-edit="' + esc(p.id) + '">Editar</button> <button class="small danger" data-presale-cancel="' + esc(p.id) + '">Cancelar</button>' : '') + '</td>' : '') + '</tr>').join('') || '<tr><td colspan="' + (actions ? 6 : 5) + '">Nenhuma pré-venda encontrada.</td></tr>';
}
function presaleTable(rows, actions = false) {
  return '<div class="scroll"><table><thead><tr><th>Cliente / data</th><th>Vendedor</th><th>Tickets</th><th>Valor recebido</th><th>Entrega / retirada</th>' + (actions ? '<th>Ações</th>' : '') + '</tr></thead><tbody>' + presaleRows(rows, actions) + '</tbody></table></div>';
}
function renderPresales() {
  $('content').innerHTML = '<section class="panel"><div class="row" style="justify-content:space-between"><div><h2>Pré-vendas e entregas</h2><p class="muted">Lance as vendas anteriores ao evento. O valor recebido entra na prestação de contas, sem entrar no fechamento dos caixas de hoje.</p></div><button id="newPresale" class="primary">+ Registrar pré-venda</button></div><div class="row" style="margin:20px 0"><input id="presaleSearch" class="search" aria-label="Buscar pré-venda" placeholder="Cliente, vendedor ou ticket"><select id="presaleFilter" aria-label="Filtrar pré-vendas" style="max-width:240px"><option value="all">Todas as pré-vendas</option><option value="delivery">Entrega no endereço</option><option value="pickup">Retirada no evento</option><option value="cancelled">Canceladas</option></select><button id="presaleCSV">Exportar pré-vendas (CSV)</button><button id="deliveryPrint">Imprimir lista de entregas</button></div><p class="muted" id="presaleSummary"></p><div id="presaleList"></div></section>';
  const update = () => {
    const q = $('presaleSearch').value.trim().toLocaleLowerCase('pt-BR'), filter = $('presaleFilter').value;
    const rows = (state.presales || []).filter(p => (filter === 'cancelled' ? p.cancelled : !p.cancelled) && (filter !== 'delivery' || p.delivery) && (filter !== 'pickup' || !p.delivery) && (!q || [p.customer, p.seller, p.numbers.join(' '), p.address].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
    $('presaleSummary').textContent = rows.length + ' registros · ' + rows.reduce((n, p) => n + p.numbers.length, 0) + ' tickets · ' + money(rows.filter(p => !p.cancelled).reduce((n, p) => n + p.amount, 0)) + ' recebidos';
    $('presaleList').innerHTML = presaleTable(rows, true);
  };
  $('newPresale').onclick = () => editPresale();
  $('presaleSearch').oninput = update;
  $('presaleFilter').onchange = update;
  $('presaleCSV').onclick = exportPresales;
  $('deliveryPrint').onclick = () => print('<h1>Entregas · ' + esc(state.event) + '</h1><p>Pré-vendas para entrega no endereço do cliente</p>' + presaleTable(activePresales().filter(p => p.delivery)));
  update();
}
function parsePresaleNumbers(value) {
  const parts = value.trim().split(/[\s,;]+/).filter(Boolean);
  const result = [];
  for (const part of parts) {
    if (!/^#?\d+$/.test(part)) throw Error('Separe os números dos tickets por vírgula. Exemplo: 12, 13, 14.');
    result.push(Number(part.replace('#', '')));
  }
  if (!result.length || new Set(result).size !== result.length || result.some(n => !Number.isInteger(n) || n < 1 || n > state.limit)) throw Error('Informe tickets diferentes, entre 1 e ' + state.limit + '.');
  return result.sort((a, b) => a - b);
}
function editPresale(id) {
  if (currentUser?.role !== 'admin') return;
  const previous = (state.presales || []).find(p => p.id === id);
  const p = previous || {customer:'', seller:'', numbers:[], amount:0, method:'PIX', delivery:false, address:'', phone:'', date:new Date().toLocaleDateString('en-CA')};
  showDialog('<h2>' + (previous ? 'Editar' : 'Registrar') + ' pré-venda</h2><form id="presaleForm"><label for="presaleCustomer">Nome do cliente</label><input id="presaleCustomer" required maxlength="100" value="' + esc(p.customer) + '"><label for="presaleSeller">Nome do vendedor</label><input id="presaleSeller" required maxlength="100" value="' + esc(p.seller) + '"><label for="presaleNumbers">Números dos tickets</label><input id="presaleNumbers" required placeholder="Ex.: 12, 13, 14" value="' + p.numbers.join(', ') + '"><p class="muted">Os números ficam reservados e não podem ser vendidos novamente.</p><div class="formgrid"><div><label for="presaleDate">Data da pré-venda</label><input id="presaleDate" type="date" required value="' + esc(p.date) + '"></div><div><label for="presaleAmount">Valor total recebido (R$)</label><input id="presaleAmount" inputmode="decimal" required placeholder="0,00" value="' + (previous ? (p.amount / 100).toFixed(2).replace('.', ',') : '') + '"></div></div><p class="muted">Informe o valor já recebido por estes tickets. Use 0,00 se ainda não houve pagamento e edite quando receber.</p><label for="presaleMethod">Forma de pagamento</label><select id="presaleMethod">' + payments.map(m => '<option ' + (m === p.method ? 'selected' : '') + '>' + esc(m) + '</option>').join('') + '</select><label for="presaleDelivery">Como o cliente recebe?</label><select id="presaleDelivery"><option value="pickup">Retirada no evento</option><option value="delivery" ' + (p.delivery ? 'selected' : '') + '>Entrega no endereço do cliente</option></select><div id="presaleAddressArea"><label for="presaleAddress">Endereço completo de entrega</label><input id="presaleAddress" maxlength="500" placeholder="Rua, número, bairro e complemento" value="' + esc(p.address) + '"></div><label for="presalePhone">Telefone do cliente (opcional)</label><input id="presalePhone" type="tel" maxlength="40" value="' + esc(p.phone) + '"><p id="presaleError" class="danger" role="alert" style="margin-top:12px"></p><div class="row" style="margin-top:16px"><button class="primary" id="presaleSubmit">Salvar pré-venda</button><button type="button" id="presaleClose">Voltar</button></div></form>');
  const updateDelivery = () => { const delivery = $('presaleDelivery').value === 'delivery'; $('presaleAddressArea').hidden = !delivery; $('presaleAddress').required = delivery; };
  $('presaleDelivery').onchange = updateDelivery;
  $('presaleClose').onclick = () => $('modal').close();
  updateDelivery();
  $('presaleForm').onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const numbers = parsePresaleNumbers($('presaleNumbers').value), amount = parseMoney($('presaleAmount').value);
      if (!Number.isSafeInteger(amount) || amount < 0) throw Error('Informe um valor recebido válido.');
      const taken = new Set([...liveSales().flatMap(s => s.items.flatMap(i => i.numbers)), ...Object.values(state.boxes).flatMap(b => b.cart.flatMap(i => i.numbers)), ...activePresales().filter(x => x.id !== id).flatMap(x => x.numbers)]);
      const duplicate = numbers.find(n => taken.has(n));
      if (duplicate !== undefined) throw Error('Ticket #' + duplicate + ' já vendido ou reservado. Confira a numeração.');
      const delivery = $('presaleDelivery').value === 'delivery';
      const record = {id:previous?.id || uid(), customer:$('presaleCustomer').value.trim(), seller:$('presaleSeller').value.trim(), numbers, amount, method:$('presaleMethod').value, date:$('presaleDate').value, delivery, address:delivery ? $('presaleAddress').value.trim() : '', phone:$('presalePhone').value.trim(), cancelled:false};
      if (!record.customer || !record.seller || (delivery && !record.address)) throw Error('Preencha cliente, vendedor e endereço de entrega.');
      $('presaleSubmit').disabled = true;
      if (await change(s => { s.presales ||= []; const i = s.presales.findIndex(x => x.id === record.id); if (i < 0) s.presales.push(record); else s.presales[i] = record; })) { $('modal').close(); render(); toast('Pré-venda salva e incluída na prestação de contas.'); }
    } catch (error) { $('presaleError').textContent = error.message; }
    finally { if ($('presaleSubmit')) $('presaleSubmit').disabled = false; }
  };
}
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b || currentUser?.role !== 'admin' || busy) return;
  if (b.dataset.presaleEdit) editPresale(b.dataset.presaleEdit);
  if (b.dataset.presaleCancel && confirm('Cancelar esta pré-venda? Os tickets serão liberados e o valor sairá da prestação de contas. Faça o estorno separadamente, se necessário.')) {
    if (await change(s => { const p = s.presales.find(x => x.id === b.dataset.presaleCancel); if (p) p.cancelled = true; })) { render(); toast('Pré-venda cancelada.'); }
  }
});

const originalReportHTML = reportHTML;
reportHTML = function () {
  const original = originalReportHTML();
  if (currentUser?.role !== 'admin' || reportBox !== 'all') return original;
  const rows = activePresales(), eventTotal = liveSales().reduce((sum, p) => sum + p.total, 0);
  return original + '<section style="margin-top:32px"><h2>Pré-vendas</h2><p class="muted">Recebimentos anteriores ao evento, separados dos fechamentos dos caixas.</p><div class="summary">' + payments.map(m => '<div><span class="muted">' + esc(m) + '</span><strong>' + money(rows.filter(p => p.method === m).reduce((n, p) => n + p.amount, 0)) + '</strong></div>').join('') + '</div>' + presaleTable(rows) + '<h3 style="margin-top:20px">Recebido em pré-vendas: ' + money(presaleTotal()) + '</h3><h2 style="margin-top:20px">Total geral recebido: ' + money(eventTotal + presaleTotal()) + '</h2><p class="muted">Vendas no evento: ' + money(eventTotal) + ' + pré-vendas: ' + money(presaleTotal()) + '</p></section>';
};
function presaleCSVRows() {
  return (state.presales || []).map(p => ['Pré-venda', p.date, p.customer, p.seller, p.numbers.join(', '), (p.amount / 100).toFixed(2).replace('.', ','), p.method, p.delivery ? 'Entrega no endereço' : 'Retirada no evento', p.address, p.phone, p.cancelled ? 'Cancelada' : 'Confirmada']);
}
function savePresaleCSV(name, rows) {
  const cell = value => '"' + String(value).replace(/^[=+@\-\t\r]/, "'").replace(/"/g, '""') + '"';
  download(name, '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
const presaleCSVHeader = ['Tipo', 'Data', 'Cliente', 'Vendedor', 'Tickets', 'Valor recebido R$', 'Pagamento', 'Entrega / retirada', 'Endereço', 'Telefone', 'Status'];
function exportPresales() { savePresaleCSV('pre-vendas.csv', [presaleCSVHeader, ...presaleCSVRows()]); }
const originalExportCSV = exportCSV;
exportCSV = function () {
  if (currentUser?.role !== 'admin' || reportBox !== 'all') return originalExportCSV();
  const rows = reportSales().map(v => ['Venda no evento', v.at, '', v.operator, v.items.flatMap(i => i.numbers).join(', '), (v.total / 100).toFixed(2).replace('.', ','), v.method, '', '', '', v.cancelled ? 'Cancelada' : 'Confirmada']);
  savePresaleCSV('prestacao-de-contas.csv', [presaleCSVHeader, ...rows, ...presaleCSVRows()]);
};
