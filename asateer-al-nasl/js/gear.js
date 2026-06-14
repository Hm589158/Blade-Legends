/* =========================================================================
   أساطير النصل — Gear & heroes (gear identity + market generation)
   A full SET is the unit of equipment, made by craftSet/makeSet from a tier
   + element. The element biases the stat spread. Heroes wear one set each.
   makeSet() is the SWAP POINT for AI generation later (sync core).
   ========================================================================= */

let _setId = 0;
function setGearIdFloor(n){ if (n > _setId) _setId = n; }
function newSetId(){ return 's' + (++_setId); }

const ENHANCE_MAX = 15;
const HERO_MAX    = 20;

// distribute a tier's stat budget into atk/def/hp, biased by element identity
function elementStats(statBase, element, randomize){
  const a = ELEMENT_AFFINITY[element] || { atk:1, def:1, hp:1 };
  const v = randomize ? (() => 0.85 + Math.random()*0.30) : (() => 1);
  return {
    atk: Math.round(statBase * 1.0 * a.atk * v()),
    def: Math.round(statBase * 0.8 * a.def * v()),
    hp:  Math.round(statBase * 5.0 * a.hp * v()),
  };
}

// === SWAP POINT: synchronous set generator (used by craft + market) ===
function makeSet(tier, element){
  const T = TIERS.find(t => t.tier === tier) || TIERS[0];
  const el = ELEMENTS.includes(element) ? element : pick(ELEMENTS);
  const pal = pick(SET_PALETTES);
  const name = pick(SET_NOUN) + ' ' + pick(SET_ADJ);
  return {
    id: newSetId(), name, element:el,
    rarity:T.rarity, rarityColor:RARITY_COLOR[T.rarity], tier:T.tier,
    baseStats: elementStats(T.statBase, el, true), level:0, colors:{ ...pal },
  };
}

// ---- crafting (materials + gold) ----
function craftCost(T){ return { gold:T.gold, mats:{ ...T.cost } }; }
async function craftSet(tier, element){
  await new Promise(r => setTimeout(r, 150));   // small forge beat
  return makeSet(tier, element);
}

// starter set each hero begins with (deterministic, element-biased)
function starterSet(i){
  const els = ['نار','ماء','هواء'];
  const el = els[i] || 'هواء';
  return {
    id:'start-'+i, name:'حُلّة المبتدئ', element: el,
    rarity:'common', rarityColor:RARITY_COLOR.common, tier:0,
    baseStats: elementStats(24, el, false), level:0,
    colors:{ ...SET_PALETTES[i % SET_PALETTES.length] },
  };
}

// ---- stat computation ----
function setStats(set){
  const m = 1 + 0.12 * (set.level || 0);
  return { atk:Math.round(set.baseStats.atk*m), def:Math.round(set.baseStats.def*m), hp:Math.round(set.baseStats.hp*m) };
}
function heroStats(hero){
  const s = setStats(hero.set);
  const hm = 1 + 0.06 * (hero.level || 0);
  return { atk:Math.round(s.atk*hm), def:Math.round(s.def*hm), hp:Math.round(s.hp*hm) };
}
function power(stats){ return stats.atk + stats.def + Math.round(stats.hp / 5); }

// ---- upgrade costs ----
function enhanceCost(set){
  const lvl = (set.level || 0) + 1;
  const type = set.tier >= 3 ? 'crystal' : 'iron';
  return { gold: 80*lvl + 40, mats: { [type]: Math.min(8, 2 + Math.floor(lvl/2)) } };
}
function heroUpgradeCost(hero){
  const lvl = (hero.level || 0) + 1;
  return { gold: 100*lvl, mats: { iron: 3 + Math.floor(lvl/2) } };
}

// gem sell-back value of a pool set
function sellGems(set){ const b = { 1:3, 2:7, 3:16, 4:32 }[set.tier] || 2; return b + (set.level || 0); }
