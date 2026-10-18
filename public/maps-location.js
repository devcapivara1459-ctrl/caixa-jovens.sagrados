(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MapsLocation = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function coordinates(text) {
    const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]), lng = Number(m[2]);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? lat + ',' + lng : null;
  }
  function parse(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2000) return null;
    const direct = coordinates(value);
    if (direct) return {url:'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(direct), target:direct};
    let url;
    try { url = new URL(value.trim()); } catch { return null; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const google = ['google.com','www.google.com','maps.google.com','google.com.br','www.google.com.br','maps.google.com.br'].includes(host);
    const short = host === 'maps.app.goo.gl' || host === 'share.google' || (host === 'goo.gl' && url.pathname.startsWith('/maps/'));
    if (!short && !(google && (host.startsWith('maps.') || url.pathname === '/' || url.pathname.startsWith('/maps')))) return null;
    url.protocol = 'https:';
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    let target = query && query.length <= 500 ? (coordinates(query) || query.trim()) : null;
    // !3d/!4d identificam o lugar; @ pode ser apenas o centro de visualização do mapa.
    const places = [...url.pathname.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
    if (!target && places.length) target = coordinates(places.at(-1)[1] + ',' + places.at(-1)[2]);
    return {url:url.href, target};
  }
  function directions(origin, stops) {
    if (!Array.isArray(stops) || !stops.length || stops.length > 4 || stops.some(s => typeof s !== 'string' || !s.trim())) throw Error('Escolha de uma a quatro paradas por trecho.');
    const query = new URLSearchParams({api:'1', origin, destination:stops.at(-1), travelmode:'driving'});
    if (stops.length > 1) query.set('waypoints', stops.slice(0,-1).join('|'));
    return 'https://www.google.com/maps/dir/?' + query;
  }
  function distance(a,b) {
    const [lat1,lng1]=a.split(',').map(Number),[lat2,lng2]=b.split(',').map(Number), rad=Math.PI/180;
    const x=Math.sin((lat2-lat1)*rad/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lng2-lng1)*rad/2)**2;
    return 6371*2*Math.asin(Math.sqrt(Math.min(1,x)));
  }
  // Sequência aproximada por distância geográfica, sem trânsito ou malha viária.
  function suggest(origin, stops) {
    if (!coordinates(origin)) throw Error('Informe a localização exata do ponto de partida.');
    const remaining=stops.map(s=>({...s,point:coordinates(s.point)}));
    if(remaining.some(s=>!s.point))throw Error('Há uma localização sem coordenadas.');
    const ordered=[];let point=origin;
    while(remaining.length){let best=0;for(let i=1;i<remaining.length;i++)if(distance(point,remaining[i].point)<distance(point,remaining[best].point))best=i;const next=remaining.splice(best,1)[0];ordered.push(next);point=next.point;}
    // Melhora cruzamentos sem exigir um serviço externo de otimização.
    if(ordered.length<=150)for(let pass=0;pass<8;pass++){
      let improved=false;
      for(let i=0;i<ordered.length-1;i++)for(let j=i+1;j<ordered.length;j++){
        const before=i?ordered[i-1].point:origin, after=ordered[j+1]?.point;
        const old=distance(before,ordered[i].point)+(after?distance(ordered[j].point,after):0);
        const next=distance(before,ordered[j].point)+(after?distance(ordered[i].point,after):0);
        if(next+0.001<old){ordered.splice(i,j-i+1,...ordered.slice(i,j+1).reverse());improved=true;}
      }
      if(!improved)break;
    }
    return ordered.map(s=>s.id);
  }
  return {parse, coordinates, directions, distance, suggest};
});
