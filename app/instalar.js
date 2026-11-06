// Instala la base de datos ejecutando los scripts de db/ en orden.
// Entiende la directiva DELIMITER igual que MySQL Workbench o la consola mysql.
//   node instalar.js            → crea la BD (01 a 05)
//   node instalar.js --pruebas  → además ejecuta 06_pruebas.sql y muestra el resultado
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const soloComentarios = s => s.split('\n').every(l => !l.trim() || l.trim().startsWith('--'));

function dividir(sql) {
  const sentencias = [];
  let delim = ';';
  let actual = '';
  for (const linea of sql.split(/\r?\n/)) {
    const m = linea.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (m) { delim = m[1]; continue; }
    // "CALL ...;  -- comentario" → el comentario final no impide ver el delimitador
    const d = delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    actual += linea.replace(new RegExp(`^(.*${d})\\s+--.*$`), '$1') + '\n';
    const t = actual.trimEnd();
    if (t.endsWith(delim)) {
      const s = t.slice(0, -delim.length).trim();
      if (s && !soloComentarios(s)) sentencias.push(s);
      actual = '';
    }
  }
  if (actual.trim() && !soloComentarios(actual)) sentencias.push(actual.trim());
  return sentencias;
}

(async () => {
  const conPruebas = process.argv.includes('--pruebas');
  const archivos = fs.readdirSync(path.join(__dirname, 'db'))
    .filter(f => /^\d\d_.*\.sql$/.test(f))
    .filter(f => conPruebas || !f.startsWith('06'))
    .sort();

  const con = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
    dateStrings: true,
  });

  for (const f of archivos) {
    const sentencias = dividir(fs.readFileSync(path.join(__dirname, 'db', f), 'utf8'));
    process.stdout.write(`${f} (${sentencias.length} sentencias)... `);
    let ultimo;
    for (const s of sentencias) {
      try { ultimo = await con.query(s); }
      catch (e) { console.log('\n✗ Error en', f, '\n', s.slice(0, 300), '\n→', e.message); process.exit(1); }
      if (f.startsWith('06') && /^SELECT n, caso/.test(s)) {
        console.log('\n');
        console.table(ultimo[0].map(r => ({ caso: r.caso, esperado: r.esperado, obtenido: r.obtenido, resultado: r.resultado, mensaje: r.mensaje })));
      }
      if (f.startsWith('06') && /^SELECT SUM\(resultado/.test(s)) console.log('Pasan:', ultimo[0][0].pasan, '· Fallan:', ultimo[0][0].fallan);
    }
    console.log('listo');
  }
  await con.end();
  console.log('\nBase de datos juntaucr_sinpe instalada.');
})().catch(e => { console.error('No se pudo conectar a MySQL:', e.message); process.exit(1); });
