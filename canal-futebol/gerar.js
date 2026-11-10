// Gera os cards do canal (1080x1350, formato retrato do Instagram).
// Uso:  node gerar.js            -> lê posts.json e salva PNGs em saida/
//       node gerar.js outro.json -> usa outro arquivo de posts
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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

function foto(p) {
  if (!p.foto) return '';
  const src = /^https?:/.test(p.foto) ? p.foto : 'file://' + path.resolve(dir, p.foto);
  return `<div class="foto" style="background-image:url('${src}')"></div>`;
}

const corpo = {
  mercado: (p) => `
    ${foto(p)}
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
    <h1 class="centro">${esc(p.titulo)}</h1>
    <div class="comp">
      <div class="cab"><span>${esc(p.nomeA)}</span><span></span><span>${esc(p.nomeB)}</span></div>
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
    ${foto(p)}
    <h1>${esc(p.titulo)}</h1>
    <ol class="lista">${(p.itens || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`,
  nostalgia: (p) => `
    ${foto(p)}
    <h1>${esc(p.titulo)}</h1>
    <h2>${esc(p.nome)}</h2>
    <div class="antes-hoje"><div><small>ANTES</small>${esc(p.antes)}</div><div><small>HOJE</small>${esc(p.hoje)}</div></div>`,
  enquete: (p) => `
    <h1>${esc(p.pergunta)}</h1>
    <div class="opcoes">${(p.opcoes || []).map((o, i) => `<div><span>${'ABCD'[i] || i + 1}</span>${esc(o)}</div>`).join('')}</div>
    <h2 class="centro">Vota nos comentários 👇</h2>`,
};

function html(p) {
  const ed = EDITORIAS[p.tipo];
  if (!ed) throw new Error(`Tipo desconhecido: "${p.tipo}". Use: ${Object.keys(EDITORIAS).join(', ')}`);
  const fontes = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(marca.fonteTitulo)}&family=${encodeURIComponent(marca.fonteTexto)}:wght@400;600;800&display=swap`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontes}">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1080px;height:1350px;background:${marca.fundo};color:${marca.texto};
    font-family:'${marca.fonteTexto}',Arial,sans-serif;overflow:hidden}
  .card{position:relative;width:100%;height:100%;padding:80px 72px;display:flex;flex-direction:column;gap:36px;
    background:radial-gradient(circle at 85% 0%, ${ed.cor}33 0, transparent 45%), linear-gradient(180deg, ${marca.fundo} 0%, ${marca.fundo2} 100%)}
  .card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:14px;background:${ed.cor}}
  .topo{display:flex;justify-content:space-between;align-items:center}
  .ed{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-size:40px;letter-spacing:2px;color:${marca.fundo};background:${ed.cor};padding:8px 22px}
  .sub{font-size:28px;font-weight:600;color:${marca.textoSuave};text-transform:uppercase;letter-spacing:2px}
  .conteudo{flex:1;display:flex;flex-direction:column;justify-content:center;gap:36px}
  h1{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-weight:400;font-size:96px;line-height:1.02;text-transform:uppercase}
  h2{font-size:44px;font-weight:800;line-height:1.2;color:${ed.cor}}
  .texto{font-size:36px;line-height:1.4;color:${marca.textoSuave}}
  .fonte{font-size:26px;color:${marca.textoSuave};opacity:.7}
  .centro{text-align:center}
  .foto{height:440px;border-radius:24px;background-size:cover;background-position:center top;border:4px solid ${ed.cor}}
  .selo{align-self:flex-start;font-weight:800;font-size:30px;padding:10px 22px;border-radius:999px;letter-spacing:1px}
  .selo.ok{background:#00E67622;color:#00E676;border:3px solid #00E676}
  .selo.rumor{background:#FACC1522;color:#FACC15;border:3px solid #FACC15}
  .placar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px}
  .time{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-size:64px;text-align:center;line-height:1.05}
  .gols{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-size:220px;color:${ed.cor};line-height:1}
  .gols span{font-size:100px;color:${marca.textoSuave};margin:0 20px;vertical-align:middle}
  .comp{display:flex;flex-direction:column;gap:14px}
  .cab,.lin{display:grid;grid-template-columns:1fr 1.2fr 1fr;text-align:center;align-items:center}
  .cab span{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-size:52px}
  .lin{background:#ffffff0d;border-radius:16px;padding:22px 0}
  .lin span{font-size:32px;color:${marca.textoSuave};text-transform:uppercase;font-weight:600}
  .lin b{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-weight:400;font-size:72px}
  .lin b.win{color:${ed.cor}}
  .aspas{font-family:Georgia,serif;font-size:260px;line-height:.6;color:${ed.cor};height:110px}
  .citacao{text-transform:none;font-size:80px}
  .autor{font-size:38px;font-weight:800;color:${ed.cor}}
  .lista{list-style:none;counter-reset:n;display:flex;flex-direction:column;gap:20px}
  .lista li{counter-increment:n;font-size:42px;font-weight:600;display:flex;gap:24px;align-items:center}
  .lista li::before{content:counter(n);font-family:'${marca.fonteTitulo}',Impact,sans-serif;color:${marca.fundo};background:${ed.cor};
    min-width:72px;height:72px;display:grid;place-items:center;border-radius:50%;font-size:40px}
  .antes-hoje{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .antes-hoje div{background:#ffffff0d;border-radius:20px;padding:30px;font-size:36px;line-height:1.35}
  .antes-hoje small{display:block;font-weight:800;color:${ed.cor};font-size:28px;letter-spacing:2px;margin-bottom:10px}
  .opcoes{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .opcoes div{background:#ffffff0d;border:3px solid #ffffff1a;border-radius:20px;padding:34px 28px;font-size:40px;font-weight:800;display:flex;gap:20px;align-items:center}
  .opcoes span{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-weight:400;color:${marca.fundo};background:${ed.cor};min-width:64px;height:64px;display:grid;place-items:center;border-radius:14px}
  .rodape{display:flex;justify-content:space-between;align-items:center;font-size:30px;font-weight:800}
  .rodape .nome{font-family:'${marca.fonteTitulo}',Impact,sans-serif;font-weight:400;font-size:44px;color:${marca.destaque};letter-spacing:1px}
  .rodape .arroba{color:${marca.textoSuave}}
</style></head><body>
<div class="card">
  <div class="topo"><span class="ed">${ed.nome}</span><span class="sub">${esc(p.subnicho)}</span></div>
  <div class="conteudo">${corpo[p.tipo](p)}</div>
  <div class="rodape"><span class="nome">${esc(marca.nome)}</span><span class="arroba">${esc(marca.arroba)}</span></div>
</div></body></html>`;
}

(async () => {
  const saida = path.join(dir, 'saida');
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const data = new Date().toISOString().slice(0, 10);
  for (const [i, p] of posts.entries()) {
    await page.setContent(html(p), { waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const nome = `${data}_${String(i + 1).padStart(2, '0')}_${p.tipo}.png`;
    await page.screenshot({ path: path.join(saida, nome) });
    console.log('✔', nome);
  }
  await browser.close();
})();
