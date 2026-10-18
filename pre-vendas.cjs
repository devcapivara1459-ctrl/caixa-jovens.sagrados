'use strict';
const methods = ['PIX', 'PIX maquininha', 'Dinheiro', 'Crédito', 'Débito'];
const maps = require('./public/maps-location.js');
module.exports = function validatePresales(state) {
  if(state.deliveryOrigin!==undefined&&(typeof state.deliveryOrigin!=='string'||!state.deliveryOrigin.trim()||state.deliveryOrigin.length>500))throw Error('Ponto de partida inválido.');
  if(state.deliveryOriginLocation!==undefined&&(typeof state.deliveryOriginLocation!=='string'||(state.deliveryOriginLocation&&!maps.parse(state.deliveryOriginLocation))))throw Error('Localização de partida inválida.');
  if(state.deliveryOrder!==undefined&&(!Array.isArray(state.deliveryOrder)||state.deliveryOrder.length>2000||state.deliveryOrder.some(id=>typeof id!=='string'||id.length>100)||new Set(state.deliveryOrder).size!==state.deliveryOrder.length))throw Error('Ordem de entregas inválida.');
  if (state.presales === undefined) return; // Backups anteriores continuam válidos.
  if (!Array.isArray(state.presales)) throw Error('Pré-vendas inválidas.');
  const ids = new Set(), occupied = new Set();
  for (const sale of state.sales || []) if (!sale.cancelled)
    for (const item of sale.items || []) for (const n of item.numbers || []) occupied.add(n);
  for (const box of Object.values(state.boxes || {}))
    for (const item of box.cart || []) for (const n of item.numbers || []) occupied.add(n);
  const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  for (const p of state.presales) {
    if (!p || !text(p.id, 100) || ids.has(p.id) || !text(p.customer, 100) || !text(p.seller, 100) ||
        !Array.isArray(p.numbers) || !p.numbers.length || p.numbers.length > 2000 ||
        !Number.isSafeInteger(p.amount) || p.amount < 0 || !methods.includes(p.method) ||
        typeof p.delivery !== 'boolean' || typeof p.cancelled !== 'boolean' ||
        typeof p.address !== 'string' || p.address.length > 500 ||
        (p.mapsUrl!==undefined&&(typeof p.mapsUrl!=='string'||(p.mapsUrl&&!maps.parse(p.mapsUrl)))) ||
        (p.delivery && !p.address.trim() && !maps.parse(p.mapsUrl || '')) || typeof p.phone !== 'string' || p.phone.length > 40 ||
        (p.deliveryStatus!==undefined&&!['pending','out','delivered'].includes(p.deliveryStatus)) ||
        (p.deliveredAt!==undefined&&(typeof p.deliveredAt!=='string'||!Number.isFinite(Date.parse(p.deliveredAt)))) ||
        !text(p.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
        !Number.isFinite(Date.parse(p.date + 'T12:00:00Z')))
      throw Error('Confira cliente, vendedor, tickets, pagamento e endereço da pré-venda.');
    ids.add(p.id);
    const own = new Set();
    for (const n of p.numbers) {
      if (!Number.isInteger(n) || n < 1 || n > state.limit || own.has(n)) throw Error('Numeração de tickets inválida na pré-venda.');
      own.add(n);
      if (!p.cancelled) {
        if (occupied.has(n)) throw Error('Ticket #' + n + ' já vendido ou reservado.');
        occupied.add(n);
      }
    }
  }
};
