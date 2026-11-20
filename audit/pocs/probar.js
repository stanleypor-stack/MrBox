/* PoC harness — MR BOX. Solo lectura sobre el repo; manda requests a localhost:5001. */
const fs = require("fs");
const S = __dirname;
const BASE = "http://localhost:5001/api";
const TOK_USER = fs.readFileSync(S + "/tok_user.txt", "utf8").trim();
const TOK_ADMIN = fs.readFileSync(S + "/tok_admin.txt", "utf8").trim();

async function pedir(metodo, ruta, { token, body } = {}) {
  const t0 = Date.now();
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: Object.assign(
      { "Content-Type": "application/json" },
      token ? { "x-auth-token": token } : {}
    ),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  return { status: r.status, ms: Date.now() - t0, body: txt };
}

function corto(s, n = 300) {
  return s.length > n ? s.slice(0, n) + " …[" + s.length + " bytes]" : s;
}

async function caso(nombre, metodo, ruta, opts) {
  try {
    const r = await pedir(metodo, ruta, opts);
    console.log(`\n### ${nombre}\n> ${metodo} ${ruta}${opts && opts.body ? "\n> body: " + corto(JSON.stringify(opts.body), 200) : ""}\n< ${r.status} (${r.ms}ms) ${corto(r.body)}`);
    return r;
  } catch (e) {
    console.log(`\n### ${nombre}\n! ERROR ${e.message}`);
    return null;
  }
}

module.exports = { pedir, caso, TOK_USER, TOK_ADMIN, corto };
if (require.main === module) {
  (async () => {
    const which = process.argv[2];
    await require(S + "/casos_" + which + ".js")();
  })().catch((e) => { console.error(e); process.exit(1); });
}
