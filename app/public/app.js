/* JUNTAUCR · Operaciones SINPE — interfaz web
   Todas las reglas de negocio viven en MySQL. Esta interfaz solo muestra
   datos, ofrece vistas previas y presenta los mensajes de los procedimientos. */

/* ---------- íconos y marca (mismos del prototipo) ---------- */
const P = {
  home:'M3 11l9-8 9 8M5 10v10h14V10',
  users:'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  card:'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM2 10h20M6 15h4',
  phone:'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  link:'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  swap:'M4 7h15l-4-4M20 17H5l4 4',
  list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  db:'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5',
  plus:'M12 5v14M5 12h14',
  check:'M5 12l5 5L20 7',
  x:'M6 6l12 12M18 6L6 18',
  right:'M5 12h14M13 6l6 6-6 6',
  alert:'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16v-4M12 8h.01',
  dl:'M12 3v12M7 10l5 5 5-5M4 21h16',
  lock:'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  out:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
};
const ic = (n, s = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${s}><path d="${P[n]}"/></svg>`;
const MARK = (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="7" fill="#0E6A52"/><circle cx="8.5" cy="14" r="3.2" fill="#fff"/><circle cx="19.5" cy="14" r="3.2" fill="#fff"/><path d="M11.7 14h4.6" stroke="#fff" stroke-width="2.2"/></svg>`;

/* ---------- formato ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SIM = {CRC:'₡', USD:'$'};
const fm = (n, m = 'CRC') => (SIM[m] || '') + Number(n || 0).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2});
const gi = x => String(x || '').replace(/(.{4})/g, '$1 ').trim();
const sh = x => x ? x.slice(0,4) + ' … ' + x.slice(-4) : '';
const tel = n => n ? `${n.slice(0,4)}-${n.slice(4)}` : '';
const num = x => `<span class="num">${esc(x)}</span>`;
const fd = s => s ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : '';
const fdh = s => s ? `${fd(s)} ${s.slice(11,16)}` : '';
const hora = s => s ? s.slice(11,16) : '';
const hoyISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const inicioMes = () => hoyISO().slice(0, 8) + '01';
const st = s => `<span class="st ${{ACTIVO:'ok', ACTIVA:'ok', INACTIVO:'no', INACTIVA:'no', BLOQUEADA:'bad'}[s] || 'no'}">${s ? s[0] + s.slice(1).toLowerCase() : ''}</span>`;
const af = a => a ? '<span class="st ok">Afiliado</span>' : '<span class="st no hollow">Sin afiliar</span>';
const cur = m => `<span class="cur${m === 'USD' ? ' usd' : ''}">${m}</span>`;
const first = n => String(n || '').split(' ').slice(0, 2).join(' ');
const ini = n => String(n || '').split(' ').slice(0, 2).map(w => w[0]).join('');
const hue = n => [...String(n)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const av = (n, l) => `<span class="av${l ? ' l' : ''}" style="background:hsl(${hue(n)} 70% 92%);color:hsl(${hue(n)} 45% 30%)">${esc(ini(n))}</span>`;
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/* ---------- API ---------- */
async function api(metodo, url, cuerpo) {
  const r = await fetch(url, {method: metodo, headers: cuerpo ? {'Content-Type':'application/json'} : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined});
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) { estado.usuario = null; ir('/login'); throw new Error(datos.error || 'Sesión vencida'); }
  if (!r.ok) { const e = new Error(datos.error || 'Error inesperado'); e.codigo = datos.codigo; throw e; }
  return datos;
}
const GET = u => api('GET', u), POST = (u, b) => api('POST', u, b || {}), PUT = (u, b) => api('PUT', u, b || {});

/* ---------- estado, navegación, avisos ---------- */
const estado = {usuario: null, transferencia: null, resultado: null};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ir = ruta => { if (location.hash === '#' + ruta) render(); else location.hash = ruta; };

function aviso(texto, malo) {
  const t = document.createElement('div');
  t.className = 'toast' + (malo ? ' bad' : '');
  t.innerHTML = ic(malo ? 'alert' : 'check') + `<div>${esc(texto)}</div>`;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), malo ? 6000 : 3500);
}

/* ---------- capas (modal / panel) ---------- */
function abrirCapa(tipo, titulo, cuerpo, pie, alMontar) {
  $('#layer').innerHTML = `<div class="scrim" data-cerrar></div><div class="${tipo}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="mh"><h2>${esc(titulo)}</h2><button class="x" data-cerrar aria-label="Cerrar">${ic('x')}</button></div>
    <div class="mb">${cuerpo}</div><div class="mf">${pie}</div></div>`;
  $$('[data-cerrar]', $('#layer')).forEach(b => b.onclick = cerrarCapa);
  const capa = $('#layer .' + tipo);
  alMontar && alMontar(capa);
  setTimeout(() => $('input,select', capa)?.focus(), 50);
}
const cerrarCapa = () => { $('#layer').innerHTML = ''; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarCapa(); });

// botón que ejecuta una acción y muestra el error del procedimiento en la capa
async function accion(btn, fn, cajaError) {
  btn.disabled = true;
  if (cajaError) cajaError.innerHTML = '';
  try { await fn(); }
  catch (e) {
    if (cajaError) cajaError.innerHTML = nota('bad', esc(e.message));
    else aviso(e.message, true);
  }
  finally { btn.disabled = false; }
}
const nota = (k, html, i) => `<div class="note ${k}">${ic(i || (k === 'bad' ? 'alert' : k === 'ok' ? 'check' : 'info'))}<div>${html}</div></div>`;
const ck = (t, bad, pend) => `<div class="ck${bad ? ' x' : ''}"${pend ? ' style="opacity:.5"' : ''}>${ic(bad ? 'x' : 'check')}<div>${t}</div></div>`;

/* ---------- piezas de interfaz ---------- */
const NAV = [
  ['Operación', [['inicio','Inicio','home'], ['transferir','Transferir','swap'], ['movimientos','Movimientos','list']]],
  ['Registro', [['clientes','Clientes','users'], ['cuentas','Cuentas IBAN','card'], ['telefonos','Teléfonos','phone'], ['sinpe','SINPE Móvil','link']]],
  ['Sistema', [['catalogos','Catálogos','db']]]
];
const shell = (activo, migas, cuerpo) => `<div class="frame">
  <aside class="side">
    <div class="ws">${MARK()}<div><div class="t">JUNTAUCR</div><div class="s">Operaciones SINPE</div></div></div>
    ${NAV.map(([g, items]) => `<div class="grp">${g}</div>${items.map(([id, t, i]) => `<a class="nav${id === activo ? ' on' : ''}" href="#/${id}">${ic(i)}${t}</a>`).join('')}`).join('')}
    <div class="me"><span class="av" style="background:#fff;color:var(--accent)">${esc(ini(estado.usuario?.nombre || 'AO'))}</span><div style="min-width:0;flex:1"><div class="t">${esc(estado.usuario?.nombre)}</div><div class="s">${esc(estado.usuario?.correo)}</div></div>
      <button class="btn s q" id="salir" title="Salir" aria-label="Salir">${ic('out')}</button></div>
  </aside>
  <header class="top">
    <div class="crumbs">${migas}</div>
    <form class="search" id="buscar" role="search">${ic('search')}<input aria-label="Buscar" placeholder="Buscar cliente, IBAN o teléfono" style="border:0;background:transparent;font:inherit;flex:1;outline:none;color:var(--ink)"><span class="kbd">Enter</span></form>
    <div class="envt"><i></i>Simulación · datos ficticios</div>
  </header>
  <main class="sheet"><div class="content" id="contenido">${cuerpo}</div></main></div>`;
const cr = (...p) => p.map((x, i) => i === p.length - 1 ? `<b>${esc(x[0])}</b>` : `<a href="#${x[1]}">${esc(x[0])}</a><span class="sep">/</span>`).join('');
const title = (h, p, act = '') => `<div class="title"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>${act ? `<div class="act">${act}</div>` : ''}</div>`;
const fld = (label, control, o = {}) => `<div class="field${o.s2 ? ' s2' : ''}"><label${o.for ? ` for="${o.for}"` : ''}>${label}</label>${control}${o.hint !== undefined ? `<div class="hint${o.hk ? ' ' + o.hk : ''}"${o.hid ? ` id="${o.hid}"` : ''}>${o.hint}</div>` : ''}</div>`;
const pair = (a, b, amt, cls = '') => `<div class="pair ${cls}"><div class="pe"><div class="pn num">${a[0]}</div><div class="ps">${a[1]}</div></div><div class="pl"><i></i><span class="pa num">${amt}</span></div><div class="pe r"><div class="pn num">${b[0]}</div><div class="ps">${b[1]}</div></div></div>`;
const trPair = (t, cls) => t.tipo === 'SINPE'
  ? pair([tel(t.telefono_origen), esc(first(t.titular_origen))], [tel(t.telefono_destino), esc(first(t.titular_destino))], fm(t.monto, t.moneda), cls)
  : pair([sh(t.iban_origen), esc(first(t.titular_origen))], [sh(t.iban_destino), esc(first(t.titular_destino))], fm(t.monto, t.moneda), cls);
const vacio = t => `<div class="empty">${t}</div>`;
const opts = (lista, val, txt, sel) => lista.map(x => `<option value="${esc(val(x))}"${val(x) === sel ? ' selected' : ''}>${esc(txt(x))}</option>`).join('');

/* =====================================================================
   PANTALLAS
   ===================================================================== */
const R = {};

/* ---------- ingreso ---------- */
R.login = () => {
  $('#app').innerHTML = `<div class="frame"><div class="login"><div>
    <form class="login-card" id="f">
      <div style="display:flex;align-items:center;gap:10px">${MARK(32)}<div><div class="b" style="font-size:16px">JUNTAUCR</div><div class="xs ink2">Operaciones SINPE</div></div></div>
      <div><h1>Ingresar</h1><p class="ink2" style="margin-top:4px">Usa tu usuario de operaciones.</p></div>
      ${fld('Correo', '<input class="in" id="correo" type="email" autocomplete="username" required value="admin@juntaucr.cr">', {for:'correo'})}
      ${fld('Contraseña', '<input class="in" id="clave" type="password" autocomplete="current-password" required>', {for:'clave', hint:'Usuario de prueba: admin@juntaucr.cr · juntaucr2026'})}
      <div id="err"></div>
      <button class="btn pri l w" type="submit">Ingresar</button>
    </form>
    <p class="xs ink2" style="text-align:center;margin-top:16px">Entorno de simulación con datos ficticios. No se conecta con el Banco Central de Costa Rica.</p>
  </div></div></div>`;
  $('#f').onsubmit = e => { e.preventDefault(); accion($('#f button'), async () => {
    estado.usuario = await POST('/api/login', {correo: $('#correo').value, clave: $('#clave').value});
    ir('/inicio');
  }, $('#err')); };
  $('#clave').focus();
};

/* ---------- inicio ---------- */
R.inicio = async () => {
  const d = await GET('/api/resumen');
  const ce = Object.fromEntries(d.cuentas.map(c => [c.estado, c.n]));
  const nCuentas = d.cuentas.reduce((s, c) => s + c.n, 0);
  const crc = d.saldos.find(s => s.moneda === 'CRC'), usd = d.saldos.find(s => s.moneda === 'USD');
  const sinAfiliar = d.telefonos.total - d.telefonos.afiliados;
  const hoy = new Date().toLocaleDateString('es-CR', {weekday:'long', day:'numeric', month:'long'});
  const grupos = {};
  d.recientes.forEach(t => (grupos[t.fecha.slice(0, 10)] ||= []).push(t));
  const etiqueta = f => f === hoyISO() ? 'Hoy' : new Date(f + 'T12:00').toLocaleDateString('es-CR', {weekday:'long', day:'numeric', month:'short'});
  const motivo = p => p.estado_cliente === 'INACTIVO' ? 'El cliente está inactivo'
    : p.cuentas_validas === 0 ? 'No tiene cuentas activas en colones' : `Tiene ${plural(p.cuentas_validas, 'cuenta', 'cuentas')} en colones disponible${p.cuentas_validas === 1 ? '' : 's'}`;
  return shell('inicio', cr(['Inicio']), title(`Hoy, ${hoy}`,
    `Se ${d.hoy.n === 1 ? 'movió' : 'movieron'} ${fm(d.hoy.total)} en ${plural(d.hoy.n, 'transferencia', 'transferencias')} en colones. Hay ${plural(sinAfiliar, 'teléfono registrado', 'teléfonos registrados')} sin afiliar.`,
    `<a class="btn" href="#/sinpe">Afiliar teléfono</a><a class="btn pri" href="#/transferir">${ic('swap')}Nueva transferencia</a>`) + `
  <div class="figs">
    <div class="fig"><div class="k">Clientes</div><div class="v num">${d.clientes.total}</div><div class="n">${d.clientes.activos} activos</div></div>
    <div class="fig"><div class="k">Cuentas IBAN</div><div class="v num">${nCuentas}</div><div class="n">${plural(ce.ACTIVA || 0, 'activa', 'activas')}, ${plural(ce.INACTIVA || 0, 'inactiva', 'inactivas')}, ${plural(ce.BLOQUEADA || 0, 'bloqueada', 'bloqueadas')}</div></div>
    <div class="fig"><div class="k">Teléfonos</div><div class="v num">${d.telefonos.total}</div><div class="n">${d.telefonos.afiliados} afiliados a SINPE Móvil</div></div>
    <div class="fig"><div class="k">Saldo en colones</div><div class="v num">${fm(crc?.total)}</div><div class="n">${usd ? `más ${fm(usd.total, 'USD')} en ${plural(usd.n, 'cuenta USD', 'cuentas USD')}` : 'sin cuentas en dólares'}</div></div>
  </div>
  <div class="cols c21">
    <div class="block"><div class="bh"><h2>Transferencias recientes</h2><div class="act"><a class="btn q" href="#/movimientos">Ver movimientos</a></div></div>
      ${d.recientes.length ? Object.entries(grupos).map(([f, ts]) => `<div style="padding:4px 20px 0;text-transform:capitalize" class="sm ink2 b">${etiqueta(f)}</div>
        <table><tbody>${ts.map(t => `<tr><td style="width:64px" class="ink2">${num(hora(t.fecha))}</td><td style="width:100%">${trPair(t, 'fix')}</td><td class="sm ink2" style="width:90px">${t.tipo === 'SINPE' ? 'SINPE Móvil' : 'IBAN'}</td></tr>`).join('')}</tbody></table>`).join('')
      : vacio('Todavía no hay transferencias.')}
    </div>
    <div class="block"><div class="bh"><h2>Por atender</h2></div><div class="bb">
      ${d.pendientes.length ? d.pendientes.map(p => { const ok = p.estado_cliente === 'ACTIVO' && p.cuentas_validas > 0; return `<div class="ph-row" style="align-items:flex-start;padding:12px 0">${av(p.titular)}<div class="g"><div class="b num">${tel(p.numero)}</div><div class="sm ink2">${esc(p.titular)}</div><div class="xs ${ok ? 'pos' : ''}" style="margin-top:2px;${ok ? '' : 'color:var(--neg)'}">${motivo(p)}</div></div>${ok ? `<a class="btn s pri" href="#/sinpe?numero=${p.numero}">Afiliar</a>` : ''}</div>`; }).join('')
        + (d.pendientes.some(p => !(p.estado_cliente === 'ACTIVO' && p.cuentas_validas > 0)) ? `<div style="margin-top:8px">${nota('', 'Para afiliar esos números primero hay que activar al cliente o tener una cuenta activa en colones.')}</div>` : '')
      : vacio('Todos los teléfonos están afiliados.')}
    </div></div>
  </div>`);
};

/* ---------- clientes ---------- */
function panelCliente(c) {
  const nuevo = !c;
  abrirCapa('drawer', nuevo ? 'Nuevo cliente' : 'Editar cliente', `<form class="stack" style="gap:18px" id="fc">
    ${fld('Identificación', `<input class="in num" id="c-id" ${nuevo ? 'required placeholder="1-1456-0789"' : `disabled value="${esc(c.identificacion)}"`}>`, {for:'c-id', hint: nuevo ? 'No puede repetirse entre clientes.' : 'La identificación no se modifica.'})}
    ${fld('Nombre completo', `<input class="in" id="c-n" required value="${esc(c?.nombre_completo)}">`, {for:'c-n'})}
    ${fld('Correo electrónico', `<input class="in" id="c-e" type="email" required value="${esc(c?.correo)}">`, {for:'c-e'})}
    ${nuevo ? '' : fld('Estado', `<select class="in" id="c-s"><option${c.estado === 'ACTIVO' ? ' selected' : ''}>ACTIVO</option><option${c.estado === 'INACTIVO' ? ' selected' : ''}>INACTIVO</option></select>`, {for:'c-s'})}
    ${nuevo ? nota('', 'La fecha de registro se asigna al guardar. Cuentas y teléfonos se agregan desde la ficha del cliente.') : ''}
    <div id="err"></div><button type="submit" hidden></button></form>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ok">${nuevo ? 'Guardar cliente' : 'Guardar cambios'}</button>`,
    capa => {
      const enviar = () => accion($('#ok'), async () => {
        if (nuevo) {
          const r = await POST('/api/clientes', {identificacion: $('#c-id').value, nombre: $('#c-n').value, correo: $('#c-e').value});
          cerrarCapa(); aviso('Cliente registrado.'); ir('/clientes/' + r.id_cliente);
        } else {
          await PUT('/api/clientes/' + c.id_cliente, {nombre: $('#c-n').value, correo: $('#c-e').value, estado: $('#c-s').value});
          cerrarCapa(); aviso('Cliente actualizado.'); render();
        }
      }, $('#err'));
      $('#ok').onclick = enviar;
      $('#fc').onsubmit = e => { e.preventDefault(); enviar(); };
    });
}

R.clientes = async (p, qs) => {
  const lista = await GET('/api/clientes');
  const html = shell('clientes', cr(['Clientes']), title('Clientes', `${plural(lista.length, 'cliente registrado', 'clientes registrados')}, ${lista.filter(c => c.estado === 'ACTIVO').length} activos.`, `<button class="btn pri" id="nuevo">${ic('plus')}Nuevo cliente</button>`) + `
    <div class="toolbar"><div class="searchbox">${ic('search')}<input class="in" id="q" placeholder="Identificación, nombre o correo" value="${esc(qs.get('q'))}"></div>
      <div class="seg" id="seg"><span class="on" data-v="">Todos</span><span data-v="ACTIVO">Activos</span><span data-v="INACTIVO">Inactivos</span></div></div>
    <div class="block"><table>
      <thead><tr><th>Cliente</th><th>Identificación</th><th>Registro</th><th class="r">Cuentas</th><th class="r">Teléfonos</th><th class="r">Afiliados</th><th>Estado</th></tr></thead>
      <tbody id="filas"></tbody></table></div>`);
  return [html, () => {
    let filtro = '';
    const pintar = () => {
      const q = $('#q').value.trim().toLowerCase();
      const fil = lista.filter(c => (!filtro || c.estado === filtro) && (!q || [c.identificacion, c.nombre_completo, c.correo].some(x => x.toLowerCase().includes(q))));
      $('#filas').innerHTML = fil.length ? fil.map(c => `<tr class="go" data-href="/clientes/${c.id_cliente}"><td><div class="who">${av(c.nombre_completo)}<div><div class="b">${esc(c.nombre_completo)}</div><div class="xs ink2">${esc(c.correo)}</div></div></div></td>
        <td>${num(c.identificacion)}</td><td>${num(fd(c.fecha_registro))}</td><td class="r">${num(c.cuentas)}</td><td class="r">${num(c.telefonos)}</td><td class="r">${num(c.afiliados)}</td><td>${st(c.estado)}</td></tr>`).join('')
        : `<tr><td colspan="7">${vacio('No hay clientes que coincidan.')}</td></tr>`;
    };
    $('#q').oninput = pintar;
    $$('#seg span').forEach(s => s.onclick = () => { $$('#seg span').forEach(x => x.classList.remove('on')); s.classList.add('on'); filtro = s.dataset.v; pintar(); });
    $('#nuevo').onclick = () => panelCliente();
    pintar();
  }];
};

R.cliente = async ([id]) => {
  const {cliente: c, cuentas, telefonos} = await GET('/api/clientes/' + id);
  const compartidas = Object.entries(telefonos.filter(t => t.iban_afiliado).reduce((m, t) => ((m[t.iban_afiliado] ||= []).push(t.numero), m), {})).filter(([, n]) => n.length > 1);
  const html = shell('clientes', cr(['Clientes', '/clientes'], [c.nombre_completo]), `
    <div class="title"><div class="who" style="gap:16px">${av(c.nombre_completo, 1)}<div><h1>${esc(c.nombre_completo)}</h1><p>${num(c.identificacion)} · ${esc(c.correo)} · cliente desde ${num(fd(c.fecha_registro))}</p></div></div>
      <div class="act" style="align-items:center">${st(c.estado)}<button class="btn" id="editar">Editar</button>${c.estado === 'ACTIVO' ? `<a class="btn pri" href="#/cuentas/nueva?cliente=${encodeURIComponent(c.identificacion)}">${ic('plus')}Nueva cuenta</a>` : ''}</div></div>
    <div class="cols c32">
      <div class="block"><div class="bh"><h2>Cuentas IBAN</h2><span class="sm ink2">${cuentas.length}</span></div>${cuentas.length ? `<table>
        <thead><tr><th>IBAN</th><th>Moneda</th><th class="r">Saldo</th><th class="r">Tel. afiliados</th><th>Estado</th></tr></thead>
        <tbody>${cuentas.map(a => `<tr class="go" data-href="/cuentas/${a.iban}"><td><div class="b num">${gi(a.iban)}</div><div class="xs ink2">${esc(a.entidad)}</div></td><td>${cur(a.moneda)}</td><td class="r b num">${fm(a.saldo, a.moneda)}</td><td class="r">${num(a.telefonos_afiliados)}</td><td>${st(a.estado)}</td></tr>`).join('')}</tbody></table>` : vacio('Este cliente no tiene cuentas.')}</div>
      <div class="block"><div class="bh"><h2>Teléfonos</h2><span class="sm ink2">${telefonos.length}</span><div class="act">${c.estado === 'ACTIVO' ? `<button class="btn s" id="regtel">${ic('plus')}Registrar</button>` : ''}</div></div><div class="bb">
        ${telefonos.length ? telefonos.map(t => `<div class="ph-row"><div class="g"><div class="b num">${tel(t.numero)}</div>${t.afiliado === 'SI' ? `<div class="sm ink2 link">${af(1)}<i></i>${num(sh(t.iban_afiliado))}</div>` : `<div class="sm">${af(0)}</div>`}</div>
          ${t.afiliado === 'SI' ? '' : `<a class="btn s pri" href="#/sinpe?numero=${t.numero}">Afiliar</a>`}<a class="btn s" href="#/sinpe/historial/${t.numero}">Historial</a></div>`).join('') : vacio('Sin teléfonos registrados.')}
        ${compartidas.map(([i, ns]) => `<div style="margin-top:12px">${nota('', `${ns.map(tel).join(' y ')} están en la misma cuenta (${sh(i)}), así que no pueden transferirse entre sí.`)}</div>`).join('')}
      </div></div>
    </div>`);
  return [html, () => {
    $('#editar').onclick = () => panelCliente(c);
    $('#regtel') && ($('#regtel').onclick = () => panelTelefono(c.identificacion));
  }];
};

/* ---------- cuentas ---------- */
R.cuentas = async (p, qs) => {
  const lista = await GET('/api/cuentas');
  const tot = m => lista.filter(a => a.moneda === m).reduce((s, a) => s + a.saldo, 0);
  const html = shell('cuentas', cr(['Cuentas IBAN']), title('Cuentas IBAN', `${plural(lista.length, 'cuenta', 'cuentas')}. ${fm(tot('CRC'))} en colones y ${fm(tot('USD'), 'USD')} en dólares.`, `<a class="btn pri" href="#/cuentas/nueva">${ic('plus')}Nueva cuenta</a>`) + `
    <div class="toolbar"><div class="searchbox">${ic('search')}<input class="in" id="q" placeholder="IBAN o titular" value="${esc(qs.get('q'))}"></div>
      <div class="seg" id="seg"><span class="on" data-v="">Todas</span><span data-v="CRC">CRC</span><span data-v="USD">USD</span></div>
      <select class="in" id="est" style="min-height:34px;width:180px" aria-label="Estado"><option value="">Estado: todos</option><option>ACTIVA</option><option>INACTIVA</option><option>BLOQUEADA</option></select></div>
    <div class="block"><table>
      <thead><tr><th>IBAN</th><th>Titular</th><th>Entidad</th><th>Moneda</th><th class="r">Saldo</th><th>Apertura</th><th class="r">Tel. afiliados</th><th>Estado</th></tr></thead>
      <tbody id="filas"></tbody></table></div>`);
  return [html, () => {
    let mon = '';
    const pintar = () => {
      const q = $('#q').value.replace(/\s/g, '').toLowerCase(), e = $('#est').value;
      const fil = lista.filter(a => (!mon || a.moneda === mon) && (!e || a.estado === e) && (!q || a.iban.toLowerCase().includes(q) || a.titular.toLowerCase().replace(/\s/g, '').includes(q)));
      $('#filas').innerHTML = fil.length ? fil.map(a => `<tr class="go" data-href="/cuentas/${a.iban}"><td class="b num">${gi(a.iban)}</td><td><div class="who">${av(a.titular)}${esc(a.titular)}</div></td><td>${esc(a.entidad)}</td><td>${cur(a.moneda)}</td>
        <td class="r b num">${fm(a.saldo, a.moneda)}</td><td>${num(fd(a.fecha_apertura))}</td><td class="r">${num(a.telefonos_afiliados)}</td><td>${st(a.estado)}</td></tr>`).join('')
        : `<tr><td colspan="8">${vacio('No hay cuentas que coincidan.')}</td></tr>`;
    };
    $('#q').oninput = pintar; $('#est').onchange = pintar;
    $$('#seg span').forEach(s => s.onclick = () => { $$('#seg span').forEach(x => x.classList.remove('on')); s.classList.add('on'); mon = s.dataset.v; pintar(); });
    pintar();
  }];
};

R.cuentaNueva = async (p, qs) => {
  const [clientes, cat] = await Promise.all([GET('/api/clientes'), GET('/api/catalogos')]);
  const activos = clientes.filter(c => c.estado === 'ACTIVO');
  const html = shell('cuentas', cr(['Cuentas IBAN', '/cuentas'], ['Nueva cuenta']), title('Nueva cuenta IBAN', 'La cuenta queda a nombre de un cliente existente.') + `
    <div class="cols c21">
      <div class="block"><div class="bb" style="padding-top:20px"><form class="form" id="f">
        ${fld('Titular', `<select class="in" id="tit" required><option value="">Elija un cliente activo</option>${opts(activos, c => c.identificacion, c => `${c.nombre_completo} · ${c.identificacion}`, qs.get('cliente'))}</select>`, {s2:1, for:'tit'})}
        ${fld('Entidad financiera', `<select class="in" id="ent">${opts(cat.entidades, e => e.codigo, e => `${e.nombre} (${e.codigo})`, '0152')}</select>`, {for:'ent'})}
        ${fld('Moneda', `<select class="in" id="mon">${opts(cat.monedas, m => m.codigo, m => `${m.codigo} · ${m.descripcion}`, 'CRC')}</select>`, {for:'mon'})}
        ${fld('IBAN', '<input class="in num b" id="iban" required maxlength="27" placeholder="CR00 0152 0000 0000 0000 00" autocomplete="off">', {s2:1, for:'iban', hint:'22 caracteres: CR seguido de 20 dígitos.', hid:'ibanh'})}
        ${fld('Saldo inicial', '<div class="money"><span class="pre" id="sim">₡</span><input class="in num" id="saldo" type="number" min="0" step="0.01" value="0" required></div>', {for:'saldo'})}
        ${fld('Fecha de apertura', `<input class="in num" id="fecha" type="date" max="${hoyISO()}" value="${hoyISO()}">`, {for:'fecha'})}
        ${fld('Estado', '<select class="in" id="est"><option>ACTIVA</option><option>INACTIVA</option><option>BLOQUEADA</option></select>', {for:'est'})}
        <div></div>
        <div class="s2" id="err"></div>
        <div class="s2" style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px"><a class="btn" href="#/cuentas">Cancelar</a><button class="btn pri" type="submit">Registrar cuenta</button></div>
      </form></div></div>
      <div class="stack" style="gap:16px">
        <div class="block"><div class="bh"><h2>Antes de registrar</h2></div><div class="bb checks" style="padding-top:0" id="checks"></div></div>
        ${nota('warn', 'Solo las cuentas activas en colones pueden recibir afiliaciones de SINPE Móvil.')}
      </div>
    </div>`);
  return [html, () => {
    const revisar = () => {
      const iban = $('#iban').value.replace(/\s/g, '').toUpperCase();
      const ok = /^CR\d{20}$/.test(iban);
      $('#ibanh').className = 'hint ' + (iban ? (ok ? 'ok' : 'bad') : '');
      $('#ibanh').textContent = iban ? `${iban.length} de 22 caracteres${ok ? ' · formato válido' : iban.length === 22 ? ' · debe ser CR + 20 dígitos' : ''}` : '22 caracteres: CR seguido de 20 dígitos.';
      $('#sim').textContent = SIM[$('#mon').value] || '';
      const s = $('#saldo').value;
      $('#checks').innerHTML = ck('Hay un titular activo elegido', false, !$('#tit').value) + ck('La entidad está en el catálogo') + ck('La moneda es CRC o USD')
        + ck('El IBAN tiene 22 caracteres con formato CR + 20 dígitos', iban && !ok, !ok) + ck('El saldo inicial no es negativo', s !== '' && +s < 0, s === '' || +s < 0)
        + `<div class="xs ink2" style="padding-top:6px">Que el IBAN no esté repetido lo verifica la base de datos al registrar.</div>`;
    };
    $('#iban').oninput = e => { const v = e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 22); e.target.value = gi(v); revisar(); };
    ['tit', 'mon', 'saldo'].forEach(i => $('#' + i).addEventListener('input', revisar));
    revisar();
    $('#f').onsubmit = e => { e.preventDefault(); accion($('#f [type=submit]'), async () => {
      const iban = $('#iban').value.replace(/\s/g, '');
      await POST('/api/cuentas', {iban, identificacion: $('#tit').value, entidad: $('#ent').value, moneda: $('#mon').value, saldo: $('#saldo').value, fecha: $('#fecha').value, estado: $('#est').value});
      aviso('Cuenta registrada.'); ir('/cuentas/' + iban.toUpperCase());
    }, $('#err')); };
  }];
};

function modalEstadoCuenta(c) {
  abrirCapa('modal', 'Cambiar estado de la cuenta', `<div class="stack" style="gap:16px">
      <p class="ink2">${gi(c.iban)} · ${esc(c.titular)}. Estado actual: ${st(c.estado)}</p>
      ${fld('Nuevo estado', `<select class="in" id="ne">${['ACTIVA', 'INACTIVA', 'BLOQUEADA'].filter(s => s !== c.estado).map(s => `<option>${s}</option>`).join('')}</select>`, {for:'ne'})}
      ${c.telefonos_afiliados ? `<label class="ck" style="cursor:pointer"><input type="checkbox" id="des" style="margin-top:3px"><div>Desafiliar los ${plural(c.telefonos_afiliados, 'teléfono afiliado', 'teléfonos afiliados')} si la cuenta deja de estar activa. Queda en el historial.</div></label>` : ''}
      <div id="err"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ok">Cambiar estado</button>`,
    () => $('#ok').onclick = () => accion($('#ok'), async () => {
      await PUT(`/api/cuentas/${c.iban}/estado`, {estado: $('#ne').value, desafiliar: $('#des')?.checked});
      cerrarCapa(); aviso('Estado actualizado.'); render();
    }, $('#err')));
}

R.cuenta = async ([iban]) => {
  const {cuenta: c, telefonos, movimientos, mes} = await GET('/api/cuentas/' + iban);
  const vig = telefonos.filter(t => t.situacion === 'VIGENTE'), ant = telefonos.filter(t => t.situacion !== 'VIGENTE');
  const html = shell('cuentas', cr(['Cuentas IBAN', '/cuentas'], [sh(c.iban)]), `
    <div class="title"><div><h1 class="num">${gi(c.iban)}</h1><p><span class="who" style="display:inline-flex;gap:8px;vertical-align:middle">${av(c.titular)}<a href="#/clientes/${c.id_cliente}">${esc(c.titular)}</a></span> · ${esc(c.entidad)} · ${cur(c.moneda)} · abierta ${num(fd(c.fecha_apertura))}</p></div>
      <div class="act" style="align-items:center">${st(c.estado)}<button class="btn" id="estado">Cambiar estado</button>${c.estado === 'ACTIVA' ? `<a class="btn pri" href="#/transferir/iban?origen=${c.iban}">${ic('swap')}Transferir</a>` : ''}</div></div>
    <div class="figs"><div class="fig"><div class="k">Saldo disponible</div><div class="big num">${fm(c.saldo, c.moneda)}</div></div>
      <div class="fig"><div class="k">Recibido este mes</div><div class="v num pos">+${fm(mes.total_recibido, c.moneda)}</div><div class="n">${plural(mes.cantidad_recibidas, 'transferencia', 'transferencias')}</div></div>
      <div class="fig"><div class="k">Enviado este mes</div><div class="v num">−${fm(mes.total_enviado, c.moneda)}</div><div class="n">${plural(mes.cantidad_enviadas, 'transferencia', 'transferencias')}</div></div></div>
    <div class="cols c12">
      <div class="block"><div class="bh"><h2>Teléfonos afiliados</h2><span class="sm ink2">${vig.length}</span><div class="act">${c.estado === 'ACTIVA' && c.moneda === 'CRC' ? `<a class="btn s" href="#/sinpe?cliente=${c.id_cliente}">${ic('plus')}Afiliar</a>` : ''}</div></div><div class="bb">
        ${vig.length ? vig.map(t => `<div class="ph-row"><div class="g"><div class="b num">${tel(t.numero)}</div><div class="xs ink2">desde ${num(fdh(t.afiliado_desde))}</div></div><button class="btn s" data-trasladar="${t.numero}">Trasladar</button><button class="btn s neg" data-desafiliar="${t.numero}">Desafiliar</button></div>`).join('')
          : `<div class="sm ink2" style="padding:8px 0">${c.moneda !== 'CRC' ? 'Las cuentas en dólares no se afilian a SINPE Móvil.' : c.estado !== 'ACTIVA' ? 'La cuenta no está activa, así que no puede tener afiliaciones.' : 'Ningún teléfono afiliado.'}</div>`}
        ${vig.length > 1 ? '<div class="xs ink2" style="padding-top:10px">Comparten esta cuenta, así que no pueden transferirse entre sí.</div>' : ''}
        ${ant.length ? `<div class="xs ink2 b" style="padding-top:16px">Estuvieron afiliados antes</div>${ant.map(t => `<div class="ph-row"><div class="g"><span class="num">${tel(t.numero)}</span> <span class="xs ink2">· ${esc(t.titular)} · último evento ${num(fd(t.ultimo_evento))}</span></div><a class="btn s" href="#/sinpe/historial/${t.numero}">Historial</a></div>`).join('')}` : ''}
      </div></div>
      <div class="block"><div class="bh"><h2>Movimientos recientes</h2><div class="act"><a class="btn q" href="#/movimientos?iban=${c.iban}">Ver todos</a></div></div>${movimientos.length ? `<table><tbody>
        ${movimientos.map(t => { const out = t.iban_origen === c.iban; const otro = out ? t.titular_destino : t.titular_origen;
          const ref = t.tipo === 'SINPE' ? tel(out ? t.telefono_destino : t.telefono_origen) : sh(out ? t.iban_destino : t.iban_origen);
          return `<tr><td class="ink2" style="width:130px">${num(fdh(t.fecha))}</td><td>${out ? 'A' : 'De'} ${num(ref)} · ${esc(first(otro))}</td><td class="sm ink2">${t.tipo === 'SINPE' ? 'SINPE Móvil' : 'IBAN'}</td><td class="r b num ${out ? '' : 'pos'}">${out ? '−' : '+'}${fm(t.monto, t.moneda)}</td></tr>`; }).join('')}
      </tbody></table>` : vacio('Sin movimientos.')}</div>
    </div>`);
  return [html, () => {
    $('#estado').onclick = () => modalEstadoCuenta(c);
    $$('[data-trasladar]').forEach(b => b.onclick = () => modalTrasladar(b.dataset.trasladar));
    $$('[data-desafiliar]').forEach(b => b.onclick = () => modalDesafiliar(b.dataset.desafiliar, c.iban, c.titular));
  }];
};

/* ---------- teléfonos ---------- */
async function panelTelefono(identificacion) {
  const clientes = (await GET('/api/clientes')).filter(c => c.estado === 'ACTIVO');
  abrirCapa('drawer', 'Registrar teléfono', `<form class="stack" style="gap:18px" id="ft">
      ${fld('Número celular', '<input class="in num b" id="tn" inputmode="numeric" maxlength="9" placeholder="8888-1111" required style="font-size:16px">', {for:'tn', hint:'Debe tener 8 dígitos y no estar registrado.', hid:'tnh'})}
      ${fld('Titular', `<select class="in" id="tt" required><option value="">Elija un cliente activo</option>${opts(clientes, c => c.identificacion, c => `${c.nombre_completo} · ${c.identificacion}`, identificacion)}</select>`, {for:'tt'})}
      ${nota('', 'El número queda registrado a nombre del cliente, pero <b>sin afiliar</b>. Para recibir SINPE Móvil hay que afiliarlo después.')}
      <div id="err"></div><button type="submit" hidden></button></form>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ok">Registrar teléfono</button>`,
    () => {
      $('#tn').oninput = e => { const d = e.target.value.replace(/\D/g, '').slice(0, 8); e.target.value = d.length > 4 ? tel(d) : d;
        $('#tnh').className = 'hint ' + (d.length === 8 ? 'ok' : d ? '' : ''); $('#tnh').textContent = d.length === 8 ? '8 dígitos' : `${d.length} de 8 dígitos`; };
      const enviar = () => accion($('#ok'), async () => {
        await POST('/api/telefonos', {numero: $('#tn').value, identificacion: $('#tt').value});
        cerrarCapa(); aviso('Teléfono registrado (sin afiliar).'); render();
      }, $('#err'));
      $('#ok').onclick = enviar; $('#ft').onsubmit = e => { e.preventDefault(); enviar(); };
    });
}

async function modalTitular(t) {
  const clientes = (await GET('/api/clientes')).filter(c => c.estado === 'ACTIVO' && c.id_cliente !== t.id_cliente);
  abrirCapa('modal', `Cambiar titular de ${tel(t.numero)}`, `<div class="stack" style="gap:16px">
      <p class="ink2">Titular actual: <b>${esc(t.titular)}</b></p>
      ${fld('Nuevo titular', `<select class="in" id="nt"><option value="">Elija un cliente</option>${opts(clientes, c => c.identificacion, c => `${c.nombre_completo} · ${c.identificacion}`)}</select>`, {for:'nt'})}
      ${t.afiliado === 'SI' ? nota('warn', `El número está afiliado a ${gi(t.iban_afiliado)}, que es de ${esc(t.titular)}. El procedimiento lo desafilia y cambia el titular en una sola transacción, para no dejar una afiliación inválida.`) : ''}
      <div id="err"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ok">Cambiar titular</button>`,
    () => $('#ok').onclick = () => accion($('#ok'), async () => {
      await PUT(`/api/telefonos/${t.numero}/titular`, {identificacion: $('#nt').value});
      cerrarCapa(); aviso('Titular actualizado.'); render();
    }, $('#err')));
}

R.telefonos = async () => {
  const lista = await GET('/api/telefonos');
  const nAf = lista.filter(t => t.afiliado === 'SI').length;
  const porque = t => t.estado_cliente === 'INACTIVO' ? 'El cliente está inactivo' : t.cuentas_validas === 0 ? 'No tiene cuentas activas en colones' : '';
  const html = shell('telefonos', cr(['Teléfonos']), title('Teléfonos', 'Registrar un número no lo afilia a SINPE Móvil; la afiliación es un paso aparte.', `<button class="btn pri" id="nuevo">${ic('plus')}Registrar teléfono</button>`) + `
    <div class="tabs" id="tabs"><div class="tab on" data-v="">Todos <span class="c">${lista.length}</span></div><div class="tab" data-v="SI">Afiliados <span class="c">${nAf}</span></div><div class="tab" data-v="NO">Sin afiliar <span class="c">${lista.length - nAf}</span></div></div>
    <div class="block"><table>
      <thead><tr><th>Número</th><th>Titular</th><th>Afiliación SINPE Móvil</th><th>Desde</th><th class="r"></th></tr></thead>
      <tbody id="filas"></tbody></table></div>`);
  return [html, () => {
    let f = '';
    const pintar = () => {
      const fil = lista.filter(t => !f || t.afiliado === f);
      $('#filas').innerHTML = fil.length ? fil.map(t => `<tr><td class="b">${num(tel(t.numero))}</td><td><div class="who">${av(t.titular)}<a href="#/clientes/${t.id_cliente}">${esc(t.titular)}</a></div></td>
        <td>${t.afiliado === 'SI' ? `<span class="link"><span class="st ok">Afiliado</span><i></i>${num(gi(t.iban_afiliado))}</span>` : `${af(0)}${porque(t) ? ` <span class="sm ink2">· ${porque(t)}</span>` : ''}`}</td>
        <td>${t.fecha_afiliacion ? num(fd(t.fecha_afiliacion)) : '<span class="ink3">—</span>'}</td>
        <td class="r">${t.afiliado === 'SI' ? `<button class="btn s" data-trasladar="${t.numero}">Trasladar</button> <button class="btn s neg" data-desafiliar="${t.numero}">Desafiliar</button>`
          : porque(t) ? '' : `<a class="btn s pri" href="#/sinpe?numero=${t.numero}">Afiliar</a>`}
          <button class="btn s" data-titular="${t.numero}">Titular</button> <a class="btn s" href="#/sinpe/historial/${t.numero}">Historial</a></td></tr>`).join('')
        : `<tr><td colspan="5">${vacio('No hay teléfonos en esta lista.')}</td></tr>`;
      $$('[data-trasladar]').forEach(b => b.onclick = () => modalTrasladar(b.dataset.trasladar));
      $$('[data-desafiliar]').forEach(b => { const t = lista.find(x => x.numero === b.dataset.desafiliar); b.onclick = () => modalDesafiliar(t.numero, t.iban_afiliado, t.titular); });
      $$('[data-titular]').forEach(b => b.onclick = () => modalTitular(lista.find(x => x.numero === b.dataset.titular)));
    };
    $$('#tabs .tab').forEach(s => s.onclick = () => { $$('#tabs .tab').forEach(x => x.classList.remove('on')); s.classList.add('on'); f = s.dataset.v; pintar(); });
    $('#nuevo').onclick = () => panelTelefono();
    pintar();
  }];
};

/* ---------- SINPE Móvil ---------- */
async function modalTrasladar(numero) {
  const [tels, cuentas] = await Promise.all([GET('/api/telefonos'), GET('/api/cuentas')]);
  const t = tels.find(x => x.numero === numero);
  const otras = cuentas.filter(c => c.id_cliente === t.id_cliente && c.iban !== t.iban_afiliado);
  const problema = c => c.moneda !== 'CRC' ? 'es en USD' : c.estado !== 'ACTIVA' ? `está ${c.estado.toLowerCase()}` : '';
  abrirCapa('modal', `Trasladar ${tel(numero)}`, `<div class="stack" style="gap:18px">
      <p class="ink2">El número pasa a otra cuenta de ${esc(t.titular)}.</p>
      ${otras.length ? `<div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:end;gap:8px">
        ${fld('Cuenta actual', `<div class="in num">${gi(t.iban_afiliado)}</div>`)}
        <div style="height:40px;display:grid;place-items:center;color:var(--accent)">${ic('right', ' width="20" height="20"')}</div>
        ${fld('Nueva cuenta', `<select class="in num" id="nc">${otras.map(c => `<option value="${c.iban}">${gi(c.iban)}${problema(c) ? ` (${problema(c)})` : ''}</option>`).join('')}</select>`, {for:'nc'})}
      </div>
      <div id="aviso-nc"></div>
      ${nota('', 'Se desafilia la cuenta actual y se afilia la nueva en un solo paso. Si la nueva afiliación falla, el número vuelve a su cuenta actual.', 'lock')}`
      : nota('warn', `${esc(t.titular)} no tiene otra cuenta. Abra una cuenta activa en colones para poder trasladar.`)}
      <div id="err"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button>${otras.length ? '<button class="btn pri" id="ok">Trasladar</button>' : ''}`,
    () => {
      if (!otras.length) return;
      const avisar = () => { const c = otras.find(x => x.iban === $('#nc').value);
        $('#aviso-nc').innerHTML = problema(c) ? nota('warn', `Esta cuenta ${problema(c)}: el segundo paso fallará y se recuperará la afiliación original. Sirve para probar la reversión.`) : ''; };
      $('#nc').onchange = avisar; avisar();
      $('#ok').onclick = () => accion($('#ok'), async () => {
        try { await POST('/api/sinpe/trasladar', {numero, iban: $('#nc').value}); }
        catch (e) { throw new Error(`${e.message} Se revirtió el traslado: ${tel(numero)} sigue afiliado a ${sh(t.iban_afiliado)}.`); }
        cerrarCapa(); aviso(`${tel(numero)} trasladado.`); ir('/sinpe/historial/' + numero);
      }, $('#err'));
    });
}

function modalDesafiliar(numero, iban, titular) {
  abrirCapa('modal', `¿Desafiliar ${tel(numero)}?`, `<div class="stack" style="gap:14px">
      <p>Dejará de recibir transferencias SINPE Móvil en <b class="num">${gi(iban)}</b>.</p>
      <p class="ink2">El número sigue registrado a nombre de ${esc(titular)} y su historial se conserva.</p><div id="err"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn negf" id="ok">Desafiliar</button>`,
    () => $('#ok').onclick = () => accion($('#ok'), async () => {
      await POST('/api/sinpe/desafiliar', {numero});
      cerrarCapa(); aviso(`${tel(numero)} desafiliado.`); render();
    }, $('#err')));
}

R.sinpe = async (p, qs) => {
  const [tels, cuentas] = await Promise.all([GET('/api/telefonos'), GET('/api/cuentas')]);
  const afil = tels.filter(t => t.afiliado === 'SI'), libres = tels.filter(t => t.afiliado === 'NO');
  const porCuenta = [...new Set(afil.map(t => t.iban_afiliado))].map(i => cuentas.find(c => c.iban === i));
  let pre = qs.get('numero') || '';
  if (!pre && qs.get('cliente')) pre = libres.find(t => String(t.id_cliente) === qs.get('cliente'))?.numero || '';
  const html = shell('sinpe', cr(['SINPE Móvil']), title('SINPE Móvil', `${plural(afil.length, 'teléfono afiliado', 'teléfonos afiliados')} en ${plural(porCuenta.length, 'cuenta', 'cuentas')}. ${plural(libres.length, 'sigue', 'siguen')} sin afiliar.`) + `
    <div class="cols c12">
      <div class="block"><div class="bh"><h2>Afiliar un teléfono</h2></div><div class="bb stack" style="gap:16px">
        ${libres.length ? `${fld('Teléfono', `<select class="in" id="ft"><option value="">Elija un número sin afiliar</option>${libres.map(t => `<option value="${t.numero}"${t.numero === pre ? ' selected' : ''}>${tel(t.numero)} · ${esc(t.titular)}</option>`).join('')}</select>`, {for:'ft'})}
        <div class="field"><label>Cuenta</label><div class="stack" id="picks"></div><div class="hint" id="ph"></div></div>
        <div id="err"></div>
        <button class="btn pri" id="afiliar" disabled>${ic('link')}Afiliar</button>` : vacio('Todos los teléfonos registrados ya están afiliados.')}
      </div></div>
      <div class="block"><div class="bh"><h2>Afiliaciones vigentes</h2><div class="act"><span class="sm ink2">Agrupadas por cuenta</span></div></div><div class="bb">
        ${porCuenta.length ? porCuenta.map(a => { const ts = afil.filter(t => t.iban_afiliado === a.iban); return `<div class="acct"><div class="acct-h">${av(a.titular)}<div style="flex:1"><a class="b num" href="#/cuentas/${a.iban}">${gi(a.iban)}</a><div class="xs ink2">${esc(a.titular)} · ${esc(a.entidad)}</div></div>${cur(a.moneda)}</div>
          ${ts.map(t => `<div class="ph-row"><span class="link"><span class="b num">${tel(t.numero)}</span><i></i></span><div class="g sm ink2">desde ${num(fd(t.fecha_afiliacion))}</div>
            <button class="btn s" data-trasladar="${t.numero}">Trasladar</button><button class="btn s neg" data-desafiliar="${t.numero}">Desafiliar</button><a class="btn s" href="#/sinpe/historial/${t.numero}">Historial</a></div>`).join('')}
          ${ts.length > 1 ? '<div class="xs ink2" style="padding-top:8px">Estos números comparten cuenta: no pueden transferirse entre sí.</div>' : ''}</div>`; }).join('') : vacio('No hay afiliaciones vigentes.')}
      </div></div>
    </div>`);
  return [html, () => {
    $$('[data-trasladar]').forEach(b => b.onclick = () => modalTrasladar(b.dataset.trasladar));
    $$('[data-desafiliar]').forEach(b => { const t = afil.find(x => x.numero === b.dataset.desafiliar); b.onclick = () => modalDesafiliar(t.numero, t.iban_afiliado, t.titular); });
    if (!libres.length) return;
    let elegida = '';
    const razon = c => c.moneda !== 'CRC' ? 'No se puede: la cuenta es en USD' : c.estado !== 'ACTIVA' ? `No se puede: la cuenta está ${c.estado.toLowerCase()}` : '';
    const pintar = () => {
      const t = libres.find(x => x.numero === $('#ft').value);
      elegida = '';
      if (!t) { $('#picks').innerHTML = '<div class="sm ink3">Primero elija un teléfono.</div>'; $('#ph').textContent = ''; $('#afiliar').disabled = true; return; }
      const cs = cuentas.filter(c => c.id_cliente === t.id_cliente);
      const validas = cs.filter(c => !razon(c));
      elegida = validas[0]?.iban || '';
      $('#picks').innerHTML = cs.length ? cs.map(c => `<label class="pick${razon(c) ? ' off' : ''}${c.iban === elegida ? ' on' : ''}" data-iban="${c.iban}"><input type="radio" name="cta" value="${c.iban}"${razon(c) ? ' disabled' : ''}${c.iban === elegida ? ' checked' : ''}><span class="radio"></span><div class="g"><div class="b num${razon(c) ? ' ink3' : ''}">${gi(c.iban)}</div><div class="xs${razon(c) ? '' : ' ink2'}"${razon(c) ? ' style="color:var(--neg)"' : ''}>${razon(c) || `${esc(c.entidad)} · CRC · Activa · ${plural(c.telefonos_afiliados, 'teléfono', 'teléfonos')}`}</div></div></label>`).join('')
        : nota('warn', `${esc(t.titular)} no tiene cuentas.`);
      $('#ph').textContent = `Solo aparecen cuentas de ${t.titular}. Se afilian únicamente cuentas activas en colones.`;
      $('#afiliar').disabled = !elegida;
      $('#afiliar').innerHTML = `${ic('link')}Afiliar ${tel(t.numero)}`;
      $$('#picks .pick:not(.off)').forEach(l => l.onclick = () => { $$('#picks .pick').forEach(x => x.classList.remove('on')); l.classList.add('on'); elegida = l.dataset.iban; $('#afiliar').disabled = false; });
    };
    $('#ft').onchange = pintar; pintar();
    $('#afiliar').onclick = () => accion($('#afiliar'), async () => {
      await POST('/api/sinpe/afiliar', {numero: $('#ft').value, iban: elegida});
      aviso(`${tel($('#ft').value)} afiliado a ${sh(elegida)}.`); ir('/sinpe');
    }, $('#err'));
  }];
};

R.historial = async ([numero]) => {
  const [{telefono: t, eventos}, tels] = await Promise.all([GET('/api/sinpe/historial/' + numero), GET('/api/telefonos')]);
  const html = shell('sinpe', cr(['SINPE Móvil', '/sinpe'], [`Historial de ${tel(numero)}`]), title(`Historial de ${tel(numero)}`, 'Cada afiliación y desafiliación la registra un trigger. Un traslado deja dos eventos con la misma hora.', `<button class="btn" id="csv">${ic('dl')}Exportar</button>`) + `
    <div class="cols c12">
      <div class="block"><div class="bb" style="padding-top:20px">
        ${fld('Teléfono', `<select class="in num b" id="sel">${tels.map(x => `<option value="${x.numero}"${x.numero === numero ? ' selected' : ''}>${tel(x.numero)} · ${esc(first(x.titular))}</option>`).join('')}</select>`, {for:'sel'})}
        <div style="margin-top:12px"><div class="kv"><span>Titular</span><span class="who" style="gap:8px">${av(t.titular)}${esc(t.titular)}</span></div>
        <div class="kv"><span>Estado</span>${af(t.afiliado === 'SI')}</div>
        <div class="kv"><span>Cuenta vigente</span>${t.iban_afiliado ? `<a class="b num" href="#/cuentas/${t.iban_afiliado}">${sh(t.iban_afiliado)}</a>` : '<span class="ink3">—</span>'}</div>
        <div class="kv"><span>Desde</span><b class="num">${t.fecha_afiliacion ? fdh(t.fecha_afiliacion) : '—'}</b></div>
        <div class="kv"><span>Eventos</span><b class="num">${eventos.length}</b></div></div>
      </div></div>
      <div class="block"><div class="bh"><h2>Eventos</h2><div class="act"><span class="sm ink2">Del más antiguo al más reciente</span></div></div>${eventos.length ? `<table>
        <thead><tr><th>Fecha</th><th>Evento</th><th>Cuenta</th><th>Motivo</th></tr></thead><tbody>
        ${eventos.map(e => `<tr><td>${num(fdh(e.fecha_evento) + e.fecha_evento.slice(16, 19))}</td><td>${e.tipo_evento === 'AFILIACION' ? '<span class="st ok">Afiliación</span>' : '<span class="st bad">Desafiliación</span>'}</td><td class="num">${gi(e.iban)}</td><td class="ink2">${esc(e.motivo)}</td></tr>`).join('')}
      </tbody></table>` : vacio('Este número nunca ha estado afiliado.')}</div>
    </div>`);
  return [html, () => {
    $('#sel').onchange = e => ir('/sinpe/historial/' + e.target.value);
    $('#csv').onclick = () => descargarCSV(`historial-${numero}.csv`, [['fecha', 'evento', 'iban', 'entidad', 'motivo'], ...eventos.map(e => [e.fecha_evento, e.tipo_evento, e.iban, e.entidad, e.motivo])]);
  }];
};

function descargarCSV(nombre, filas) {
  const csv = '﻿' + filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(new Blob([csv], {type: 'text/csv'})), download: nombre});
  a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- transferir ---------- */
const transferTabs = on => `<div class="tabs"><a class="tab${on === 'tel' ? ' on' : ''}" href="#/transferir">Por teléfono</a><a class="tab${on === 'iban' ? ' on' : ''}" href="#/transferir/iban">Por IBAN</a></div>`;

R.transferir = async () => {
  const tels = (await GET('/api/telefonos')).filter(t => t.afiliado === 'SI');
  const html = shell('transferir', cr(['Transferir']), title('Transferir', 'El dinero sale y entra en un mismo paso. Si algo falla, no se mueve nada.') + transferTabs('tel') + `
    <div class="cols c2">
      <div class="block"><form class="bb stack" style="gap:18px;padding-top:20px" id="f">
        ${fld('Desde', `<select class="in" id="o" required><option value="">Teléfono afiliado de origen</option>${tels.map(t => `<option value="${t.numero}"${estado.transferencia?.origen === t.numero ? ' selected' : ''}>${tel(t.numero)} · ${esc(t.titular)}</option>`).join('')}</select>`, {for:'o', hint:'', hid:'oh'})}
        ${fld('Para', `<input class="in num b" id="d" inputmode="numeric" maxlength="9" placeholder="8888-3333" required value="${tel(estado.transferencia?.destino || '')}">`, {for:'d', hint:'Número de 8 dígitos afiliado a SINPE Móvil.', hid:'dh'})}
        <div class="form">${fld('Monto', `<div class="money"><span class="pre">₡</span><input class="in num b" id="m" type="number" min="0.01" step="0.01" required value="${estado.transferencia?.monto || ''}"></div>`, {for:'m'})}${fld('Detalle', `<input class="in" id="det" maxlength="140" placeholder="Opcional" value="${esc(estado.transferencia?.detalle)}">`, {for:'det'})}</div>
        <button class="btn pri l" type="submit">Revisar transferencia</button>
      </form></div>
      <div class="block" style="background:var(--sub);border-color:transparent"><div class="bb" style="padding-top:24px" id="prev"></div></div>
    </div>`);
  return [html, () => vistaPrevia('tel')];
};

R.transferirIban = async (p, qs) => {
  const cuentas = (await GET('/api/cuentas')).filter(c => c.estado === 'ACTIVA');
  const pre = qs.get('origen') || estado.transferencia?.origen;
  const html = shell('transferir', cr(['Transferir']), title('Transferir', 'El dinero sale y entra en un mismo paso. Si algo falla, no se mueve nada.') + transferTabs('iban') + `
    <div class="cols c2">
      <div class="block"><form class="bb stack" style="gap:18px;padding-top:20px" id="f">
        ${fld('Desde', `<select class="in num" id="o" required><option value="">Cuenta activa de origen</option>${cuentas.map(c => `<option value="${c.iban}"${pre === c.iban ? ' selected' : ''}>${gi(c.iban)} · ${esc(first(c.titular))} · ${c.moneda}</option>`).join('')}</select>`, {for:'o', hint:'', hid:'oh'})}
        ${fld('Para', `<input class="in num b" id="d" maxlength="27" placeholder="CR00 0000 0000 0000 0000 00" required autocomplete="off" value="${gi(estado.transferencia?.tipo === 'iban' ? estado.transferencia.destino : '')}">`, {for:'d', hint:'IBAN de 22 caracteres.', hid:'dh'})}
        <div class="form">${fld('Monto', `<div class="money"><span class="pre" id="sim">₡</span><input class="in num b" id="m" type="number" min="0.01" step="0.01" required value="${estado.transferencia?.tipo === 'iban' ? estado.transferencia.monto : ''}"></div>`, {for:'m'})}${fld('Detalle', `<input class="in" id="det" maxlength="140" placeholder="Opcional" value="${esc(estado.transferencia?.tipo === 'iban' ? estado.transferencia.detalle : '')}">`, {for:'det'})}</div>
        <button class="btn pri l" type="submit">Revisar transferencia</button>
      </form></div>
      <div class="block" style="background:var(--sub);border-color:transparent"><div class="bb" style="padding-top:24px" id="prev"></div></div>
    </div>`);
  return [html, () => vistaPrevia('iban')];
};

// Vista previa en vivo: consulta los datos y adelanta las validaciones.
// Es solo orientativa: la decisión final la toma el procedimiento almacenado.
function vistaPrevia(tipo) {
  let O = null, D = null, sec = 0;
  const lim = v => tipo === 'tel' ? v.replace(/\D/g, '').slice(0, 8) : v.replace(/\s/g, '').toUpperCase().slice(0, 22);
  const completo = v => tipo === 'tel' ? v.length === 8 : v.length === 22;
  const buscar = v => GET(`/api/buscar/${tipo === 'tel' ? 'telefono' : 'iban'}/${v}`);
  const etiqueta = (x, v) => tipo === 'tel' ? [tel(v), x ? `${esc(first(x.titular))}${x.iban ? ' · ' + sh(x.iban) : ''}` : '—'] : [sh(v), x ? `${esc(first(x.titular))} · ${x.moneda}` : '—'];
  const pintar = () => {
    const o = $('#o').value, d = lim($('#d').value), m = +$('#m').value;
    const mon = (tipo === 'tel' ? 'CRC' : O?.moneda) || 'CRC';
    if ($('#sim')) $('#sim').textContent = SIM[mon];
    $('#oh').textContent = O ? `${O.titular} · ${O.entidad || ''} · saldo ${fm(O.saldo, O.moneda)}` : '';
    const dh = $('#dh');
    if (!d) { dh.className = 'hint'; dh.textContent = tipo === 'tel' ? 'Número de 8 dígitos afiliado a SINPE Móvil.' : 'IBAN de 22 caracteres.'; }
    else if (!completo(d)) { dh.className = 'hint'; dh.textContent = `${d.length} de ${tipo === 'tel' ? 8 : 22}`; }
    else if (!D) { dh.className = 'hint bad'; dh.textContent = tipo === 'tel' ? 'Ese número no está registrado.' : 'No existe una cuenta con ese IBAN.'; }
    else if (tipo === 'tel' && D.afiliado !== 'SI') { dh.className = 'hint bad'; dh.textContent = `${D.titular} · no está afiliado a SINPE Móvil`; }
    else { dh.className = 'hint ok'; dh.textContent = `${D.titular} · ${D.entidad} · ${D.moneda}`; }
    const cO = tipo === 'tel' ? O?.iban : O?.iban, cD = D?.iban;
    const listos = O && D && (tipo === 'iban' || D.afiliado === 'SI');
    const checks = tipo === 'tel'
      ? [['Los dos números están afiliados', listos && O.afiliado === 'SI'], ['Las cuentas están activas y en colones', listos && O.estado === 'ACTIVA' && D.estado === 'ACTIVA' && O.moneda === 'CRC' && D.moneda === 'CRC'], ['Son cuentas distintas', listos && cO !== cD]]
      : [['Las dos cuentas están activas', listos && O.estado === 'ACTIVA' && D.estado === 'ACTIVA'], [`Las dos son en ${mon === 'USD' ? 'dólares' : 'colones'}`, listos && O.moneda === D.moneda], ['Son cuentas distintas', listos && cO !== cD]];
    checks.push([m > 0 && O ? (O.saldo >= m ? `Hay saldo suficiente: quedan ${fm(O.saldo - m, O.moneda)}` : `Saldo insuficiente: hay ${fm(O.saldo, O.moneda)}`) : 'El monto es positivo y hay saldo suficiente', m > 0 && O && O.saldo >= m]);
    $('#prev').innerHTML = `<div class="sm ink2 b" style="margin-bottom:14px">Así sale el dinero</div>
      ${pair(o ? etiqueta(O, o) : ['—', 'origen'], d ? etiqueta(D, d) : ['—', 'destino'], m > 0 ? fm(m, mon) : '—', 'lg sub' + (listos ? ' live' : ' mute'))}
      <div class="checks" style="margin-top:20px">${checks.map(([t, ok]) => ck(t, listos && m > 0 && !ok, !(listos && m > 0))).join('')}</div>
      ${listos && cO === cD && tipo === 'tel' ? `<div style="margin-top:12px">${nota('bad', 'Los dos números están afiliados a la misma cuenta. El procedimiento rechazará la transferencia.')}</div>` : ''}`;
  };
  const cargarO = async () => { const v = $('#o').value; const n = ++sec; O = v ? await buscar(v) : null; if (n === sec) pintar(); };
  const cargarD = async () => { const v = lim($('#d').value); D = completo(v) ? await buscar(v) : null; pintar(); };
  $('#o').onchange = cargarO;
  $('#d').oninput = e => { const v = lim(e.target.value); e.target.value = tipo === 'tel' ? (v.length > 4 ? tel(v) : v) : gi(v); cargarD(); };
  $('#m').oninput = pintar;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = lim($('#d').value);
    if (!completo(d)) { aviso(tipo === 'tel' ? 'El número de destino debe tener 8 dígitos.' : 'El IBAN de destino debe tener 22 caracteres.', true); return; }
    estado.transferencia = {tipo, origen: $('#o').value, destino: d, monto: $('#m').value, detalle: $('#det').value, O, D};
    ir('/transferir/confirmar');
  };
  cargarO(); cargarD();
}

R.confirmar = async () => {
  const t = estado.transferencia;
  if (!t || !t.O || !t.D) { ir('/transferir'); return null; }
  const mon = t.tipo === 'tel' ? 'CRC' : t.O.moneda;
  const a = t.tipo === 'tel' ? [tel(t.origen), esc(t.O.titular)] : [sh(t.origen), esc(t.O.titular)];
  const b = t.tipo === 'tel' ? [tel(t.destino), esc(t.D.titular)] : [sh(t.destino), esc(t.D.titular)];
  const html = shell('transferir', cr(['Transferir', t.tipo === 'tel' ? '/transferir' : '/transferir/iban'], ['Confirmar']), `
    <div style="width:min(680px,100%);margin:12px auto 0" class="stack">
      <h1 style="font-size:24px;letter-spacing:-.02em;font-weight:600">Confirma la transferencia</h1>
      <div class="block" style="margin-top:12px"><div class="bb" style="padding-top:28px">
        <div class="ink2 sm">Monto</div><div class="huge num">${fm(t.monto, mon)}</div>
        <div style="margin:28px 0 8px">${pair(a, b, t.tipo === 'tel' ? 'SINPE Móvil' : 'IBAN', 'lg')}</div>
        <div class="kv"><span>Cuenta de origen</span><span class="num">${gi(t.O.iban || '')}</span></div>
        <div class="kv"><span>Cuenta de destino</span><span class="num">${gi(t.D.iban || '')} · ${esc(t.D.entidad || '')}</span></div>
        <div class="kv"><span>Detalle</span><span>${esc(t.detalle) || '<span class="ink3">—</span>'}</span></div>
        <div class="kv"><span>Saldo después</span><b class="num">${t.O.saldo != null ? fm(t.O.saldo - t.monto, mon) : '—'}</b></div>
      </div><div class="mf"><a class="btn" href="#${t.tipo === 'tel' ? '/transferir' : '/transferir/iban'}">Volver</a><button class="btn pri" id="ok">Transferir ${fm(t.monto, mon)}</button></div></div>
    </div>`);
  return [html, () => $('#ok').onclick = () => accion($('#ok'), async () => {
    const cuerpo = {origen: t.origen, destino: t.destino, monto: t.monto, detalle: t.detalle};
    try { estado.resultado = {ok: true, t: await POST(`/api/transferencias/${t.tipo === 'tel' ? 'sinpe' : 'iban'}`, cuerpo), pedido: t}; }
    catch (e) { estado.resultado = {ok: false, error: e.message, codigo: e.codigo, pedido: t}; }
    estado.transferencia = null;
    ir('/transferir/resultado');
  })];
};

R.resultado = async () => {
  const r = estado.resultado;
  if (!r) { ir('/transferir'); return null; }
  const p = r.pedido, mon = p.tipo === 'tel' ? 'CRC' : p.O.moneda;
  if (r.ok) {
    const t = r.t;
    return shell('transferir', cr(['Transferir', '/transferir'], ['Comprobante']), `
      <div style="width:min(680px,100%);margin:12px auto 0" class="stack">
        <div style="display:flex;align-items:center;gap:12px"><span style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center">${ic('check', ' width="20" height="20" stroke-width="2.2"')}</span><h1 style="font-size:24px;letter-spacing:-.02em;font-weight:600">Transferencia enviada</h1></div>
        <div class="block" style="margin-top:12px"><div class="bb" style="padding-top:28px">
          <div class="huge num">${fm(t.monto, t.moneda)}</div>
          <div style="margin:28px 0 8px">${t.tipo === 'SINPE' ? pair([tel(t.telefono_origen), esc(t.titular_origen)], [tel(t.telefono_destino), esc(t.titular_destino)], 'SINPE Móvil', 'lg live') : pair([sh(t.iban_origen), esc(t.titular_origen)], [sh(t.iban_destino), esc(t.titular_destino)], 'IBAN', 'lg live')}</div>
          <div class="kv"><span>Comprobante</span><b class="num">${t.comprobante}</b></div>
          <div class="kv"><span>Fecha</span><span class="num">${fdh(t.fecha)}</span></div>
          <div class="kv"><span>Detalle</span><span>${esc(t.detalle) || '<span class="ink3">—</span>'}</span></div>
          <div class="kv"><span>Saldo de ${esc(first(t.titular_origen))}</span><b class="num">${fm(t.saldo_origen_despues, t.moneda)}</b></div>
          <div class="kv"><span>Saldo de ${esc(first(t.titular_destino))}</span><span class="num">${fm(t.saldo_destino_despues, t.moneda)}</span></div>
        </div><div class="mf"><a class="btn" href="#/movimientos?iban=${t.iban_origen}">Ver movimientos</a><a class="btn pri" href="#/transferir${t.tipo === 'SINPE' ? '' : '/iban'}">Nueva transferencia</a></div></div>
      </div>`);
  }
  const misma = /misma cuenta|sí misma/i.test(r.error);
  const a = p.tipo === 'tel' ? tel(p.origen) : sh(p.origen), b = p.tipo === 'tel' ? tel(p.destino) : sh(p.destino);
  return shell('transferir', cr(['Transferir', '/transferir'], ['Rechazada']), `
    <div style="width:min(680px,100%);margin:12px auto 0" class="stack">
      <div style="display:flex;align-items:center;gap:12px"><span style="width:36px;height:36px;border-radius:50%;background:var(--neg);color:#fff;display:grid;place-items:center">${ic('x', ' width="20" height="20" stroke-width="2.2"')}</span><h1 style="font-size:24px;letter-spacing:-.02em;font-weight:600">No se hizo la transferencia</h1></div>
      <p class="ink2">${esc(r.error)} No se movió ningún ${mon === 'USD' ? 'dólar' : 'colón'}: la transacción se revirtió completa.</p>
      <div class="block" style="margin-top:12px"><div class="bb" style="padding-top:28px">
        ${misma && p.tipo === 'tel' ? `<div class="vee">
          <svg viewBox="0 0 560 150" fill="none" aria-hidden="true"><path d="M150 26 L262 112" stroke="#B3261E" stroke-width="2" stroke-dasharray="5 5"/><path d="M410 26 L298 112" stroke="#B3261E" stroke-width="2" stroke-dasharray="5 5"/><circle cx="280" cy="64" r="13" fill="#FBEAE8"/><path d="M275 59l10 10M285 59l-10 10" stroke="#B3261E" stroke-width="2" stroke-linecap="round"/></svg>
          <div class="a"><div class="b num" style="font-size:20px">${a}</div><div class="xs ink2">origen</div></div>
          <div class="b2"><div class="b num" style="font-size:20px">${b}</div><div class="xs ink2">destino</div></div>
          <div class="c3"><div class="b num">${gi(p.O.iban || '')}</div><div class="xs ink2">la misma cuenta de ${esc(first(p.O.titular))}</div></div>
        </div>` : pair([a, esc(p.O.titular)], [b, esc(p.D.titular)], fm(p.monto, mon), 'lg mute')}
        <div class="kv" style="margin-top:20px"><span>Monto</span><b class="num">${fm(p.monto, mon)}</b></div>
        <div class="kv"><span>Saldo de ${esc(first(p.O.titular))}</span><span class="num">${p.O.saldo != null ? fm(p.O.saldo, mon) + ', sin cambios' : '—'}</span></div>
        <div class="kv"><span>Código</span><span class="num">${esc(r.codigo || '—')}</span></div>
      </div><div class="mf"><a class="btn" href="#/inicio">Ir al inicio</a><button class="btn pri" id="reint">Cambiar datos</button></div></div>
    </div>`);
};
R.resultadoMontar = () => { const b = $('#reint'); if (b) b.onclick = () => { const p = estado.resultado.pedido; estado.transferencia = p; ir(p.tipo === 'tel' ? '/transferir' : '/transferir/iban'); }; };

/* ---------- movimientos e informes ---------- */
R.movimientos = async (p, qs) => {
  const cuentas = await GET('/api/cuentas');
  const iban = qs.get('iban') || cuentas.find(c => c.estado === 'ACTIVA' && c.moneda === 'CRC')?.iban || cuentas[0]?.iban;
  const desde = qs.get('desde') || inicioMes(), hasta = qs.get('hasta') || hoyISO();
  const c = cuentas.find(x => x.iban === iban);
  let mv = null, cons = null, err = '';
  try { [mv, cons] = await Promise.all([GET(`/api/movimientos?iban=${iban}&desde=${desde}&hasta=${hasta}`), GET(`/api/conservacion?desde=${desde}&hasta=${hasta}`)]); }
  catch (e) { err = e.message; }
  const m = c?.moneda;
  const html = shell('movimientos', cr(['Movimientos']), title('Movimientos', 'Lo enviado y recibido por una cuenta en un período, con su saldo después de cada movimiento.', mv ? `<button class="btn" id="csv">${ic('dl')}Exportar</button>` : '') + `
    <form class="filters" id="f">
      ${fld('Cuenta', `<select class="in num" id="c">${cuentas.map(x => `<option value="${x.iban}"${x.iban === iban ? ' selected' : ''}>${gi(x.iban)} · ${esc(first(x.titular))} · ${x.moneda}</option>`).join('')}</select>`, {for:'c'})}
      ${fld('Desde', `<input class="in num" type="date" id="de" value="${desde}">`, {for:'de'})}${fld('Hasta', `<input class="in num" type="date" id="ha" value="${hasta}">`, {for:'ha'})}
      <button class="btn pri" style="height:40px" type="submit">Consultar</button>
    </form>
    ${err ? nota('bad', esc(err)) : `
    <div class="figs">
      <div class="fig"><div class="k">Saldo al ${fd(desde)}</div><div class="v num">${fm(mv.totales.saldo_inicial, m)}</div></div>
      <div class="fig"><div class="k">Enviado</div><div class="v num">−${fm(mv.totales.total_enviado, m)}</div><div class="n">${plural(mv.totales.cantidad_enviadas, 'transferencia', 'transferencias')}</div></div>
      <div class="fig"><div class="k">Recibido</div><div class="v num pos">+${fm(mv.totales.total_recibido, m)}</div><div class="n">${plural(mv.totales.cantidad_recibidas, 'transferencia', 'transferencias')}</div></div>
      <div class="fig"><div class="k">Saldo al ${fd(hasta)}</div><div class="big num">${fm(mv.totales.saldo_final, m)}</div></div>
    </div>
    <div class="block">${mv.movimientos.length ? `<table>
      <thead><tr><th>Fecha</th><th>Comprobante</th><th>Contraparte</th><th>Canal</th><th>Detalle</th><th class="r">Enviado</th><th class="r">Recibido</th><th class="r">Saldo</th></tr></thead>
      <tbody>${mv.movimientos.map(t => { const out = t.direccion === 'ENVIADA'; return `<tr><td>${num(fdh(t.fecha))}</td><td class="ink2">${num(t.comprobante)}</td>
        <td><div class="who">${av(t.titular_contraparte)}<div><div>${esc(first(t.titular_contraparte))}</div><div class="xs ink2 num">${t.tipo === 'SINPE' ? tel(t.telefono_contraparte) : sh(t.iban_contraparte)}</div></div></div></td>
        <td class="ink2">${t.tipo === 'SINPE' ? 'SINPE Móvil' : 'IBAN'}</td><td class="ink2">${esc(t.detalle) || '—'}</td><td class="r num">${out ? fm(t.monto, m) : ''}</td><td class="r num pos">${out ? '' : fm(t.monto, m)}</td><td class="r b num">${fm(t.saldo_despues, m)}</td></tr>`; }).join('')}</tbody>
    </table>` : vacio('La cuenta no tuvo movimientos en este período.')}</div>
    <div class="block"><div class="bh"><h2>El dinero no se crea ni se pierde</h2><div class="act">${cons.monedas.map(x => `<span class="st ${x.conservacion === 'SE CONSERVA' ? 'ok' : 'bad'}">${x.moneda}: ${fm(x.total_inicial, x.moneda)} antes y ${fm(x.total_final, x.moneda)} después</span>`).join(' ')}</div></div>
      ${cons.cuentas.length ? `<table>
      <thead><tr><th>Cuenta</th><th>Titular</th><th class="r">Saldo inicial</th><th class="r">Enviado</th><th class="r">Recibido</th><th class="r">Saldo final</th><th>Verificación</th></tr></thead>
      <tbody>${cons.cuentas.map(x => `<tr><td class="num">${gi(x.iban)}</td><td><div class="who">${av(x.titular)}${esc(x.titular)}</div></td><td class="r num">${fm(x.saldo_inicial, x.moneda)}</td><td class="r num">${fm(x.enviado, x.moneda)}</td><td class="r num">${fm(x.recibido, x.moneda)}</td><td class="r b num">${fm(x.saldo_final, x.moneda)}</td><td>${x.verificacion === 'CUADRA' ? '<span class="st ok">Cuadra</span>' : '<span class="st bad">No cuadra</span>'}</td></tr>`).join('')}</tbody>
      <tfoot>${cons.monedas.map(x => `<tr><td>Total ${x.moneda}</td><td class="sm ink2" style="font-weight:500">${plural(x.cuentas, 'cuenta participante', 'cuentas participantes')}</td><td class="r num">${fm(x.total_inicial, x.moneda)}</td><td class="r num">${fm(x.total_enviado, x.moneda)}</td><td class="r num">${fm(x.total_recibido, x.moneda)}</td><td class="r num">${fm(x.total_final, x.moneda)}</td><td>${x.conservacion === 'SE CONSERVA' ? '<span class="st ok">Se conserva</span>' : '<span class="st bad">No se conserva</span>'}</td></tr>`).join('')}</tfoot>
    </table>` : vacio('Ninguna cuenta tuvo transferencias en este período.')}</div>`}`);
  return [html, () => {
    $('#f').onsubmit = e => { e.preventDefault(); ir(`/movimientos?iban=${$('#c').value}&desde=${$('#de').value}&hasta=${$('#ha').value}`); };
    $('#csv') && ($('#csv').onclick = () => descargarCSV(`movimientos-${iban}-${desde}-${hasta}.csv`,
      [['fecha', 'comprobante', 'canal', 'direccion', 'contraparte', 'iban_contraparte', 'telefono_contraparte', 'detalle', 'enviado', 'recibido', 'saldo'],
       ...mv.movimientos.map(t => [t.fecha, t.comprobante, t.tipo, t.direccion, t.titular_contraparte, t.iban_contraparte, t.telefono_contraparte, t.detalle, t.enviado, t.recibido, t.saldo_despues])]));
  }];
};

/* ---------- catálogos ---------- */
function modalEntidad(e) {
  abrirCapa('modal', e ? 'Editar entidad' : 'Agregar entidad', `<form class="form" id="fe">
      ${fld('Código', `<input class="in num" id="ec" maxlength="4" inputmode="numeric" placeholder="0000" ${e ? `disabled value="${e.codigo}"` : 'required'}>`, {for:'ec', hint:'4 dígitos, único.'})}
      ${fld('Nombre', `<input class="in" id="en" required value="${esc(e?.nombre)}">`, {for:'en', hint:'No puede repetirse.'})}
      <div class="s2" id="err"></div><button type="submit" hidden></button></form>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ok">Guardar</button>`,
    () => { const enviar = () => accion($('#ok'), async () => {
      if (e) await PUT('/api/entidades/' + e.id_entidad, {nombre: $('#en').value});
      else await POST('/api/entidades', {codigo: $('#ec').value, nombre: $('#en').value});
      cerrarCapa(); aviso('Entidad guardada.'); render();
    }, $('#err')); $('#ok').onclick = enviar; $('#fe').onsubmit = ev => { ev.preventDefault(); enviar(); }; });
}

R.catalogos = async () => {
  const {entidades, monedas} = await GET('/api/catalogos');
  const html = shell('catalogos', cr(['Catálogos']), title('Catálogos', 'Las cuentas guardan solo la referencia a su entidad y a su moneda.') + `
    <div class="cols c2">
      <div class="block"><div class="bh"><h2>Entidades financieras</h2><div class="act"><button class="btn s" id="add">${ic('plus')}Agregar</button></div></div><table>
        <thead><tr><th>Código</th><th>Nombre</th><th class="r">Cuentas</th><th></th></tr></thead><tbody>
        ${entidades.map(e => `<tr><td class="num ink2">${e.codigo}</td><td class="b">${esc(e.nombre)}</td><td class="r num">${e.cuentas}</td><td class="r"><button class="btn s" data-ed="${e.id_entidad}">Editar</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="block"><div class="bh"><h2>Monedas</h2></div><table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Símbolo</th><th class="r">Cuentas</th></tr></thead><tbody>
        ${monedas.map(m => `<tr><td>${cur(m.codigo)}</td><td class="b">${esc(m.descripcion)}</td><td>${esc(m.simbolo)}</td><td class="r num">${m.cuentas}</td></tr>`).join('')}
      </tbody></table><div class="bb" style="padding-top:12px">${nota('', 'Solo las cuentas en colones pueden afiliarse a SINPE Móvil.')}</div></div>
    </div>`);
  return [html, () => {
    $('#add').onclick = () => modalEntidad();
    $$('[data-ed]').forEach(b => b.onclick = () => modalEntidad(entidades.find(e => e.id_entidad === +b.dataset.ed)));
  }];
};

/* =====================================================================
   ENRUTADOR
   ===================================================================== */
const RUTAS = [
  [/^\/login$/, 'login'], [/^\/inicio$/, 'inicio'],
  [/^\/clientes$/, 'clientes'], [/^\/clientes\/(\d+)$/, 'cliente'],
  [/^\/cuentas$/, 'cuentas'], [/^\/cuentas\/nueva$/, 'cuentaNueva'], [/^\/cuentas\/(CR\w+)$/, 'cuenta'],
  [/^\/telefonos$/, 'telefonos'], [/^\/sinpe$/, 'sinpe'], [/^\/sinpe\/historial\/(\d{8})$/, 'historial'],
  [/^\/transferir$/, 'transferir'], [/^\/transferir\/iban$/, 'transferirIban'], [/^\/transferir\/confirmar$/, 'confirmar'], [/^\/transferir\/resultado$/, 'resultado'],
  [/^\/movimientos$/, 'movimientos'], [/^\/catalogos$/, 'catalogos'],
];

let turno = 0;
async function render() {
  const n = ++turno;
  cerrarCapa();
  const [ruta, query = ''] = (location.hash.slice(1) || '/inicio').split('?');
  const qs = new URLSearchParams(query);
  if (!estado.usuario && ruta !== '/login') {
    try { estado.usuario = await GET('/api/me'); } catch { return; }
  }
  const hit = RUTAS.map(([re, k]) => [ruta.match(re), k]).find(([m]) => m);
  if (!hit) return ir('/inicio');
  const [m, clave] = hit;
  if (clave === 'login') return R.login();
  if ($('#contenido')) $('#contenido').style.opacity = '.55';
  try {
    const out = await R[clave](m.slice(1).map(decodeURIComponent), qs);
    if (n !== turno || out == null) return;
    const [html, montar] = Array.isArray(out) ? out : [out, R[clave + 'Montar']];
    $('#app').innerHTML = html;
    window.scrollTo(0, 0);
    montar && montar();
  } catch (e) {
    if (n !== turno) return;
    if ($('#contenido')) { $('#contenido').style.opacity = ''; $('#contenido').innerHTML = nota('bad', esc(e.message)); }
    else aviso(e.message, true);
  }
}

// eventos globales: filas clicables, búsqueda y salir
document.addEventListener('click', e => {
  const fila = e.target.closest('tr[data-href]');
  if (fila && !e.target.closest('a,button')) ir(fila.dataset.href);
  if (e.target.closest('#salir')) POST('/api/logout').finally(() => { estado.usuario = null; ir('/login'); });
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'buscar') return;
  e.preventDefault();
  const v = $('input', e.target).value.trim(), d = v.replace(/[\s-]/g, '');
  if (/^\d{8}$/.test(d)) ir('/sinpe/historial/' + d);
  else if (/^CR\d{20}$/i.test(d)) ir('/cuentas/' + d.toUpperCase());
  else if (/^CR/i.test(d)) ir('/cuentas?q=' + encodeURIComponent(d));
  else ir('/clientes?q=' + encodeURIComponent(v));
});
window.addEventListener('hashchange', render);
render();
