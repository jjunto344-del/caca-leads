// Caça-Leads — busca empresas sem site no Google Maps (Google Places API New)
// Sem dependências: requer Node 18+. Rode: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const PORT = Number(process.env.PORT) || 3333;

// --- .env simples ---------------------------------------------------------
try {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

// --- Classificação do site ------------------------------------------------
// Domínios que NÃO são um site próprio → ainda é oportunidade de venda
const NOT_A_REAL_SITE = [
  'instagram.com', 'facebook.com', 'fb.com', 'm.facebook.com', 'linktr.ee', 'linktree.com',
  'wa.me', 'whatsapp.com', 'api.whatsapp.com', 'tiktok.com', 'youtube.com', 'linkedin.com',
  'twitter.com', 'x.com', 'business.site', 'sites.google.com', 'g.page', 'goo.gl', 'maps.app.goo.gl',
  'ifood.com.br', 'doctoralia.com.br', 'booksy.com', 'beacons.ai', 'bio.link', 'linkbio.co',
  'taplink.cc', 'msha.ke', 'carrd.co', 'wixsite.com', 'blogspot.com', 'wordpress.com',
  'mercadolivre.com.br', 'shopee.com.br', 'olx.com.br', 'anota.ai', 'goomer.app', 'cardapioweb.com',
];

function classifySite(url) {
  if (!url) return { status: 'sem_site', host: '' };
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return { status: 'sem_site', host: '' }; }
  const weak = NOT_A_REAL_SITE.some(d => host === d || host.endsWith('.' + d));
  return { status: weak ? 'site_fraco' : 'tem_site', host };
}

function phoneInfo(intl, national) {
  const digits = (intl || '').replace(/\D/g, '');
  // Brasil: 55 + DDD(2) + 9 dígitos = celular
  const isMobileBR = digits.startsWith('55') && digits.length === 13 && digits[4] === '9';
  return { digits, mobile: isMobileBR, display: national || intl || '' };
}

function normalizePlace(p, query) {
  const site = classifySite(p.websiteUri);
  const phone = phoneInfo(p.internationalPhoneNumber, p.nationalPhoneNumber);
  return {
    id: p.id,
    nome: p.displayName?.text || '(sem nome)',
    categoria: p.primaryTypeDisplayName?.text || '',
    endereco: p.formattedAddress || '',
    telefone: phone.display,
    telefoneDigits: phone.digits,
    celular: phone.mobile,
    site: p.websiteUri || '',
    siteHost: site.host,
    siteStatus: site.status,
    nota: p.rating ?? null,
    avaliacoes: p.userRatingCount ?? 0,
    mapsUrl: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    funcionando: p.businessStatus || 'OPERATIONAL',
    busca: query,
  };
}

// --- Google Places API (New) — Text Search -------------------------------
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
  'places.internationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri', 'places.rating',
  'places.userRatingCount', 'places.primaryTypeDisplayName', 'places.businessStatus', 'nextPageToken',
].join(',');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchPlaces(query, apiKey, maxPages = 3) {
  const out = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const body = { textQuery: query, pageSize: 20, languageCode: 'pt-BR', regionCode: 'BR' };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Google Places: ${msg}`);
    }
    for (const p of json.places || []) out.push(normalizePlace(p, query));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
    await sleep(400);
  }
  return out;
}

// --- Modo demonstração (dados fictícios) ---------------------------------
function demoPlaces(query) {
  const [cat = 'Empresa'] = query.split(' em ');
  const ruas = ['Rua das Flores', 'Av. Brasil', 'Rua XV de Novembro', 'Rua São José', 'Av. Paulista', 'Rua Sete de Setembro'];
  const sufixos = ['Central', 'do Bairro', 'Premium', 'Família', 'Express', 'Silva', 'Souza', 'Bom Preço', 'Estrela', 'Nova Era', 'Real', 'Prime'];
  const sites = ['', '', '', '', 'https://instagram.com/demo', 'https://www.exemplo-empresa.com.br', '', 'https://linktr.ee/demo', ''];
  const n = 14 + Math.floor(Math.random() * 10);
  return Array.from({ length: n }, (_, i) => {
    const cel = Math.random() > 0.35;
    const num = cel ? `(11) 9${rand(4)}-${rand(4)}` : `(11) 3${rand(3)}-${rand(4)}`;
    return normalizePlace({
      id: 'demo_' + Math.random().toString(36).slice(2, 10),
      displayName: { text: `${cap(cat)} ${sufixos[i % sufixos.length]} [DEMO]` },
      primaryTypeDisplayName: { text: cap(cat) },
      formattedAddress: `${ruas[i % ruas.length]}, ${100 + i * 7} - Exemplo, SP`,
      nationalPhoneNumber: Math.random() > 0.1 ? num : undefined,
      internationalPhoneNumber: `+55 ${num.replace(/[()]/g, '')}`,
      websiteUri: sites[Math.floor(Math.random() * sites.length)] || undefined,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      userRatingCount: Math.floor(Math.random() * 300),
      googleMapsUri: 'https://www.google.com/maps',
    }, query);
  });
  function rand(k) { return Array.from({ length: k }, () => Math.floor(Math.random() * 10)).join(''); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
}

// --- Persistência dos leads salvos ---------------------------------------
function readLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); } catch { return []; }
}
function writeLeads(leads) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

// --- HTTP ----------------------------------------------------------------
function send(res, code, data, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'index.html')), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return send(res, 200, { hasServerKey: Boolean(process.env.GOOGLE_MAPS_API_KEY) });
    }
    if (req.method === 'POST' && url.pathname === '/api/search') {
      const { query, apiKey, demo, maxPages } = await readBody(req);
      if (!query) return send(res, 400, { error: 'Informe a busca.' });
      if (demo) { await sleep(250); return send(res, 200, { results: demoPlaces(query) }); }
      const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;
      if (!key) return send(res, 400, { error: 'Nenhuma chave da API configurada. Coloque no campo "Chave da API" ou no arquivo .env.' });
      const results = await searchPlaces(query, key, Math.min(Number(maxPages) || 3, 3));
      return send(res, 200, { results });
    }
    if (req.method === 'GET' && url.pathname === '/api/leads') {
      return send(res, 200, { leads: readLeads() });
    }
    if (req.method === 'POST' && url.pathname === '/api/leads') {
      // adiciona/mescla leads (por id)
      const { leads = [] } = await readBody(req);
      const current = readLeads();
      const byId = new Map(current.map(l => [l.id, l]));
      let added = 0;
      for (const l of leads) {
        if (byId.has(l.id)) continue;
        byId.set(l.id, { ...l, status: 'novo', notas: '', salvoEm: new Date().toISOString() });
        added++;
      }
      const all = [...byId.values()];
      writeLeads(all);
      return send(res, 200, { added, total: all.length });
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/leads/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/leads/'.length));
      const patch = await readBody(req);
      const leads = readLeads();
      const lead = leads.find(l => l.id === id);
      if (!lead) return send(res, 404, { error: 'Lead não encontrado' });
      for (const k of ['status', 'notas']) if (k in patch) lead[k] = patch[k];
      lead.atualizadoEm = new Date().toISOString();
      writeLeads(leads);
      return send(res, 200, { lead });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/leads/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/leads/'.length));
      writeLeads(readLeads().filter(l => l.id !== id));
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'Não encontrado' });
  } catch (err) {
    send(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Caça-Leads rodando em http://localhost:${PORT}\n`);
  if (!process.env.GOOGLE_MAPS_API_KEY) console.log('  (Sem GOOGLE_MAPS_API_KEY no .env — informe a chave na tela ou use o modo demonstração)\n');
});
