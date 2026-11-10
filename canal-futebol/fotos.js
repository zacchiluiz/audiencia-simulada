// Busca e prepara fotos para os cards.
// - Foto manual: caminho local (ex.: "fotos/neymar.jpg") ou URL.
// - Foto automática: pelo nome do jogador, na Wikipédia/Wikimedia Commons
//   (fotos com licença livre; o crédito do autor sai no card).
// As fotos baixadas ficam em fotos/cache/ para não baixar de novo.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, 'fotos');
const CACHE = path.join(PASTA, 'cache');
const UA = 'GeradorDeCards/1.0 (uso pessoal; gera cards de futebol)';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tiraHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch com novas tentativas (a Wikipédia limita pedidos muito seguidos: erro 429)
async function baixar(url) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    if (tentativa) await espera(1500 * 2 ** tentativa);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) { await espera(400); return r; }
      ultimoErro = new Error(`HTTP ${r.status}`);
      if (r.status !== 429 && r.status < 500) break;
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro;
}

async function getJson(url) {
  return (await baixar(url)).json();
}

function paraDataUri(arquivo) {
  const ext = path.extname(arquivo).toLowerCase();
  return `data:${MIME[ext] || 'image/jpeg'};base64,${fs.readFileSync(arquivo).toString('base64')}`;
}

// Procura o jogador na Wikipédia e devolve { url, arquivo, pagina, lang }.
// 1º tenta a página com o nome exato (pt e en); só depois faz busca aproximada.
// Dica: para nomes comuns, use o título exato da página, ex.: "Pedro (futebolista, 1997)".
async function procurarNaWiki(nome) {
  const props = '&prop=pageimages&piprop=thumbnail|name&pithumbsize=1280';
  const tentativas = [
    ['pt', `&titles=${encodeURIComponent(nome)}`],
    ['en', `&titles=${encodeURIComponent(nome)}`],
    ['pt', `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(nome + ' futebolista')}`],
    ['en', `&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(nome + ' footballer')}`],
  ];
  for (const [lang, consulta] of tentativas) {
    const j = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1${consulta}${props}`);
    const pag = j.query && j.query.pages && Object.values(j.query.pages)[0];
    if (pag && pag.thumbnail) return { url: pag.thumbnail.source, arquivo: pag.pageimage, pagina: pag.title, lang };
  }
  return null;
}

async function credito(arquivo, lang) {
  for (const host of ['commons.wikimedia.org', `${lang}.wikipedia.org`]) {
    try {
      const j = await getJson(`https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + arquivo)}`);
      const info = Object.values(j.query.pages)[0].imageinfo;
      if (!info) continue;
      const m = info[0].extmetadata || {};
      const autor = tiraHtml(m.Artist && m.Artist.value);
      const lic = tiraHtml(m.LicenseShortName && m.LicenseShortName.value);
      return `Foto: ${autor || 'Wikimedia Commons'}${lic ? ' / ' + lic : ''}`;
    } catch { /* tenta o próximo */ }
  }
  return 'Foto: Wikimedia Commons';
}

// Devolve { src (data URI), credito } ou null
async function fotoDoJogador(nome) {
  if (!nome) return null;
  fs.mkdirSync(CACHE, { recursive: true });
  const base = path.join(CACHE, slug(nome));
  if (fs.existsSync(base + '.json')) {
    const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    if (!meta.arquivo) return null; // já procurou e não achou
    return { src: paraDataUri(path.join(CACHE, meta.arquivo)), credito: meta.credito };
  }
  try {
    const achou = await procurarNaWiki(nome);
    if (!achou) {
      fs.writeFileSync(base + '.json', JSON.stringify({ nome, arquivo: null }));
      console.warn(`  ⚠ Sem foto encontrada para "${nome}". Coloque uma manualmente em "foto".`);
      return null;
    }
    const r = await baixar(achou.url);
    const ext = path.extname(new URL(achou.url).pathname).toLowerCase() || '.jpg';
    const arquivo = slug(nome) + ext;
    fs.writeFileSync(path.join(CACHE, arquivo), Buffer.from(await r.arrayBuffer()));
    const cred = await credito(achou.arquivo, achou.lang);
    fs.writeFileSync(base + '.json', JSON.stringify({ nome, arquivo, credito: cred, pagina: achou.pagina }, null, 2));
    console.log(`  📷 ${nome} → foto da página "${achou.pagina}" (${achou.lang}.wikipedia). Confira se é o jogador certo.`);
    return { src: paraDataUri(path.join(CACHE, arquivo)), credito: cred };
  } catch (e) {
    console.warn(`  ⚠ Não consegui buscar foto de "${nome}": ${e.message}`);
    return null;
  }
}

// foto = caminho/URL manual; jogador = nome para busca automática; creditoManual = texto opcional
async function resolverFoto(foto, jogador, creditoManual) {
  if (foto) {
    if (/^https?:/.test(foto)) return { src: foto, credito: creditoManual || '' };
    const arq = path.resolve(__dirname, foto);
    if (!fs.existsSync(arq)) { console.warn(`  ⚠ Foto não encontrada: ${foto}`); return null; }
    return { src: paraDataUri(arq), credito: creditoManual || '' };
  }
  return fotoDoJogador(jogador);
}

module.exports = { resolverFoto };
