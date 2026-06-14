/* =========================================================================
   أساطير النصل — Constants (redesign + element identities + relay tuning)
   Power = gear only. Heroes wear full SETS. Combat = sequential relay.
   ========================================================================= */

const ELEMENTS = ['نار', 'ماء', 'أرض', 'هواء', 'روح'];
const ELEMENT_COLORS = { 'نار':'#ff5a3c', 'ماء':'#3ba3ff', 'أرض':'#c39a52', 'هواء':'#74e0a8', 'روح':'#c77dff' };

// Strength wheel: fire>air>earth>water>fire; spirit double-edged.
const STRONG_AGAINST = { 'نار':['هواء'], 'هواء':['أرض'], 'أرض':['ماء'], 'ماء':['نار'], 'روح':['نار','ماء','أرض','هواء'] };
function elementMultiplier(attacker, defender){
  if (attacker === defender) return 1;
  if (attacker === 'روح' || defender === 'روح') return 1.5;
  if (STRONG_AGAINST[attacker] && STRONG_AGAINST[attacker].includes(defender)) return 1.5;
  if (STRONG_AGAINST[defender] && STRONG_AGAINST[defender].includes(attacker)) return 0.75;
  return 1;
}

// element identity: each element biases the stat spread of a crafted set
// (multipliers applied on top of the base atk/def/hp ratios)
const ELEMENT_AFFINITY = {
  'نار':  { atk:1.40, def:0.80, hp:0.85 },  // attack
  'ماء':  { atk:0.85, def:1.00, hp:1.30 },  // hearts (hp)
  'أرض':  { atk:0.85, def:1.60, hp:0.95 },  // defense
  'هواء': { atk:1.20, def:0.95, hp:0.95 },  // agile attack
  'روح':  { atk:1.10, def:1.15, hp:1.10 },  // balanced, all-around
};
const ELEMENT_TRAIT = {
  'نار':'هجوم مرتفع 🔥', 'ماء':'قلوب وفيرة 💧', 'أرض':'دفاع صلب 🪨',
  'هواء':'هجوم رشيق 🌪️', 'روح':'متوازن قوي ✦',
};

// rarity meta
const RARITY_COLOR = { common:'#9aa0b5', rare:'#45a6ff', epic:'#c77dff', legendary:'#f5c542' };
const RARITY_NAME  = { common:'عادي',   rare:'نادر',   epic:'ملحمي',  legendary:'أسطوري' };
const RARITY_GLOW  = { common:0.15,     rare:0.40,     epic:0.70,     legendary:1.00 };

// crafting materials (gathered from dungeons)
const MATERIALS = {
  iron:    { key:'iron',    nameAr:'حديد',  icon:'⛓️', color:'#9aa0b5' },
  crystal: { key:'crystal', nameAr:'بلّورة', icon:'🔷', color:'#45a6ff' },
  essence: { key:'essence', nameAr:'جوهر',  icon:'💠', color:'#c77dff' },
};
const MATERIAL_ORDER = ['iron','crystal','essence'];

// crafting tiers: cost (gold + materials) -> a full set of this rarity/power
const TIERS = [
  { tier:1, nameAr:'برونزي', rarity:'common',    statBase:18, gold:120,  cost:{ iron:5 } },
  { tier:2, nameAr:'فضّي',   rarity:'rare',      statBase:30, gold:300,  cost:{ iron:8, crystal:2 } },
  { tier:3, nameAr:'ذهبي',   rarity:'epic',      statBase:48, gold:700,  cost:{ crystal:6, essence:1 } },
  { tier:4, nameAr:'مقدّس',  rarity:'legendary', statBase:74, gold:1500, cost:{ crystal:10, essence:4 } },
];

// set naming + look palettes
const SET_NOUN = ['درع', 'زِرد', 'حُلّة', 'عُدّة'];
const SET_ADJ  = ['التنين','اللهب الأبدي','الجليد الأزلي','العاصفة','الظلال','الفجر الدامي','الهاوية','النور المقدس','الرمال السبع','الرعد'];
const SET_PALETTES = [
  { primary:'#c79a3a', secondary:'#7a5cff', accent:'#ffe8a3' },
  { primary:'#b0202e', secondary:'#2a0d14', accent:'#ff6a3c' },
  { primary:'#2f7fd6', secondary:'#0e2747', accent:'#7fd3ff' },
  { primary:'#4caf6a', secondary:'#1f3d29', accent:'#c6ff9e' },
  { primary:'#7d8cff', secondary:'#2b2350', accent:'#e3e0ff' },
  { primary:'#6a4fa3', secondary:'#140f24', accent:'#b78bff' },
];

// dungeon enemy palette by element
const ENEMY_PAL = {
  'نار':{ primary:'#b0202e', secondary:'#2a0d14', accent:'#ff6a3c' },
  'ماء':{ primary:'#2f7fd6', secondary:'#0e2747', accent:'#7fd3ff' },
  'أرض':{ primary:'#8a6a3a', secondary:'#2c1f12', accent:'#d8b06a' },
  'هواء':{ primary:'#5fae8a', secondary:'#143028', accent:'#9be7c4' },
  'روح':{ primary:'#6a4fa3', secondary:'#140f24', accent:'#b78bff' },
};

// dungeons: progressive difficulty (re-ordered + tuned for sequential RELAY combat).
// Harder => more gold + rarer/more material. Spirit dungeons saved for later.
const DUNGEONS = [
  { id:1, nameAr:'كهف الجرذان',     element:'أرض',  power:60,   enemy:{ name:'جرذ ضخم',      hp:200,  atk:30,  def:12 }, gold:[60,110],     mat:{ type:'iron',    amt:[3,5] } },
  { id:2, nameAr:'كهوف الجليد',     element:'ماء',  power:180,  enemy:{ name:'عملاق ثلجي',    hp:380,  atk:46,  def:24 }, gold:[130,200],    mat:{ type:'iron',    amt:[5,8] } },
  { id:3, nameAr:'مرتفعات العاصفة', element:'هواء', power:380,  enemy:{ name:'سيّد الرعد',     hp:650,  atk:64,  def:36 }, gold:[240,340],    mat:{ type:'crystal', amt:[3,5] } },
  { id:4, nameAr:'غابة الأشباح',    element:'روح',  power:650,  enemy:{ name:'شبح الغاب',     hp:1000, atk:86,  def:44 }, gold:[420,580],    mat:{ type:'crystal', amt:[5,9] } },
  { id:5, nameAr:'فوهة البركان',    element:'نار',  power:1000, enemy:{ name:'تنين الجمر',     hp:1500, atk:114, def:58 }, gold:[680,920],    mat:{ type:'essence', amt:[2,4] } },
  { id:6, nameAr:'عرش الهاوية',     element:'روح',  power:1500, enemy:{ name:'طاغية الهاوية',  hp:2300, atk:152, def:74 }, gold:[1100,1550],  mat:{ type:'essence', amt:[4,7] } },
];

/* generic helpers */
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const randInt = (a,b) => Math.floor(a + Math.random()*(b-a+1));

/* =========================================================================
   MARKET — gem economy (gems only, no gold). Tuned to be "harder".
   ========================================================================= */
const GEM_PRICE         = { 1:8, 2:20, 3:45, 4:90 };  // gem cost of a set, by tier
const MARKET_OFFER_TIERS = [1, 1, 2, 2, 3, 4];        // composition of the 6 daily offers
const MARKET_REROLL_COST = 6;                          // gems for a manual restock
const FEATURED_GEM_RANGE = [70, 110];                  // featured legendary gem cost
// materials / gold  ->  gems exchange counter
const EXCHANGE = [
  { id:'ex_iron',    give:{ iron:12 },   gem:2 },
  { id:'ex_crystal', give:{ crystal:6 }, gem:4 },
  { id:'ex_essence', give:{ essence:2 }, gem:6 },
  { id:'ex_gold',    give:{ gold:1200 }, gem:3 },
];
