/* =========================================================================
   أساطير النصل — Battle math (redesign)
   Pure combat math, no DOM. One hit = attacker stats vs defender stats,
   modulated by the element wheel. Used for both heroes and dungeon enemies.
   ========================================================================= */
function rollVariance(){ return 0.85 + Math.random()*0.30; }

function computeDamage(atk, def, atkEl, defEl){
  const raw  = Math.max(1, atk - def * 0.5);
  const mult = elementMultiplier(atkEl, defEl);
  const dmg  = Math.max(1, Math.round(raw * mult * rollVariance()));
  return { dmg, mult };
}

/* =========================================================================
   DUNGEON 2.0 — encounter builder (waves + boss) and loot roll. Pure data.
   ========================================================================= */
function scaleEnemy(hp, atk, def, m){
  return { hp:Math.round(hp*m), maxHp:Math.round(hp*m), atk:Math.round(atk*m), def:Math.round(def*m) };
}
// returns an ordered list of encounters: a few weaker minions, then the boss.
function buildEncounters(d, statMul){
  const stages  = d.id <= 3 ? 3 : 4;     // total encounters incl. boss
  const minions = stages - 1;
  const e = d.enemy, list = [];
  for (let k = 1; k <= minions; k++){
    const el = pick(ELEMENTS);
    const f  = 0.32 + 0.10 * k;          // minion power vs the boss base
    const s  = scaleEnemy(e.hp * f, e.atk * 0.7, e.def * 0.7, statMul);
    list.push({ name: pick(MINION_NAMES[el] || ['تابع']), element: el, isBoss:false,
      hp:s.hp, maxHp:s.maxHp, atk:s.atk, def:s.def, colors:{ ...ENEMY_PAL[el] } });
  }
  const b = scaleEnemy(e.hp * 1.1, e.atk, e.def, statMul);
  list.push({ name: e.name, element: d.element, isBoss:true,
    hp:b.hp, maxHp:b.maxHp, atk:b.atk, def:b.def, colors:{ ...ENEMY_PAL[d.element] } });
  return list;
}
// base rewards (scaled by difficulty) + a chance-based bonus line
function rollLoot(d, diffObj){
  const r = diffObj.rewardMul, out = [];
  const gold = Math.round(randInt(d.gold[0], d.gold[1]) * r);
  const amt  = Math.max(1, Math.round(randInt(d.mat.amt[0], d.mat.amt[1]) * r));
  out.push({ kind:'gold', amt:gold });
  out.push({ kind:'mat', mat:d.mat.type, amt:amt });
  if (Math.random() < 0.40 + diffObj.id * 0.15){
    const roll = Math.random();
    if (roll < 0.45)      out.push({ kind:'gold', amt:Math.max(1, Math.round(gold * 0.5)), bonus:true });
    else if (roll < 0.80) out.push({ kind:'mat', mat:d.mat.type, amt:Math.max(1, Math.round(amt * 0.6)), bonus:true });
    else                  out.push({ kind:'gems', amt:randInt(1, 2 + diffObj.id), bonus:true });
  }
  return out;
}
