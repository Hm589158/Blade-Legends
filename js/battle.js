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
