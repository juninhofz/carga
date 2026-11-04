// CARGA: Brazilian Portuguese exercise names the way a Brazilian gym says them. The catalogue's
// pt-BR names were translated word for word ("o maior alongamento do mundo", "puxada frontal com
// amplitude total no cabo"); people know these lifts by their gym names: supino reto, puxada
// frente, remada baixa, voador, stiff, tríceps pulley.
//
// Two layers, both rewriting catalogue/i18n/pt-BR.json in place (names only):
//   NAMES  the most used exercises, named by hand
//   RULES  ordered rewrites for every other name: the cable is "polia", a band is "elástico",
//          "(máquina)" goes, and so on
// Run from the repo root, then rebuild the packs: node scripts/catalogue/pt-br-gym-names.mjs
// && node scripts/catalogue/build.mjs
import fs from 'node:fs'

const FILE = 'catalogue/i18n/pt-BR.json'

export const NAMES = {
  // peito
  '0025': 'supino reto com barra', '0289': 'supino reto com halteres', '0047': 'supino inclinado com barra', '0314': 'supino inclinado com halteres',
  '0155': 'crossover', '0308': 'crucifixo com halteres', '0596': 'voador (peck deck)', '0251': 'paralelas', '0129': 'tríceps banco', '0662': 'flexão',
  // ombros
  '1162': 'desenvolvimento militar com barra', '0405': 'desenvolvimento com halteres sentado', '0426': 'desenvolvimento com halteres em pé',
  '0334': 'elevação lateral com halteres', '0178': 'elevação lateral na polia', '5607': 'face pull com elástico', '0378': 'crucifixo inverso com halteres', '0095': 'encolhimento com barra',
  // costas
  '0027': 'remada curvada com barra', '0293': 'remada curvada com halteres', '0861': 'remada baixa', '9698': 'remada com apoio no peito',
  '2330': 'puxada frente', '0150': 'puxada frente aberta', '0652': 'barra fixa', '1326': 'barra fixa supinada', '0017': 'barra fixa assistida (gravitron)',
  // braços
  '0031': 'rosca direta com barra', '0294': 'rosca direta com halteres', '0447': 'rosca direta com barra W', '0313': 'rosca martelo com halteres', '0126': 'rosca punho com barra',
  '0241': 'tríceps pulley (barra V)', '0201': 'tríceps pulley', '2188': 'tríceps francês com halter', '1504': 'tríceps testa com elástico',
  // pernas e glúteos
  '0043': 'agachamento livre com barra', '1760': 'agachamento goblet com halter', '3948': 'agachamento sem peso', '0042': 'agachamento frontal com barra',
  '0739': 'leg press 45°', '2267': 'leg press horizontal', '0046': 'agachamento hack com barra',
  '0085': 'stiff com barra', '1459': 'stiff com halteres', '0032': 'levantamento terra com barra', '0811': 'levantamento terra com trap bar',
  '1060': 'elevação pélvica com barra', '4742': 'elevação pélvica com halter', '4442': 'agachamento búlgaro assistido',
  '0336': 'afundo com halteres', '4295': 'passada com halteres', '1460': 'passada sem peso',
  '0585': 'cadeira extensora', '0586': 'mesa flexora', '0599': 'cadeira flexora',
  '0605': 'panturrilha em pé na máquina', '0417': 'panturrilha em pé com halter', '1373': 'panturrilha em pé (peso do corpo)',
  // core
  '0463': 'prancha', '0472': 'elevação de pernas na barra', '1163': 'abdominal infra', '0175': 'abdominal na polia ajoelhado', '0274': 'abdominal supra',
  '0979': 'pallof press com elástico', '0001': 'abdominal 3/4',
  // funcional, condicionamento e mobilidade
  '2133': 'farmer walk com halteres', '10438': 'pendurar na barra (alternado)', '0549': 'kettlebell swing', '1354': 'slam com medicine ball', '1699': 'arremesso rotacional com medicine ball',
  '0551': 'turkish get-up com kettlebell', '1160': 'burpee', '0685': 'corrida', '2138': 'bicicleta ergométrica (v. 3)',
  '4633': "world's greatest stretch (alongamento completo)", '8052': 'rotação torácica ajoelhado', '4580': 'gato e vaca', '4296': 'alongamento de flexor do quadril ajoelhado',
  '2411': 'extensão de pescoço na polia (com capacete)', '2412': 'flexão de pescoço na polia (com capacete)',
}

// [pattern, replacement], applied in order to every name not in NAMES.
export const RULES = [
  [/\s*\(varia[çc][ãa]o\)/g, ''],
  [/\s*\(m[áa]quina\)/g, ''],
  [/com faixa el[áa]stica/g, 'com elástico'],
  [/faixa el[áa]stica/g, 'elástico'],
  [/bola medicinal/g, 'medicine ball'],
  [/\bno cabo\b/g, 'na polia'],
  [/\bcom cabo\b/g, 'na polia'],
  [/\bpuxada frontal\b/g, 'puxada frente'],
  [/\s+com amplitude total/g, ''],
  [/\bdesenvolvimento acima da cabe[çc]a\b/g, 'desenvolvimento'],
  [/\bdesenvolvimento de ombros?\b/g, 'desenvolvimento'],
  [/\bencolhimento de ombros\b/g, 'encolhimento'],
  [/\beleva[çc][ãa]o de quadril\b/g, 'elevação pélvica'],
  [/\blevantamento terra romeno\b/g, 'stiff'],
  [/\bcaminhada do fazendeiro\b/g, 'farmer walk'],
  [/\blevantamento turco\b/g, 'turkish get-up'],
  [/\bo maior alongamento do mundo\b/g, "world's greatest stretch"],
  [/\bagachamento completo\b/g, 'agachamento livre'],
  [/\bmergulho para peitoral\b/g, 'paralelas'],
  [/\bremada sentada na polia\b/g, 'remada baixa'],
  [/\bbarra fixa pegada supinada\b/g, 'barra fixa supinada'],
  [/\b45 graus no sled\b/g, '45°'],
  [/\s+no sled\b/g, ''],
  [/\brosca de punho\b/g, 'rosca punho'],
  [/\bextens[ãa]o de tr[íi]ceps acima da cabe[çc]a\b/g, 'tríceps francês'],
  [/\bextens[ãa]o de tr[íi]ceps deitado\b/g, 'tríceps testa'],
  [/\bflex[ãa]o de bra[çc]os\b/g, 'flexão'],
  [/\babdominal no ch[ãa]o\b/g, 'abdominal supra'],
  [/\beleva[çc][ãa]o de panturrilha\b/g, 'panturrilha'],
  [/\bcrucifixo invertido\b/g, 'crucifixo inverso'],
  [/\bbarra ez\b/gi, 'barra W'],
  [/\bna m[áa]quina smith\b/gi, 'no smith'],
  [/\btr[íi]ceps pulley na polia\b/g, 'tríceps pulley'],
  [/\bcrossover na polia\b/g, 'crossover'],
  // only at the end of a name ("… em pé peso corporal"); inside one ("remada peso corporal no batente") it stays
  [/\s+(com\s+|de\s+|e\s+)?peso corporal(?=$|\s+v\.)/g, ' (peso do corpo)'],
  [/\s{2,}/g, ' '],
]

export function popularName(id, name) {
  if (NAMES[id]) return NAMES[id]
  let n = String(name || '')
  // rules match lower case; the catalogue capitalises some names and not others
  const capital = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(n) && n.slice(1) === n.slice(1).toLowerCase()
  n = n.charAt(0).toLowerCase() + n.slice(1)
  for (const [re, to] of RULES) n = n.replace(re, to)
  n = n.trim()
  return capital ? n.charAt(0).toUpperCase() + n.slice(1) : n
}

if (process.argv[1] && process.argv[1].endsWith('pt-br-gym-names.mjs')) {
  const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  let changed = 0
  for (const [id, row] of Object.entries(rows)) {
    if (!row || typeof row.name !== 'string') continue
    const next = popularName(id, row.name)
    if (next !== row.name) { row.name = next; changed++ }
  }
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2) + '\n')
  console.log(changed + ' names changed in ' + FILE)
}
