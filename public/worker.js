/* ============================================================
   BMS Dashboard — Web Worker for heavy data processing
   ============================================================ */

self.onmessage = function(e) {
  var msg = e.data;
  if (msg.type === 'ping') {
    self.postMessage({ type: 'pong' });
    return;
  }
  if (msg.type === 'aggregate') {
    try {
      var records = msg.records;
      // Convert date strings back to Date objects
      for (var i = 0; i < records.length; i++) {
        if (records[i].dateStr) records[i].date = new Date(records[i].dateStr + 'T00:00:00');
        if (records[i].arrv_dateStr) records[i].arrv_date = new Date(records[i].arrv_dateStr + 'T00:00:00');
      }
      var result = aggregateFromRecords(records, msg.filters);
      self.postMessage({ type: 'result', data: result });
    } catch(err) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
};

function contCount(arr) {
  var s = new Set();
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].container) s.add(arr[i].container);
  }
  return s.size;
}

function shipCount(arr) {
  var sum = 0;
  for (var i = 0; i < arr.length; i++) { sum += arr[i].qty; }
  return sum;
}

function topNbyCount(records, key, n) {
  var m = new Map();
  for (var i = 0; i < records.length; i++) {
    var k = records[i][key];
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(records[i]);
  }
  var arr = [];
  m.forEach(function(val, lbl) {
    arr.push({ label: lbl, value: contCount(val) });
  });
  arr.sort(function(a, b) { return b.value - a.value; });
  return arr.slice(0, n);
}

function fmtDateJalali(d) {
  if (!d) return '';
  var gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
  var r = _d2j(_g2d(gy, gm, gd));
  return r.jy + '-' + String(r.jm).padStart(2, '0') + '-' + String(r.jd).padStart(2, '0');
}

function fmtDateMiladi(d) {
  if (!d) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---- Jalali helpers (Borkowski) ---- */
function _div(a, b) { return Math.trunc(a / b); }
function _mod(a, b) { return a - Math.trunc(a / b) * b; }
function _jalCal(jy) {
  var breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jump = 0;
  for (var i = 1; i < bl; i++) { var jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += _div(jump,33)*8 + _div(_mod(jump,33),4); jp = jm; }
  var n = jy - jp; leapJ += _div(n,33)*8 + _div(_mod(n,33)+3,4);
  if (_mod(jump,33) === 4 && jump - n === 4) leapJ += 1;
  var leapG = _div(gy,4) - _div((_div(gy,100)+1)*3,4) - 150;
  var march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + _div(jump+4,33)*33;
  var leap = _mod(_mod(n+1,33)-1,4); if (leap === -1) leap = 4;
  return {leap:leap, gy:gy, march:march};
}
function _g2d(gy,gm,gd) {
  var d = _div((gy+_div(gm-8,6)+100100)*1461,4) + _div(153*_mod(gm+9,12)+2,5) + gd - 34840408;
  d = d - _div(_div(gy+100100+_div(gm-8,6),100)*3,4) + 752;
  return d;
}
function _d2g(jdn) {
  var j = 4*jdn+139361631; j = j + _div(_div(4*jdn+183187720,146097)*3,4)*4-3908;
  var i = _div(_mod(j,1461),4)*5+308;
  var gd = _div(_mod(i,153),5)+1, gm = _mod(_div(i,153),12)+1;
  var gy = _div(j,1461)-100100+_div(8-gm,6);
  return {gy:gy,gm:gm,gd:gd};
}
function _j2d(jy,jm,jd) { var r=_jalCal(jy); return _g2d(r.gy,3,r.march)+(jm-1)*31-_div(jm,7)*(jm-7)+jd-1; }
function _d2j(jdn) {
  var gy=_d2g(jdn).gy, jy=gy-621, r=_jalCal(jy), jdn1f=_g2d(gy,3,r.march), jd, jm, k=jdn-jdn1f;
  if(k>=0){if(k<=185){jm=1+_div(k,31);jd=_mod(k,31)+1;return{jy:jy,jm:jm,jd:jd};}else k-=186;}
  else{jy-=1;k+=179;if(r.leap===1)k+=1;}
  jm=7+_div(k,30);jd=_mod(k,30)+1;return{jy:jy,jm:jm,jd:jd};
}
function g2j(gy,gm,gd){var r=_d2j(_g2d(gy,gm,gd));return[r.jy,r.jm,r.jd];}

function aggregateFromRecords(records, filters) {
  var isJal = filters.dateFormat === 'jalali';
  function fmtDate(d) { return isJal ? fmtDateJalali(d) : fmtDateMiladi(d); }

  var total_containers = contCount(records);
  var total_shipments = shipCount(records);
  var vesselSet = new Set(), lineSet = new Set(), fwdSet = new Set(), agentSet = new Set(), polSet = new Set();
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.vessel) vesselSet.add(r.vessel);
    if (r.line) lineSet.add(r.line);
    if (r.pol_forwarder) fwdSet.add(r.pol_forwarder);
    if (r.iran_agent) agentSet.add(r.iran_agent);
    if (r.pol) polSet.add(r.pol);
  }
  var sizeMap = new Map();
  for (var i = 0; i < records.length; i++) {
    if (records[i].size) { var k = records[i].size; sizeMap.set(k, (sizeMap.get(k)||0)+1); }
  }
  var pending = records.filter(function(r){return r.status==='Pending';});
  var arrived = records.filter(function(r){return r.status==='Arrived';});

  // Yearly
  var yearMap = new Map();
  for (var i = 0; i < records.length; i++) {
    if (records[i].date) { var y = records[i].date.getFullYear(); if (!yearMap.has(y)) yearMap.set(y,[]); yearMap.get(y).push(records[i]); }
  }
  var yearSorted = Array.from(yearMap.entries()).sort(function(a,b){return a[0]-b[0];});
  var yearly_cont = yearSorted.map(function(e){return{label:String(e[0]),value:contCount(e[1])};});
  var yearly_ship = yearSorted.map(function(e){return{label:String(e[0]),value:shipCount(e[1])};});

  // Monthly
  var monthMap = new Map();
  for (var i = 0; i < records.length; i++) {
    if (records[i].date) {
      var y = records[i].date.getFullYear(), m = String(records[i].date.getMonth()+1).padStart(2,'0');
      var key = y+'-'+m; if (!monthMap.has(key)) monthMap.set(key,[]); monthMap.get(key).push(records[i]);
    }
  }
  var monthSorted = Array.from(monthMap.entries()).sort(function(a,b){return a[0]<b[0]?-1:1;});
  var monthly_cont = monthSorted.map(function(e){
    var lbl = e[0];
    if (isJal) { var parts = e[0].split('-'); var j = g2j(parseInt(parts[0]),parseInt(parts[1]),1); lbl = j[0]+'/'+String(j[1]).padStart(2,'0'); }
    return {month:lbl, cont:contCount(e[1]), ship:shipCount(e[1])};
  });

  // Size dist
  var size_dist = Array.from(sizeMap.entries()).sort(function(a,b){return b[1]-a[1];}).map(function(e){return{label:e[0],value:e[1]};});

  // Daily
  var dayMap = new Map();
  for (var i = 0; i < records.length; i++) {
    if (records[i].date) {
      var key = records[i].date.getFullYear()+'-'+String(records[i].date.getMonth()+1).padStart(2,'0')+'-'+String(records[i].date.getDate()).padStart(2,'0');
      if (!dayMap.has(key)) dayMap.set(key,[]); dayMap.get(key).push(records[i]);
    }
  }
  var dayKeys = Array.from(dayMap.keys()).sort();
  var daily = [];
  if (dayKeys.length) {
    var minD = new Date(dayKeys[0]+'T00:00:00'), maxD = new Date(dayKeys[dayKeys.length-1]+'T00:00:00');
    for (var d = new Date(minD); d <= maxD; d.setDate(d.getDate()+1)) {
      var key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      var arr = dayMap.get(key) || [];
      daily.push({label:fmtDate(d), cont:arr.length?contCount(arr):0, ship:arr.length?shipCount(arr):0});
    }
  }

  // All records for container list
  var all_records = records.map(function(r) {
    return {
      container:r.container||null, vessel:r.vessel||null, size:r.size||null, qty:r.qty||0,
      pol_forwarder:r.pol_forwarder||null, pol:r.pol||null, line:r.line||null,
      iran_agent:r.iran_agent||null, date:r.date?fmtDate(r.date):'', status:r.status||''
    };
  });

  // POL coords
  var POL_COORDS = {SHANGHAI:[31.23,121.47],NINGBO:[29.87,121.54],NANSHA:[22.76,113.62],QINGDAO:[36.07,120.38],TIANJIN:[38.97,117.72],XINGANG:[38.98,117.75],SHEKOU:[22.48,113.91],SHENZHEN:[22.54,113.96],TAICANG:[31.45,121.12],DUBAI:[25.20,55.27],BANDAR_ABBAS:[27.18,56.27]};
  var polCountMap = new Map();
  for (var i = 0; i < records.length; i++) { if (records[i].pol && records[i].date) polCountMap.set(records[i].pol, (polCountMap.get(records[i].pol)||0)+1); }
  var pol_coords = Array.from(polCountMap.entries()).filter(function(e){return POL_COORDS[e[0].toUpperCase()];}).map(function(e){return{name:e[0],lat:POL_COORDS[e[0].toUpperCase()][0],lng:POL_COORDS[e[0].toUpperCase()][1],count:e[1]};});

  // Date range
  var dates = records.map(function(r){return r.date;}).filter(Boolean);
  var date_min = dates.length ? fmtDate(new Date(Math.min.apply(null,dates))) : null;
  var date_max = dates.length ? fmtDate(new Date(Math.max.apply(null,dates))) : null;

  // Line share (pie)
  var lineMap = new Map();
  for (var i = 0; i < records.length; i++) {
    if (records[i].iran_agent) {
      if (!lineMap.has(records[i].iran_agent)) lineMap.set(records[i].iran_agent,[]);
      lineMap.get(records[i].iran_agent).push(records[i]);
    }
  }
  var line_share = Array.from(lineMap.entries()).map(function(e){return{label:e[0],value:contCount(e[1])};}).sort(function(a,b){return b.value-a.value;});

  // TEU
  var total_teu = 0;
  for (var i = 0; i < records.length; i++) {
    var sz = records[i].size;
    total_teu += (sz==='40'||sz==="40'" ? 2 : sz==='20'||sz==="20'" ? 1 : 0);
  }

  return {
    total_containers: total_containers, total_shipments: total_shipments, total_teu: total_teu,
    unique_vessels: vesselSet.size, unique_lines: lineSet.size, unique_forwarders: fwdSet.size, unique_agents: agentSet.size,
    date_min: date_min, date_max: date_max, pending_count: contCount(pending), arrived_count: contCount(arrived),
    size_dist: size_dist, top_lines: topNbyCount(records,'line',10), top_forwarders: topNbyCount(records,'pol_forwarder',10),
    top_agents: topNbyCount(records,'iran_agent',10), top_pol: topNbyCount(records,'pol',10),
    yearly_cont: yearly_cont, yearly_ship: yearly_ship, monthly_cont: monthly_cont,
    daily: daily, rangeDays: daily.length, all_records: all_records,
    pol_coords: pol_coords, line_share: line_share
  };
}
