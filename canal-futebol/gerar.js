// Gera os cards do canal (1080x1350, formato retrato do Instagram).
// Uso:  node gerar.js            -> lê posts.json e salva PNGs em saida/
//       node gerar.js outro.json -> usa outro arquivo de posts
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { resolverFoto } = require('./fotos');

const dir = __dirname;
const marca = JSON.parse(fs.readFileSync(path.join(dir, 'marca.json'), 'utf8'));
const arquivoPosts = process.argv[2] || path.join(dir, 'posts.json');
const posts = JSON.parse(fs.readFileSync(arquivoPosts, 'utf8'));

// Nome e cor de cada editoria (quadro fixo do canal)
const EDITORIAS = {
  mercado:    { nome: 'MERCADO DA BOLA', cor: marca.destaque },
  resultado:  { nome: 'PLACAR',          cor: '#38BDF8' },
  comparacao: { nome: 'MANO A MANO',     cor: '#FACC15' },
  polemica:   { nome: 'TRETA',           cor: '#F43F5E' },
  lifestyle:  { nome: 'VIDA DE BOLEIRO', cor: '#C084FC' },
  nostalgia:  { nome: 'POR ONDE ANDA?',  cor: '#FB923C' },
  enquete:    { nome: 'VOCÊ DECIDE',     cor: '#2DD4BF' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bg = (f) => (f ? `style="background-image:url('${f.src}')"` : '');

// Busca todas as fotos do post antes de montar o card
async function prepararFotos(p) {
  if (p.tipo === 'comparacao') {
    p._fotoA = await resolverFoto(p.fotoA, p.jogadorA || p.nomeA);
    p._fotoB = await resolverFoto(p.fotoB, p.jogadorB || p.nomeB);
  } else if (p.tipo === 'enquete') {
    for (const o of p.opcoes || []) {
      if (o && typeof o === 'object') o._foto = await resolverFoto(o.foto, o.jogador || o.nome);
    }
  }
  if (p.foto || p.jogador) p._foto = await resolverFoto(p.foto, p.jogador, p.creditoFoto);
}

const corpo = {
  mercado: (p) => `
    <div class="selo ${p.status === 'confirmado' ? 'ok' : 'rumor'}">${p.status === 'confirmado' ? '● CONFIRMADO' : '● RUMOR'}</div>
    <h1>${esc(p.titulo)}</h1>
    <p class="texto">${esc(p.texto)}</p>
    <p class="fonte">${esc(p.fonte)}</p>`,
  resultado: (p) => `
    <div class="placar">
      <div class="time">${esc(p.timeA)}</div>
      <div class="gols">${esc(p.golsA)}<span>×</span>${esc(p.golsB)}</div>
      <div class="time">${esc(p.timeB)}</div>
    </div>
    <p class="texto centro">${esc(p.detalhe)}</p>
    <h2 class="centro">${esc(p.frase)}</h2>`,
  comparacao: (p) => `
    <div class="duelo">
      <div class="lado" ${bg(p._fotoA)}><span>${esc(p.nomeA)}</span></div>
      <div class="vs">VS</div>
      <div class="lado" ${bg(p._fotoB)}><span>${esc(p.nomeB)}</span></div>
    </div>
    <div class="comp">
      ${(p.linhas || []).map(([r, a, b]) => {
        const na = parseFloat(a), nb = parseFloat(b);
        return `<div class="lin"><b class="${na > nb ? 'win' : ''}">${esc(a)}</b><span>${esc(r)}</span><b class="${nb > na ? 'win' : ''}">${esc(b)}</b></div>`;
      }).join('')}
    </div>
    <h2 class="centro">${esc(p.pergunta)}</h2>`,
  polemica: (p) => `
    <div class="aspas">“</div>
    <h1 class="citacao">${esc(p.citacao)}</h1>
    <p class="autor">— ${esc(p.autor)}</p>
    <p class="texto">${esc(p.texto)}</p>`,
  lifestyle: (p) => `
    <h1>${esc(p.titulo)}</h1>
    <ol class="lista">${(p.itens || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`,
  nostalgia: (p) => `
    <h1>${esc(p.titulo)}</h1>
    <h2>${esc(p.nome)}</h2>
    <div class="antes-hoje"><div><small>ANTES</small>${esc(p.antes)}</div><div><small>HOJE</small>${esc(p.hoje)}</div></div>`,
  enquete: (p) => `
    <h1>${esc(p.pergunta)}</h1>
    <div class="opcoes">${(p.opcoes || []).map((o, i) => {
      const nome = typeof o === 'object' ? o.nome : o;
      const f = typeof o === 'object' ? o._foto : null;
      return `<div class="${f ? 'com-foto' : ''}">${f ? `<i ${bg(f)}></i>` : ''}<span>${'ABCD'[i] || i + 1}</span><b>${esc(nome)}</b></div>`;
    }).join('')}</div>
    <h2 class="centro">Vota nos comentários 👇</h2>`,
};

function html(p) {
  const ed = EDITORIAS[p.tipo];
  if (!ed) throw new Error(`Tipo desconhecido: "${p.tipo}". Use: ${Object.keys(EDITORIAS).join(', ')}`);
  const temFoto = !!p._foto && p.tipo !== 'comparacao';
  const creditos = [p._foto, p._fotoA, p._fotoB, ...(p.opcoes || []).map((o) => o && o._foto)]
    .filter((f) => f && f.credito).map((f) => f.credito);
  const fontes = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(marca.fonteTitulo)}&family=${encodeURIComponent(marca.fonteTexto)}:wght@400;600;800&display=swap`;
  const T = `'${marca.fonteTitulo}',Impact,sans-serif`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontes}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1080px;height:1350px;background:${marca.fundo};color:${marca.texto};
    font-family:'${marca.fonteTexto}',Arial,sans-serif;overflow:hidden}
  .card{position:relative;width:100%;height:100%;padding:80px 72px 64px;display:flex;flex-direction:column;gap:32px;
    background:radial-gradient(circle at 85% 0%, ${ed.cor}33 0, transparent 45%), linear-gradient(180deg, ${marca.fundo} 0%, ${marca.fundo2} 100%)}
  .card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:14px;background:${ed.cor};z-index:3}
  /* Foto principal: ocupa o topo inteiro e some num degradê */
  .fundo-foto{position:absolute;inset:0 0 auto 0;height:68%;background-size:cover;background-position:center 15%}
  .fundo-foto::after{content:'';position:absolute;inset:0;
    background:linear-gradient(180deg, ${marca.fundo}99 0%, transparent 22%, transparent 45%, ${marca.fundo} 100%)}
  .card.com-foto .conteudo{justify-content:flex-end}
  .card.com-foto h1{font-size:88px;text-shadow:0 4px 24px #000a}
  .topo,.conteudo,.rodape{position:relative;z-index:2}
  .topo{display:flex;justify-content:space-between;align-items:center}
  .ed{font-family:${T};font-size:40px;letter-spacing:2px;color:${marca.fundo};background:${ed.cor};padding:8px 22px}
  .sub{font-size:28px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:2px;text-shadow:0 2px 12px #000}
  .conteudo{flex:1;display:flex;flex-direction:column;justify-content:center;gap:30px}
  h1{font-family:${T};font-weight:400;font-size:96px;line-height:1.02;text-transform:uppercase}
  h2{font-size:44px;font-weight:800;line-height:1.2;color:${ed.cor}}
  .texto{font-size:34px;line-height:1.4;color:${marca.textoSuave}}
  .fonte{font-size:26px;color:${marca.textoSuave};opacity:.7}
  .centro{text-align:center}
  .selo{align-self:flex-start;font-weight:800;font-size:30px;padding:10px 22px;border-radius:999px;letter-spacing:1px;backdrop-filter:blur(6px)}
  .selo.ok{background:#00E67633;color:#00E676;border:3px solid #00E676}
  .selo.rumor{background:#FACC1533;color:#FACC15;border:3px solid #FACC15}
  .placar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px}
  .time{font-family:${T};font-size:64px;text-align:center;line-height:1.05;text-shadow:0 4px 20px #000a}
  .gols{font-family:${T};font-size:200px;color:${ed.cor};line-height:1;text-shadow:0 4px 30px #000a}
  .gols span{font-size:90px;color:${marca.textoSuave};margin:0 20px;vertical-align:middle}
  .duelo{display:grid;grid-template-columns:1fr 1fr;gap:16px;height:520px;position:relative}
  .lado{position:relative;border-radius:24px;overflow:hidden;background:#ffffff0d center 15%/cover;display:flex;align-items:flex-end;justify-content:center;padding:24px}
  .lado::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,${marca.fundo}ee 100%)}
  .lado span{position:relative;z-index:1;font-family:${T};font-size:52px;text-align:center;line-height:1}
  .vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;font-family:${T};font-size:56px;
    color:${marca.fundo};background:${ed.cor};width:112px;height:112px;border-radius:50%;display:grid;place-items:center;border:6px solid ${marca.fundo}}
  .comp{display:flex;flex-direction:column;gap:10px}
  .lin{display:grid;grid-template-columns:1fr 1.2fr 1fr;text-align:center;align-items:center;background:#ffffff0d;border-radius:14px;padding:10px 0}
  .lin span{font-size:28px;color:${marca.textoSuave};text-transform:uppercase;font-weight:600}
  .lin b{font-family:${T};font-weight:400;font-size:56px}
  .lin b.win{color:${ed.cor}}
  .aspas{font-family:Georgia,serif;font-size:240px;line-height:.6;color:${ed.cor};height:100px}
  .citacao{text-transform:none;font-size:72px}
  .card.com-foto .citacao{font-size:66px}
  .autor{font-size:36px;font-weight:800;color:${ed.cor}}
  .lista{list-style:none;counter-reset:n;display:flex;flex-direction:column;gap:18px}
  .lista li{counter-increment:n;font-size:40px;font-weight:600;display:flex;gap:24px;align-items:center}
  .lista li::before{content:counter(n);font-family:${T};color:${marca.fundo};background:${ed.cor};
    min-width:68px;height:68px;display:grid;place-items:center;border-radius:50%;font-size:38px}
  .antes-hoje{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .antes-hoje div{background:#ffffff14;border-radius:20px;padding:28px;font-size:34px;line-height:1.35;backdrop-filter:blur(6px)}
  .antes-hoje small{display:block;font-weight:800;color:${ed.cor};font-size:26px;letter-spacing:2px;margin-bottom:10px}
  .opcoes{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .opcoes div{position:relative;overflow:hidden;background:#ffffff0d;border:3px solid #ffffff1a;border-radius:20px;padding:30px 26px;font-size:38px;font-weight:800;display:flex;gap:18px;align-items:center}
  .opcoes div.com-foto{height:300px;align-items:flex-end;text-shadow:0 2px 12px #000}
  .opcoes i{position:absolute;inset:0;background:center 15%/cover}
  .opcoes i::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,${marca.fundo}f2 100%)}
  .opcoes span{position:relative;font-family:${T};font-weight:400;color:${marca.fundo};background:${ed.cor};min-width:60px;height:60px;display:grid;place-items:center;border-radius:14px;text-shadow:none}
  .opcoes div.com-foto{color:#fff}
  .opcoes div.com-foto > :not(i){position:relative}
  .rodape{display:flex;justify-content:space-between;align-items:flex-end;font-size:30px;font-weight:800;gap:24px}
  .rodape .nome{font-family:${T};font-weight:400;font-size:44px;color:${marca.destaque};letter-spacing:1px;white-space:nowrap}
  .rodape .dir{text-align:right}
  .rodape .arroba{color:${marca.textoSuave}}
  .credito{display:block;font-size:16px;font-weight:400;color:${marca.textoSuave};opacity:.75;max-width:640px;margin-top:6px}
</style></head><body>
<div class="card ${temFoto ? 'com-foto' : ''}">
  ${temFoto ? `<div class="fundo-foto" ${bg(p._foto)}></div>` : ''}
  <div class="topo"><span class="ed">${ed.nome}</span><span class="sub">${esc(p.subnicho)}</span></div>
  <div class="conteudo">${corpo[p.tipo](p)}</div>
  <div class="rodape"><span class="nome">${esc(marca.nome)}</span>
    <span class="dir"><span class="arroba">${esc(marca.arroba)}</span>${creditos.length ? `<span class="credito">${esc(creditos.join(' · '))}</span>` : ''}</span></div>
</div></body></html>`;
}

(async () => {
  const saida = path.join(dir, 'saida');
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const data = new Date().toISOString().slice(0, 10);
  for (const [i, p] of posts.entries()) {
    await prepararFotos(p);
    await page.setContent(html(p), { waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const nome = `${data}_${String(i + 1).padStart(2, '0')}_${p.tipo}.png`;
    await page.screenshot({ path: path.join(saida, nome) });
    console.log('✔', nome);
  }
  await browser.close();
})();
