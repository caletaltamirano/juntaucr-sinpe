// JUNTAUCR · SINPE Móvil — servidor web
// La aplicación NO implementa reglas de negocio: todas las operaciones
// llaman a los procedimientos almacenados, y los errores que estos lanzan
// (SIGNAL SQLSTATE '45000') se muestran tal cual al usuario.
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'juntaucr_sinpe',
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 10,
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- utilidades ----------
const soloDigitos = s => String(s ?? '').replace(/\D/g, '');
const ibanLimpio = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];
// CALL devuelve [resultado1, resultado2, ..., OkPacket]; nos quedamos con los conjuntos de filas
const call = async (sql, params = []) => {
  const r = (await pool.query(sql, params))[0];
  return Array.isArray(r) ? r.filter(Array.isArray) : [];   // un CALL sin filas devuelve solo el OkPacket
};

// Ejecuta un procedimiento con parámetro OUT en una conexión propia
async function callOut(sql, params) {
  const con = await pool.getConnection();
  try {
    await con.query(sql, params);
    const [[r]] = await con.query('SELECT @out AS id');
    return r.id;
  } finally { con.release(); }
}

const h = fn => (req, res) => fn(req, res).catch(e => {
  if (e.http) return res.status(e.http).json({ error: e.message });
  if (e.sqlState === '45000') return res.status(422).json({ error: e.message, codigo: '45000' });
  const conocidos = {
    ER_DUP_ENTRY: 'Ese valor ya existe y no puede repetirse.',
    ER_CHECK_CONSTRAINT_VIOLATED: 'El dato no cumple una restricción de la base de datos.',
    ER_NO_REFERENCED_ROW_2: 'Uno de los datos relacionados no existe.',
    ER_ROW_IS_REFERENCED_2: 'No se puede borrar: otros registros lo usan.',
    ER_DATA_TOO_LONG: 'Uno de los datos es demasiado largo.',
    ER_TRUNCATED_WRONG_VALUE: 'Uno de los datos no tiene el formato correcto.',
  };
  if (conocidos[e.code]) return res.status(422).json({ error: conocidos[e.code], codigo: e.code });
  console.error(e);
  res.status(500).json({ error: 'Error inesperado del servidor: ' + e.message });
});

// ---------- sesión (token en memoria) ----------
const sesiones = new Map();
const leerToken = req => (req.headers.cookie || '').split(';').map(c => c.trim().split('=')).find(([k]) => k === 'sesion')?.[1];

// Entidades disponibles en la pantalla de ingreso (no requiere sesión)
app.get('/api/entidades-login', h(async (req, res) => res.json(await q('SELECT codigo, nombre FROM entidad_financiera ORDER BY nombre'))));

app.post('/api/login', h(async (req, res) => {
  const { correo, clave, entidad } = req.body || {};
  const [u] = await q(`SELECT u.id_usuario, u.correo, u.nombre, u.rol, u.id_cliente, cl.estado AS estado_cliente
      FROM usuario u LEFT JOIN cliente cl ON cl.id_cliente = u.id_cliente
     WHERE u.correo = ? AND u.clave_hash = SHA2(CONCAT(u.sal, ?), 256)`,
    [String(correo || '').trim().toLowerCase(), String(clave || '')]);
  if (!u) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  const sesion = { id_usuario: u.id_usuario, correo: u.correo, nombre: u.nombre, rol: u.rol, id_cliente: u.id_cliente };
  if (u.rol === 'CLIENTE') {
    if (u.estado_cliente !== 'ACTIVO') return res.status(403).json({ error: 'Su usuario está inactivo. Comuníquese con la administración.' });
    const [e] = await q('SELECT codigo, nombre FROM entidad_financiera WHERE codigo = ?', [String(entidad || '')]);
    if (!e) return res.status(422).json({ error: 'Elija la entidad financiera por la que desea ingresar.' });
    const [c] = await q('SELECT 1 AS x FROM v_cuentas WHERE id_cliente = ? AND codigo_entidad = ? LIMIT 1', [u.id_cliente, e.codigo]);
    if (!c) return res.status(403).json({ error: `No tiene cuentas en ${e.nombre}. Elija otra entidad.` });
    sesion.codigo_entidad = e.codigo; sesion.entidad = e.nombre;
  }
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, sesion);
  res.setHeader('Set-Cookie', `sesion=${token}; HttpOnly; SameSite=Strict; Path=/`);
  res.json(sesion);
}));
app.post('/api/logout', (req, res) => { sesiones.delete(leerToken(req)); res.setHeader('Set-Cookie', 'sesion=; Max-Age=0; Path=/'); res.json({ ok: true }); });
app.use('/api', (req, res, next) => {
  const u = sesiones.get(leerToken(req));
  if (!u) return res.status(401).json({ error: 'Sesión vencida. Ingrese de nuevo.' });
  req.usuario = u; next();
});
app.get('/api/me', (req, res) => res.json(req.usuario));

// ---------- permisos ----------
// La administración ve y opera todo. Un cliente solo opera lo suyo y dentro de la entidad por la que ingresó.
// (Las reglas de negocio siguen en MySQL; esto solo limita QUIÉN puede pedir cada operación.)
const prohibido = msg => Object.assign(new Error(msg), { http: 403 });
const soloAdmin = (req, res, next) => req.usuario.rol === 'ADMIN' ? next()
  : res.status(403).json({ error: 'Esta operación es solo para la administración.' });
const esCliente = req => req.usuario.rol === 'CLIENTE';
async function exigirCuentaPropia(req, iban) {
  if (!esCliente(req)) return;
  const [r] = await q('SELECT 1 AS x FROM v_cuentas WHERE iban = ? AND id_cliente = ? AND codigo_entidad = ?',
    [ibanLimpio(iban), req.usuario.id_cliente, req.usuario.codigo_entidad]);
  if (!r) throw prohibido('Esa cuenta no es suya o no pertenece a la entidad por la que ingresó.');
}
async function exigirTelefonoPropio(req, numero) {
  if (!esCliente(req)) return;
  const [r] = await q(`SELECT 1 AS x FROM v_telefonos_cliente v
      LEFT JOIN entidad_financiera e ON e.id_entidad = v.id_entidad_afiliada
     WHERE v.numero = ? AND v.id_cliente = ? AND (e.codigo IS NULL OR e.codigo = ?)`,
    [soloDigitos(numero), req.usuario.id_cliente, req.usuario.codigo_entidad]);
  if (!r) throw prohibido('Ese teléfono no es suyo o está afiliado en otra entidad.');
}

// Un cliente no ve el saldo de la otra parte en una transferencia (solo el de sus propias cuentas)
async function ocultarSaldosAjenos(req, filas) {
  if (!esCliente(req)) return filas;
  const mias = new Set((await q('SELECT iban FROM v_cuentas WHERE id_cliente = ?', [req.usuario.id_cliente])).map(r => r.iban));
  for (const t of filas) {
    if (!mias.has(t.iban_origen)) delete t.saldo_origen_despues;
    if (!mias.has(t.iban_destino)) delete t.saldo_destino_despues;
  }
  return filas;
}

// ---------- inicio ----------
app.get('/api/resumen', soloAdmin, h(async (req, res) => {
  const [c] = await q(`SELECT COUNT(*) total, SUM(estado='ACTIVO') activos FROM cliente`);
  const cuentas = await q(`SELECT estado, COUNT(*) n FROM cuenta GROUP BY estado`);
  const [t] = await q(`SELECT COUNT(*) total, (SELECT COUNT(*) FROM afiliacion_sinpe) afiliados FROM telefono`);
  const saldos = await q(`SELECT moneda, simbolo, SUM(saldo) total, COUNT(*) n FROM v_cuentas GROUP BY moneda, simbolo ORDER BY moneda`);
  const [hoy] = await q(`SELECT COUNT(*) n, COALESCE(SUM(monto),0) total FROM v_transferencias WHERE DATE(fecha) = CURDATE() AND moneda='CRC'`);
  const recientes = await q(`SELECT * FROM v_transferencias ORDER BY fecha DESC, id_transferencia DESC LIMIT 12`);
  // teléfonos sin afiliar y por qué
  const pendientes = await q(`
    SELECT v.numero, v.titular, v.identificacion, v.estado_cliente,
           (SELECT COUNT(*) FROM cuenta c JOIN moneda m USING (id_moneda)
             WHERE c.id_cliente = v.id_cliente AND c.estado='ACTIVA' AND m.codigo='CRC') AS cuentas_validas
      FROM v_telefonos_cliente v WHERE v.afiliado = 'NO' ORDER BY v.titular, v.numero`);
  res.json({ clientes: c, cuentas, telefonos: t, saldos, hoy, recientes, pendientes });
}));

// ---------- catálogos ----------
app.get('/api/catalogos', soloAdmin, h(async (req, res) => {
  const entidades = await q(`SELECT e.*, (SELECT COUNT(*) FROM cuenta c WHERE c.id_entidad=e.id_entidad) cuentas FROM entidad_financiera e ORDER BY e.nombre`);
  const monedas = await q(`SELECT m.*, (SELECT COUNT(*) FROM cuenta c WHERE c.id_moneda=m.id_moneda) cuentas FROM moneda m ORDER BY m.codigo`);
  res.json({ entidades, monedas });
}));
app.post('/api/entidades', soloAdmin, h(async (req, res) => {
  await call('CALL sp_registrar_entidad(?, ?)', [req.body.codigo, req.body.nombre]);
  res.json({ ok: true });
}));
app.put('/api/entidades/:codigo', soloAdmin, h(async (req, res) => {
  await call('CALL sp_renombrar_entidad(?, ?)', [req.params.codigo, req.body.nombre]);
  res.json({ ok: true });
}));

// ---------- clientes ----------
app.get('/api/clientes', soloAdmin, h(async (req, res) => {
  res.json(await q(`
    SELECT cl.*,
      (SELECT COUNT(*) FROM cuenta c WHERE c.id_cliente = cl.id_cliente) cuentas,
      (SELECT COUNT(*) FROM telefono t WHERE t.id_cliente = cl.id_cliente) telefonos,
      (SELECT COUNT(*) FROM telefono t JOIN afiliacion_sinpe a USING (id_telefono) WHERE t.id_cliente = cl.id_cliente) afiliados
    FROM cliente cl ORDER BY cl.nombre_completo`));
}));
app.post('/api/clientes', soloAdmin, h(async (req, res) => {
  const { identificacion, nombre, correo, clave } = req.body;
  const id = await callOut('CALL sp_registrar_cliente(?, ?, ?, ?, @out)', [identificacion, nombre, correo, clave]);
  res.json({ id_cliente: id });
}));
app.get('/api/clientes/:id', soloAdmin, h(async (req, res) => {
  const [cliente] = await q('SELECT * FROM cliente WHERE id_cliente = ?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'El cliente no existe.' });
  const cuentas = await q('SELECT * FROM v_cuentas WHERE id_cliente = ? ORDER BY fecha_apertura', [req.params.id]);
  const telefonos = await q('SELECT * FROM v_telefonos_cliente WHERE id_cliente = ? ORDER BY numero', [req.params.id]);
  res.json({ cliente, cuentas, telefonos });
}));
app.put('/api/clientes/:id', soloAdmin, h(async (req, res) => {
  const [c] = await q('SELECT identificacion FROM cliente WHERE id_cliente = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'El cliente no existe.' });
  const { nombre, correo, estado } = req.body;
  await call('CALL sp_actualizar_cliente(?, ?, ?, ?)', [c.identificacion, nombre, correo, estado]);
  res.json({ ok: true });
}));

// ---------- cuentas ----------
app.get('/api/cuentas', h(async (req, res) => res.json(esCliente(req)
  ? await q('SELECT * FROM v_cuentas WHERE id_cliente = ? AND codigo_entidad = ? ORDER BY fecha_apertura', [req.usuario.id_cliente, req.usuario.codigo_entidad])
  : await q('SELECT * FROM v_cuentas ORDER BY titular, fecha_apertura'))));
app.post('/api/cuentas', soloAdmin, h(async (req, res) => {
  const b = req.body;
  const id = await callOut('CALL sp_registrar_cuenta(?, ?, ?, ?, ?, ?, ?, @out)',
    [ibanLimpio(b.iban), b.identificacion, b.entidad, b.moneda, b.saldo === '' ? null : b.saldo, b.fecha || null, b.estado]);
  res.json({ id_cuenta: id });
}));
app.get('/api/cuentas/:iban', h(async (req, res) => {
  const iban = ibanLimpio(req.params.iban);
  await exigirCuentaPropia(req, iban);
  const [cuenta] = await q('SELECT * FROM v_cuentas WHERE iban = ?', [iban]);
  if (!cuenta) return res.status(404).json({ error: 'La cuenta no existe.' });
  const [telefonos] = await call('CALL sp_telefonos_por_cuenta(?)', [iban]);
  const movimientos = await ocultarSaldosAjenos(req, await q(`SELECT * FROM v_transferencias WHERE iban_origen = ? OR iban_destino = ? ORDER BY fecha DESC, id_transferencia DESC LIMIT 8`, [iban, iban]));
  const [mes] = await call("CALL sp_totales_periodo(?, DATE_FORMAT(CURDATE(), '%Y-%m-01'), CURDATE())", [iban]);
  res.json({ cuenta, telefonos, movimientos, mes: mes[0] });
}));
app.put('/api/cuentas/:iban/estado', soloAdmin, h(async (req, res) => {
  await call('CALL sp_cambiar_estado_cuenta(?, ?, ?)', [ibanLimpio(req.params.iban), req.body.estado, !!req.body.desafiliar]);
  res.json({ ok: true });
}));

// ---------- teléfonos ----------
app.get('/api/telefonos', h(async (req, res) => {
  const cli = esCliente(req);
  res.json(await q(`
    SELECT v.*, (SELECT COUNT(*) FROM historial_afiliacion h WHERE h.id_telefono = v.id_telefono) eventos,
      (SELECT COUNT(*) FROM cuenta c JOIN moneda m USING (id_moneda) JOIN entidad_financiera e USING (id_entidad)
        WHERE c.id_cliente = v.id_cliente AND c.estado='ACTIVA' AND m.codigo='CRC'${cli ? ' AND e.codigo = ?' : ''}) cuentas_validas
    FROM v_telefonos_cliente v
    ${cli ? `LEFT JOIN entidad_financiera ea ON ea.id_entidad = v.id_entidad_afiliada
      WHERE v.id_cliente = ? AND (ea.codigo IS NULL OR ea.codigo = ?)` : ''}
    ORDER BY v.titular, v.numero`, cli ? [req.usuario.codigo_entidad, req.usuario.id_cliente, req.usuario.codigo_entidad] : []));
}));
app.post('/api/telefonos', h(async (req, res) => {
  let identificacion = req.body.identificacion;
  if (esCliente(req)) [{ identificacion }] = await q('SELECT identificacion FROM cliente WHERE id_cliente = ?', [req.usuario.id_cliente]);
  const id = await callOut('CALL sp_registrar_telefono(?, ?, @out)', [soloDigitos(req.body.numero), identificacion]);
  res.json({ id_telefono: id });
}));
app.put('/api/telefonos/:numero/titular', soloAdmin, h(async (req, res) => {
  await call('CALL sp_cambiar_titular_telefono(?, ?)', [soloDigitos(req.params.numero), req.body.identificacion]);
  res.json({ ok: true });
}));

// ---------- SINPE Móvil ----------
app.post('/api/sinpe/afiliar', h(async (req, res) => {
  await exigirTelefonoPropio(req, req.body.numero); await exigirCuentaPropia(req, req.body.iban);
  await call('CALL sp_afiliar_sinpe(?, ?)', [soloDigitos(req.body.numero), ibanLimpio(req.body.iban)]);
  res.json({ ok: true });
}));
app.post('/api/sinpe/desafiliar', h(async (req, res) => {
  await exigirTelefonoPropio(req, req.body.numero);
  await call('CALL sp_desafiliar_sinpe(?)', [soloDigitos(req.body.numero)]);
  res.json({ ok: true });
}));
app.post('/api/sinpe/trasladar', h(async (req, res) => {
  await exigirTelefonoPropio(req, req.body.numero); await exigirCuentaPropia(req, req.body.iban);
  await call('CALL sp_cambiar_cuenta_sinpe(?, ?)', [soloDigitos(req.body.numero), ibanLimpio(req.body.iban)]);
  res.json({ ok: true });
}));
app.get('/api/sinpe/historial/:numero', h(async (req, res) => {
  const numero = soloDigitos(req.params.numero);
  await exigirTelefonoPropio(req, numero);
  const [telefono] = await q('SELECT * FROM v_telefonos_cliente WHERE numero = ?', [numero]);
  if (!telefono) return res.status(404).json({ error: 'El teléfono no está registrado.' });
  const [eventos] = await call('CALL sp_historial_telefono(?)', [numero]);
  res.json({ telefono, eventos });
}));

// Vista previa de una transferencia (solo lectura; la validación definitiva la hace el procedimiento)
app.get('/api/buscar/telefono/:numero', h(async (req, res) => {
  const [r] = await q(`SELECT v.numero, v.id_cliente, v.titular, v.afiliado, c.iban, c.entidad, c.moneda, c.estado, c.saldo, c.id_cuenta
    FROM v_telefonos_cliente v LEFT JOIN v_cuentas c ON c.iban = v.iban_afiliado WHERE v.numero = ?`, [soloDigitos(req.params.numero)]);
  if (r && esCliente(req) && r.id_cliente !== req.usuario.id_cliente) delete r.saldo;
  res.json(r || null);
}));
app.get('/api/buscar/iban/:iban', h(async (req, res) => {
  const [r] = await q('SELECT iban, id_cliente, titular, entidad, moneda, simbolo, estado, saldo, id_cuenta FROM v_cuentas WHERE iban = ?', [ibanLimpio(req.params.iban)]);
  if (r && esCliente(req) && r.id_cliente !== req.usuario.id_cliente) delete r.saldo;
  res.json(r || null);
}));

// ---------- transferencias ----------
app.post('/api/transferencias/sinpe', h(async (req, res) => {
  const b = req.body;
  // Con «cuenta»: el cliente elige cualquiera de sus cuentas (SINPE Móvil real); el procedimiento
  // resuelve su número afiliado. Con «origen»: se debita la cuenta afiliada a ese teléfono (enunciado 2.8).
  if (b.cuenta) await exigirCuentaPropia(req, b.cuenta); else await exigirTelefonoPropio(req, b.origen);
  const id = await callOut('CALL sp_transferir_sinpe(?, ?, ?, ?, ?, @out)',
    [b.cuenta ? null : soloDigitos(b.origen), b.cuenta ? ibanLimpio(b.cuenta) : null, soloDigitos(b.destino), b.monto, b.detalle || null]);
  const [t] = await ocultarSaldosAjenos(req, await q('SELECT * FROM v_transferencias WHERE id_transferencia = ?', [id]));
  res.json(t);
}));
app.post('/api/transferencias/iban', h(async (req, res) => {
  const b = req.body;
  await exigirCuentaPropia(req, b.origen);
  const id = await callOut('CALL sp_transferir_iban(?, ?, ?, ?, @out)', [ibanLimpio(b.origen), ibanLimpio(b.destino), b.monto, b.detalle || null]);
  const [t] = await ocultarSaldosAjenos(req, await q('SELECT * FROM v_transferencias WHERE id_transferencia = ?', [id]));
  res.json(t);
}));

// Últimas transferencias de las cuentas del cliente en su entidad (inicio del cliente)
app.get('/api/mis-movimientos', h(async (req, res) => {
  if (!esCliente(req)) throw prohibido('Solo disponible para clientes.');
  res.json(await ocultarSaldosAjenos(req, await q(`SELECT t.* FROM v_transferencias t
     WHERE t.iban_origen  IN (SELECT iban FROM v_cuentas WHERE id_cliente = ? AND codigo_entidad = ?)
        OR t.iban_destino IN (SELECT iban FROM v_cuentas WHERE id_cliente = ? AND codigo_entidad = ?)
     ORDER BY t.fecha DESC, t.id_transferencia DESC LIMIT 8`,
    [req.usuario.id_cliente, req.usuario.codigo_entidad, req.usuario.id_cliente, req.usuario.codigo_entidad])));
}));

// ---------- movimientos e informes ----------
app.get('/api/movimientos', h(async (req, res) => {
  const { iban, desde, hasta } = req.query;
  await exigirCuentaPropia(req, iban);
  const [movimientos] = await call('CALL sp_consultar_movimientos(?, ?, ?)', [ibanLimpio(iban), desde, hasta]);
  const [[totales]] = await call('CALL sp_totales_periodo(?, ?, ?)', [ibanLimpio(iban), desde, hasta]);
  res.json({ movimientos, totales });
}));
app.get('/api/conservacion', soloAdmin, h(async (req, res) => {
  const [cuentas, monedas] = await call('CALL sp_comprobar_conservacion(?, ?)', [req.query.desde, req.query.hasta]);
  res.json({ cuentas, monedas });
}));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = +(process.env.PORT || 3100);
pool.query('SELECT 1')
  .then(() => app.listen(PORT, () => console.log(`JUNTAUCR SINPE en http://localhost:${PORT}`)))
  .catch(e => { console.error('No se pudo conectar a MySQL:', e.message, '\n¿Ejecutó "npm run instalar-bd" y configuró .env?'); process.exit(1); });
