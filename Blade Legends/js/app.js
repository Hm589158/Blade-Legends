/* =========================================================================
   أساطير النصل — Vue app / spine
   Relay combat + element identity + a gem-driven MARKET.
   Power = gear only.
   ========================================================================= */
const { createApp, reactive, computed, ref, onMounted, nextTick, watch } = Vue;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

createApp({
  setup(){
    const state = reactive({
      tab:'dungeons',
      player:{ gold:600, gems:10 },
      materials:{ iron:8, crystal:0, essence:0 },
      heroes:[
        { id:'h0', level:0, set: starterSet(0) },
        { id:'h1', level:0, set: starterSet(1) },
        { id:'h2', level:0, set: starterSet(2) },
      ],
      sets:[],
      clearedMax:0,
      dungeonStars:{},                 // best stars per "<id>-<diff>"

      /* combat (relay) */
      combat:{ active:false, auto:false, dungeonId:null, diff:0, affixes:[],
               waves:[], wave:0, enemy:null, hp:[], idx:0, fell:0, enraged:false,
               turn:'idle', busy:false, result:null, reward:null },
      preview:{ open:false, dungeon:null, diff:0 },
      log:[], floaters:[],

      /* craft / swap UI */
      craftTier:1, craftElement:'نار', craftResult:null, swapIdx:null,

      /* market */
      market:{ day:'', featured:null, offers:[] },
      marketTab:'shop', buyTarget:null,

      /* settings / promo */
      settingsOpen:false, promoInput:'', promoMsg:'', promoOk:false, redeemed:[],

      settings:{ sound:true },
    });

    const tabs = [
      { key:'dungeons', label:'الزنزانات', icon:'🗺️' },
      { key:'party',    label:'الفريق',    icon:'🛡️' },
      { key:'craft',    label:'التصنيع',   icon:'⚒️' },
      { key:'market',   label:'السوق',     icon:'🏪' },
    ];
    const dungeons = DUNGEONS;
    const tiers = TIERS;
    const elements = ELEMENTS;
    const exchanges = EXCHANGE;
    const rerollCost = MARKET_REROLL_COST;

    /* ---------- helpers ---------- */
    const elementColor = (el) => ELEMENT_COLORS[el];
    const elementTrait = (el) => ELEMENT_TRAIT[el] || '';
    const matIcon = (t) => MATERIALS[t] ? MATERIALS[t].icon : '';
    const matName = (t) => MATERIALS[t] ? MATERIALS[t].nameAr : '';
    const pct = (cur, max) => Math.max(0, Math.min(100, max ? (cur/max)*100 : 0)) + '%';
    function costLabel(cost){
      let s = '🪙' + cost.gold;
      for (const k in (cost.mats||{})) s += '  ' + matIcon(k) + cost.mats[k];
      return s;
    }
    function hasMats(cost){
      if (state.player.gold < (cost.gold||0)) return false;
      for (const k in (cost.mats||{})) if ((state.materials[k]||0) < cost.mats[k]) return false;
      return true;
    }
    function payMats(cost){
      state.player.gold -= (cost.gold||0);
      for (const k in (cost.mats||{})) state.materials[k] = (state.materials[k]||0) - cost.mats[k];
    }
    function pushLog(m){ state.log.push(m); if (state.log.length > 30) state.log.shift(); }
    const lastLog = computed(() => state.log.slice(-3));
    function setDot(h){
      const c = h.set ? h.set.colors : { primary:'#555', accent:'#888', secondary:'#222' };
      return 'radial-gradient(circle at 50% 35%,' + c.accent + ',' + c.primary + ' 60%,' + c.secondary + ')';
    }
    function setBg(s){
      const c = s.colors || { primary:'#555', accent:'#888', secondary:'#222' };
      return 'radial-gradient(circle at 50% 35%,' + c.accent + ',' + c.primary + ' 60%,' + c.secondary + ')';
    }

    let _fid = 0;
    function spawnFloater(side, text, color){
      const id = ++_fid;
      state.floaters.push({ id, side, text, color });
      setTimeout(() => { state.floaters = state.floaters.filter(f => f.id !== id); }, 850);
    }
    function floaterStyle(f){
      if (f.side === 'foe') return { right:'14%', top:'16%', color:f.color };
      return { left:'22%', top:'24%', color:f.color };   // 'hero' (lead)
    }

    /* ---------- audio ---------- */
    function sfx(name){ if (state.settings.sound) Sfx.play(name); }
    function toggleSound(){ state.settings.sound = !state.settings.sound; if (state.settings.sound) Sfx.resume(); }

    /* ---------- heroes (display + stats) ---------- */
    const hs = (i) => heroStats(state.heroes[i]);
    const heroPower = (i) => power(hs(i));
    const heroMax = (i) => hs(i).hp;
    const heroName = (h) => h.set ? h.set.name : 'بطل بلا عتاد';
    const heroEl = (h) => h.set ? h.set.element : '—';
    const setColor = (h) => h.set ? h.set.rarityColor : '#9aa0b5';
    const rarityName = (h) => h.set ? RARITY_NAME[h.set.rarity] : '';
    // weapon silhouette by element: fire=sword, water=spear, earth=axe, air=scimitar, spirit=staff
    const WEAPON_BY_ELEMENT = { 'نار':'w-sword', 'ماء':'w-spear', 'أرض':'w-axe', 'هواء':'w-scim', 'روح':'w-staff' };
    const weaponClass = (h) => WEAPON_BY_ELEMENT[h && h.set ? h.set.element : 'نار'] || 'w-sword';
    function heroVars(h){
      const c = h.set ? h.set.colors : { primary:'#555', secondary:'#222', accent:'#888' };
      const glow = h.set ? (RARITY_GLOW[h.set.rarity] || 0.2) : 0.2;
      const el = h.set ? h.set.element : 'هواء';
      const rank = h.level || 0;                     // hero rank 0..20  -> CHARGES the aura
      const lvl  = h.set ? (h.set.level || 0) : 0;   // gear enhance 0..15 -> armor spikes + shine
      const charge = Math.min(1, rank / 20);
      const g = 3 + rank * 1.5;                       // glow radius scales with hero rank
      return {
        '--helmet':c.accent, '--helmet-acc':c.primary,
        '--chest':c.primary, '--chest-sec':c.secondary, '--chest-acc':c.accent,
        '--weapon':c.secondary, '--weapon-acc':c.accent,
        '--glow-h':(4+glow*20)+'px', '--glow-c':(4+glow*20)+'px', '--glow-w':(4+glow*24)+'px',
        '--aura-col':c.accent, '--el-col':ELEMENT_COLORS[el],
        /* ---- dynamic neon system (see css/11-neon.css) ---- */
        '--neon-col':ELEMENT_COLORS[el],
        '--charge':charge.toFixed(3),                              // 0..1 from hero rank
        '--neon-g':g.toFixed(1)+'px',
        '--neon-g2':(g*1.7).toFixed(1)+'px',
        '--neon-dur':Math.max(0.8, 2.6 - rank*0.09).toFixed(2)+'s',
        '--shine-dur':Math.max(2.2, 6 - lvl*0.25).toFixed(2)+'s',  // armor gleam speed from enhance
      };
    }
    // tier -> aura TYPE (shape) · hero rank -> aura CHARGE band · gear enhance -> armor spikes + shine
    function neonClass(h){
      const set = h.set || {};
      const tier = set.tier || 0;
      const lvl  = set.level || 0;
      const rank = h.level || 0;
      const rk = rank >= 15 ? 3 : rank >= 10 ? 2 : rank >= 5 ? 1 : 0;
      const sp = lvl <= 0 ? 0 : Math.min(5, Math.ceil(lvl / 3));
      return 'neon ty-' + tier + ' rk-' + rk + ' sp-' + sp + (lvl > 0 ? ' shine' : '');
    }
    const partyPower = computed(() => state.heroes.reduce((s, h, i) => s + heroPower(i), 0));
    const activeHero = computed(() => state.heroes[state.combat.idx] || state.heroes[0]);
    const isActive = (i) => i === state.combat.idx;
    // place the trio in a staggered line: front = active (rank 0), reserves behind; fallen are hidden
    function fighterStyle(i){
      const cb = state.combat;
      if (cb.hp[i] <= 0) return { display:'none' };
      const r = Math.max(0, i - cb.idx);
      const S = [0.72, 0.56, 0.45], X = [30, -26, -70], Y = [0, -22, -40], O = [1, 0.8, 0.62];
      const s = S[r] != null ? S[r] : 0.42;
      const x = X[r] != null ? X[r] : -96;
      const y = Y[r] != null ? Y[r] : -52;
      const o = O[r] != null ? O[r] : 0.5;
      return {
        transform: 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')',
        opacity: o, zIndex: String(20 - r), transformOrigin: 'bottom center',
      };
    }

    const enemyVars = computed(() => {
      const e = state.combat.enemy;
      if (!e) return {};
      return { '--m-primary':e.colors.primary, '--m-sec':e.colors.secondary,
               '--m-acc':e.colors.accent, '--m-el':ELEMENT_COLORS[e.element] };
    });

    /* ---------- party: upgrades + swap ---------- */
    const canEnhance = (h) => h.set && h.set.level < ENHANCE_MAX && hasMats(enhanceCost(h.set));
    const enhanceLabel = (h) => (h.set && h.set.level >= ENHANCE_MAX) ? 'أقصى' : costLabel(enhanceCost(h.set));
    function enhanceHeroSet(i){
      const set = state.heroes[i].set;
      if (!set || set.level >= ENHANCE_MAX) return;
      const cost = enhanceCost(set);
      if (!hasMats(cost)) return;
      payMats(cost);
      set.level = (set.level || 0) + 1;
      sfx('forge');
      nextTick(() => fxHero(i));
    }
    const canUpgradeHero = (h) => h.level < HERO_MAX && hasMats(heroUpgradeCost(h));
    const heroUpLabel = (h) => h.level >= HERO_MAX ? 'أقصى' : costLabel(heroUpgradeCost(h));
    function upgradeHero(i){
      const h = state.heroes[i];
      if (h.level >= HERO_MAX) return;
      const cost = heroUpgradeCost(h);
      if (!hasMats(cost)) return;
      payMats(cost);
      h.level += 1;
      sfx('forge');
      nextTick(() => fxHero(i));
    }
    function openSwap(i){ state.swapIdx = i; }
    function closeSwap(){ state.swapIdx = null; }
    function equipFromSwap(set){
      const i = state.swapIdx;
      if (i == null) return;
      const idx = state.sets.findIndex(x => x.id === set.id);
      if (idx < 0) return;
      const s = state.sets.splice(idx, 1)[0];
      const prev = state.heroes[i].set;
      state.heroes[i].set = s;
      if (prev) state.sets.push(prev);
      state.swapIdx = null;
      nextTick(() => fxHero(i));
    }

    /* ---------- craft ---------- */
    const tierObj = computed(() => TIERS.find(t => t.tier === state.craftTier) || TIERS[0]);
    const craftCostObj = computed(() => craftCost(tierObj.value));
    const canCraft = computed(() => hasMats(craftCostObj.value));
    async function doCraft(){
      if (!hasMats(craftCostObj.value)) return;
      payMats(craftCostObj.value);
      const s = await craftSet(state.craftTier, state.craftElement);
      state.sets.unshift(s);
      state.craftResult = s;
      sfx('crit');
    }

    /* ---------- MARKET ---------- */
    function todayStr(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
    function rollMarket(){
      state.market.day = todayStr();
      state.market.featured = Object.assign(makeSet(4, pick(ELEMENTS)), { gemCost: randInt(FEATURED_GEM_RANGE[0], FEATURED_GEM_RANGE[1]), sold:false });
      state.market.offers = MARKET_OFFER_TIERS.map(t => Object.assign(makeSet(t, pick(ELEMENTS)), { gemCost: GEM_PRICE[t] || 12, sold:false }));
    }
    function ensureMarket(){ if (state.market.day !== todayStr() || !Array.isArray(state.market.offers) || state.market.offers.length === 0) rollMarket(); }
    function rerollMarket(){ if (state.player.gems < MARKET_REROLL_COST) return; state.player.gems -= MARKET_REROLL_COST; rollMarket(); sfx('hit'); }
    function openBuy(o){ if (!o || o.sold) return; state.buyTarget = o; }
    function closeBuy(){ state.buyTarget = null; }
    function confirmBuy(){
      const o = state.buyTarget;
      if (!o || o.sold){ closeBuy(); return; }
      if (state.player.gems < o.gemCost) return;
      state.player.gems -= o.gemCost;
      o.sold = true;
      const set = JSON.parse(JSON.stringify(o));
      delete set.gemCost; delete set.sold;
      set.id = newSetId();
      state.sets.unshift(set);
      sfx('crit');
      closeBuy();
    }
    function canExchange(ex){
      for (const k in ex.give){ const have = (k === 'gold') ? state.player.gold : (state.materials[k] || 0); if (have < ex.give[k]) return false; }
      return true;
    }
    function doExchange(ex){
      if (!canExchange(ex)) return;
      for (const k in ex.give){ if (k === 'gold') state.player.gold -= ex.give[k]; else state.materials[k] -= ex.give[k]; }
      state.player.gems += ex.gem;
      sfx('forge');
    }
    function exGive(ex){ const k = Object.keys(ex.give)[0]; return (k === 'gold' ? '🪙' : matIcon(k)) + ' ' + ex.give[k]; }
    function sellSet(set){
      const idx = state.sets.findIndex(x => x.id === set.id);
      if (idx < 0) return;
      state.player.gems += sellGems(set);
      state.sets.splice(idx, 1);
      sfx('hit');
    }

    /* ---------- settings + promo codes ---------- */
    function openSettings(){ state.settingsOpen = true; }
    function closeSettings(){ state.settingsOpen = false; state.promoMsg = ''; }
    function rewardSummary(r){
      const parts = [];
      if (r.gems)    parts.push('+' + r.gems + ' 💎');
      if (r.gold)    parts.push('+' + r.gold + ' 🪙');
      if (r.iron)    parts.push('+' + r.iron + ' ⛓️');
      if (r.crystal) parts.push('+' + r.crystal + ' 🔷');
      if (r.essence) parts.push('+' + r.essence + ' 💠');
      return parts.join('، ');
    }
    function redeemPromo(){
      const code = (state.promoInput || '').trim().toUpperCase();
      if (!code) return;
      const r = PROMO_CODES[code];
      if (!r){ state.promoOk = false; state.promoMsg = 'كود غير صالح.'; return; }
      if (!r.repeatable && state.redeemed.includes(code)){ state.promoOk = false; state.promoMsg = 'سبق استخدام هذا الكود.'; return; }
      if (r.gold)    state.player.gold += r.gold;
      if (r.gems)    state.player.gems += r.gems;
      if (r.iron)    state.materials.iron    = (state.materials.iron    || 0) + r.iron;
      if (r.crystal) state.materials.crystal = (state.materials.crystal || 0) + r.crystal;
      if (r.essence) state.materials.essence = (state.materials.essence || 0) + r.essence;
      if (!r.repeatable) state.redeemed.push(code);
      state.promoOk = true;
      state.promoMsg = (r.msg || 'تم التفعيل!') + '  ' + rewardSummary(r);
      state.promoInput = '';
      sfx('win');
    }

    /* ---------- dungeons / RELAY combat ---------- */
    const isUnlocked = (d) => d.id === 1 || state.clearedMax >= d.id - 1;
    const starKey   = (id, diff) => id + '-' + diff;
    const starsFor  = (d, diff) => state.dungeonStars[starKey(d.id, diff)] || 0;
    const bestStars = (d) => Math.max(starsFor(d,0), starsFor(d,1), starsFor(d,2));
    // difficulty unlock: normal opens with the dungeon; each tier needs the previous cleared (≥1★)
    const diffUnlocked = (d, diff) => {
      if (!isUnlocked(d)) return false;
      if (diff === 0) return true;
      return starsFor(d, diff - 1) >= 1;
    };
    const previewWaves   = (d) => (d && d.id <= 3) ? 3 : 4;
    const previewAffixes = (diff) => (DIFFICULTIES[diff] ? DIFFICULTIES[diff].affixes.map(k => AFFIXES[k]) : []);
    function openPreview(d){
      if (!isUnlocked(d)) return;
      let diff = 0;                                   // default to the hardest tier already unlocked
      if (diffUnlocked(d, 2)) diff = 2; else if (diffUnlocked(d, 1)) diff = 1;
      state.preview = { open:true, dungeon:d, diff };
    }
    function closePreview(){ state.preview.open = false; }
    function setPreviewDiff(diff){ const d = state.preview.dungeon; if (d && diffUnlocked(d, diff)) state.preview.diff = diff; }
    function previewStart(){ const p = state.preview; if (!p.dungeon) return; p.open = false; enterDungeon(p.dungeon, p.diff); }
    function firstAlive(){ for (let i=0;i<state.heroes.length;i++) if (state.combat.hp[i] > 0) return i; return -1; }
    function nextAlive(from){ for (let i=from+1;i<state.heroes.length;i++) if (state.combat.hp[i] > 0) return i; return -1; }

    /* auto-battle: keep attacking on its own while enabled */
    let _autoT = null;
    function scheduleAuto(){
      clearTimeout(_autoT);
      _autoT = setTimeout(() => {
        const cb = state.combat;
        if (cb.auto && cb.active && cb.turn === 'player' && !cb.busy && !cb.result) onAttack();
      }, 650);
    }
    function toggleAuto(){
      state.combat.auto = !state.combat.auto;
      if (state.combat.auto) scheduleAuto();
    }

    function enterDungeon(d, diffId){
      if (!isUnlocked(d)) return;
      const diff = DIFFICULTIES[diffId] || DIFFICULTIES[0];
      const cb = state.combat;
      cb.dungeonId = d.id;
      cb.diff = diff.id;
      cb.affixes = diff.affixes.slice();
      cb.waves = buildEncounters(d, diff.statMul);
      cb.wave = 0;
      cb.enemy = { ...cb.waves[0] };
      cb.hp = state.heroes.map((h, i) => heroMax(i));
      cb.idx = 0; cb.fell = 0; cb.enraged = false;
      cb.active = true; cb.turn = 'player'; cb.busy = false;
      cb.result = null; cb.reward = null;
      state.log = [];
      pushLog('دخلت ' + d.nameAr + ' (' + diff.nameAr + ') — ' + cb.waves.length + ' مراحل. يتقدّم ' + heroName(state.heroes[0]) + '.');
      nextTick(() => { fxAura(); FX.embers(); });
      if (cb.auto) scheduleAuto();
    }
    function advanceWave(){
      const cb = state.combat;
      cb.wave++;
      const w = cb.waves[cb.wave];
      cb.enemy = { ...w };
      cb.enraged = false;
      state.heroes.forEach((h, i) => {            // heal living heroes between stages
        if (cb.hp[i] > 0) cb.hp[i] = Math.min(heroMax(i), cb.hp[i] + Math.round(heroMax(i) * 0.25));
      });
      pushLog('الموجة ' + (cb.wave + 1) + '/' + cb.waves.length + ' — يظهر ' + w.name + (w.isBoss ? ' (الزعيم)!' : '!'));
      nextTick(() => fxAura());
    }

    function onAttack(){
      const cb = state.combat;
      if (!cb.active || cb.turn !== 'player' || cb.busy || cb.result) return;
      if (cb.hp[cb.idx] <= 0){ const n = firstAlive(); if (n < 0){ loseDungeon(); return; } cb.idx = n; }
      cb.busy = true;
      const enemy = cb.enemy, h = state.heroes[cb.idx], st = heroStats(h);
      const r = computeDamage(st.atk, enemy.def, h.set.element, enemy.element);
      enemy.hp = Math.max(0, enemy.hp - r.dmg);
      fxLeadAttack();
      sfx(r.mult > 1 ? 'super' : 'hit');
      spawnFloater('foe', '-' + r.dmg + (r.mult > 1 ? ' ⚡' : ''), r.mult > 1 ? '#ffd24a' : '#ffffff');
      pushLog(heroName(h) + ' ضرب ' + enemy.name + ' بـ ' + r.dmg + '.');
      setTimeout(() => {
        if (enemy.hp <= 0){
          if (cb.wave < cb.waves.length - 1){      // more stages -> next wave, keep player's turn
            advanceWave(); cb.busy = false; cb.turn = 'player';
            if (cb.auto) scheduleAuto();
          } else winDungeon();
        } else enemyStrike();
      }, 520);
    }

    function enemyStrike(){
      const cb = state.combat;
      cb.turn = 'enemy';
      setTimeout(() => {
        const enemy = cb.enemy, i = cb.idx, h = state.heroes[i], st = heroStats(h);
        let eAtk = enemy.atk;
        if (cb.affixes.indexOf('rage') >= 0) eAtk = Math.round(eAtk * 1.25);
        if (enemy.isBoss && !cb.enraged && enemy.hp <= enemy.maxHp * 0.3){
          cb.enraged = true; pushLog('⚡ احتدم ' + enemy.name + ' — هجومه يشتدّ!');
        }
        if (cb.enraged) eAtk = Math.round(eAtk * 1.3);
        const r = computeDamage(eAtk, st.def, enemy.element, h.set.element);
        let dmg = r.dmg;
        if (cb.affixes.indexOf('fragile') >= 0) dmg = Math.round(dmg * 1.15);
        cb.hp[i] = Math.max(0, cb.hp[i] - dmg);
        fxEnemyAttack();
        sfx('hurt');
        spawnFloater('hero', '-' + dmg, '#ff6a6a');
        pushLog(enemy.name + ' ضرب ' + heroName(h) + ' بـ ' + dmg + '.');
        setTimeout(() => {
          if (cb.hp[i] <= 0){
            cb.fell++;
            pushLog(heroName(h) + ' سقط!');
            const n = nextAlive(i);
            if (n < 0){ loseDungeon(); return; }
            cb.idx = n;
            pushLog(heroName(state.heroes[n]) + ' يدخل المعركة!');
            nextTick(() => fxLeadEnter());
          }
          cb.turn = 'player';
          cb.busy = false;
          if (cb.auto && !cb.result) scheduleAuto();
        }, 520);
      }, 560);
    }

    function winDungeon(){
      const cb = state.combat;
      cb.turn = 'over';
      const d = DUNGEONS.find(x => x.id === cb.dungeonId);
      const diffObj = DIFFICULTIES[cb.diff] || DIFFICULTIES[0];
      // ---- star rating (relay performance) ----
      const aliveCount = state.heroes.reduce((n, h, i) => n + (cb.hp[i] > 0 ? 1 : 0), 0);
      const maxTot = state.heroes.reduce((s, h, i) => s + heroMax(i), 0);
      const curTot = state.heroes.reduce((s, h, i) => s + Math.max(0, cb.hp[i]), 0);
      const hpFrac = maxTot ? curTot / maxTot : 0;
      let stars = 1; if (aliveCount === 3) stars++; if (aliveCount === 3 && hpFrac >= 0.5) stars++;
      // ---- loot (scaled by difficulty) + first-clear gems ----
      const key = starKey(d.id, cb.diff);
      const firstClear = !(key in state.dungeonStars);
      const lines = rollLoot(d, diffObj);
      if (firstClear) lines.push({ kind:'gems', amt:d.id * 2 * (cb.diff + 1), firstClear:true });
      let gold = 0, gems = 0;
      lines.forEach(l => {
        if (l.kind === 'gold') gold += l.amt;
        else if (l.kind === 'gems') gems += l.amt;
        else if (l.kind === 'mat') state.materials[l.mat] = (state.materials[l.mat] || 0) + l.amt;
      });
      state.player.gold += gold;
      state.player.gems += gems;
      if (cb.diff === 0 && d.id > state.clearedMax) state.clearedMax = d.id;   // normal clears gate the next dungeon
      if (stars > (state.dungeonStars[key] || 0)) state.dungeonStars[key] = stars;
      cb.reward = { lines, stars, firstClear, gems };
      sfx('win');
      pushLog('انتصرت! ' + '★'.repeat(stars) + ' — +' + gold + ' ذهب' + (gems ? ('، +' + gems + ' جوهرة') : '') + '.');
      cb.result = 'win';
      nextTick(() => { fxResult('win'); FX.burst(); });
    }
    function loseDungeon(){
      const cb = state.combat;
      cb.turn = 'over';
      sfx('lose');
      pushLog('سقط فريقك…');
      cb.result = 'lose';
      nextTick(() => fxResult('lose'));
    }
    function closeCombat(){
      FX.clear();
      state.combat.active = false;
      state.combat.result = null;
      state.combat.turn = 'idle';
    }
    function retryDungeon(){
      const d = DUNGEONS.find(x => x.id === state.combat.dungeonId);
      if (d) enterDungeon(d, state.combat.diff);
    }

    /* ---------- animations & effects (GSAP + tsParticles, safe fallbacks) ---------- */
    const GS = (typeof window !== 'undefined' && window.gsap) ? window.gsap : null;
    const motion = !!GS && !prefersReducedMotion;

    // legacy Web Animations helper — used only if GSAP is unavailable
    function anim(el, frames, opts){
      if (!el || prefersReducedMotion || !el.animate) return;
      try { el.animate(frames, opts); } catch(e){}
    }
    function arenaEl(){ return document.querySelector('.combat .arena'); }
    function shake(power){
      if (!motion) return;
      const a = arenaEl(); if (!a) return;
      GS.killTweensOf(a);
      GS.fromTo(a, { x:0, y:0 },
        { keyframes:{ x:[-power, power, -power*0.6, power*0.5, 0], y:[power*0.4, -power*0.3, power*0.2, 0, 0] },
          duration:0.34, ease:'power2.out' });
    }
    function fxHero(i){
      const el = document.querySelectorAll('.hero-grid .hero-card')[i]; if (!el) return;
      if (motion){
        GS.fromTo(el, { scale:1 }, { scale:1.06, duration:0.16, yoyo:true, repeat:1, ease:'power2.out' });
        const b = el.querySelector('.knight .body');
        if (b) GS.timeline().to(b, { filter:'brightness(2.4)', duration:0.05 }).to(b, { filter:'brightness(1)', duration:0.5 });
      } else {
        anim(el, [{ transform:'scale(1)' },{ transform:'scale(1.05)' },{ transform:'scale(1)' }], { duration:280, easing:'ease-out' });
      }
    }
    function fxLeadAttack(){
      const k  = document.querySelector('.combat .fighter.active .knight');
      const mb = document.querySelector('.combat .monster .m-body');
      const mon= document.querySelector('.combat .monster');
      if (motion){
        if (k)  GS.timeline().to(k, { x:20, duration:0.12, ease:'power3.in' }).to(k, { x:0, duration:0.24, ease:'back.out(2)' });
        if (mb) GS.timeline({ delay:0.12 }).to(mb, { filter:'brightness(2.9)', duration:0.05 }).to(mb, { filter:'brightness(1)', duration:0.4 });
        if (mon)GS.fromTo(mon, { x:0 }, { x:8, duration:0.06, delay:0.13, yoyo:true, repeat:1, ease:'power1.inOut' });
        shake(5);
      } else {
        anim(k, [{ transform:'translateX(0)' },{ transform:'translateX(16px)' },{ transform:'translateX(0)' }], { duration:300, easing:'ease-out' });
      }
    }
    function fxEnemyAttack(){
      const k = document.querySelector('.combat .fighter.active .knight');
      const b = document.querySelector('.combat .fighter.active .knight .body');
      if (motion){
        if (k) GS.fromTo(k, { x:0 }, { keyframes:{ x:[-6,6,-4,3,0] }, duration:0.3, ease:'power2.out' });
        if (b) GS.timeline().to(b, { filter:'brightness(2.6)', duration:0.05 }).to(b, { filter:'brightness(1)', duration:0.38 });
        shake(7);
      } else {
        anim(k, [{ transform:'translateX(-5px)' },{ transform:'translateX(5px)' },{ transform:'translateX(0)' }], { duration:320, easing:'ease-out' });
      }
    }
    function fxLeadEnter(){
      const k = document.querySelector('.combat .fighter.active .knight');
      if (motion && k) GS.from(k, { scale:0.6, opacity:0.2, duration:0.42, ease:'back.out(1.6)', transformOrigin:'bottom center' });
      else anim(k, [{ opacity:0.2 },{ opacity:1 }], { duration:420, easing:'ease-out' });
    }
    function fxAura(){
      const a = document.querySelector('.combat .monster .m-aura'); if (!a) return;
      if (motion) GS.fromTo(a, { opacity:0.5 }, { opacity:0.85, duration:2.2, repeat:-1, yoyo:true, ease:'sine.inOut' });
      else anim(a, [{ opacity:0.5 },{ opacity:0.85 }], { duration:2200, iterations:Infinity, direction:'alternate', easing:'ease-in-out' });
    }
    function fxResult(kind){
      if (!motion) return;
      const card = document.querySelector('.combat .result-card');
      if (card) GS.from(card, { scale:0.7, opacity:0, y:16, duration:0.5, ease:'back.out(1.7)' });
    }

    /* ---------- particles (tsParticles): ambient embers + victory burst ---------- */
    const FX = (function(){
      const TP = (typeof window !== 'undefined' && window.tsParticles) ? window.tsParticles : null;
      let emb = null;
      function elColor(){ const h = activeHero.value; return (h && h.set && ELEMENT_COLORS[h.set.element]) ? ELEMENT_COLORS[h.set.element] : '#e8b94a'; }
      function clear(){
        try { if (emb && emb.destroy) emb.destroy(); } catch(e){}
        emb = null;
        try { if (TP && TP.dom) TP.dom().forEach(function(c){ try { c.destroy(); } catch(e){} }); } catch(e){}
      }
      async function embers(){
        if (!TP || prefersReducedMotion) return;
        try {
          clear();
          emb = await TP.load({ id:'fxParticles', options:{
            fullScreen:{ enable:false }, detectRetina:true, fpsLimit:45,
            particles:{
              number:{ value:16 }, color:{ value:['#e8b94a','#ff8a3c','#ffd76a'] },
              shape:{ type:'circle' }, opacity:{ value:{ min:0.15, max:0.6 } },
              size:{ value:{ min:1, max:2.6 } },
              move:{ enable:true, direction:'top', speed:{ min:0.3, max:1.1 }, outModes:{ default:'out' } }
            }
          }});
        } catch(e){ emb = null; }
      }
      async function burst(){
        if (!TP || prefersReducedMotion) return;
        try {
          clear();
          const c = elColor();
          await TP.load({ id:'fxParticles', options:{
            fullScreen:{ enable:false }, detectRetina:true,
            particles:{ number:{ value:0 }, color:{ value:[c, '#ffffff', '#f5c542'] },
              shape:{ type:'circle' }, opacity:{ value:1 }, size:{ value:{ min:1.5, max:3.5 } },
              move:{ enable:true, speed:{ min:6, max:13 }, direction:'none', gravity:{ enable:true, acceleration:9 }, outModes:{ default:'destroy' } } },
            emitters:{ direction:'top', life:{ count:1, duration:0.2, delay:0 },
              rate:{ quantity:60, delay:0 }, size:{ width:60, height:0 }, position:{ x:50, y:62 } }
          }});
          setTimeout(embers, 1500);
        } catch(e){}
      }
      return { embers, burst, clear };
    })();

    // unlock the audio engine on the first user interaction (autoplay policies)
    onMounted(() => {
      const unlock = () => { try { Sfx.resume(); } catch(e){} window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
      window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    });

    /* ---------- persistence ---------- */
    function snapshot(){
      return {
        v:4,
        player:{ ...state.player },
        materials:{ ...state.materials },
        clearedMax: state.clearedMax,
        dungeonStars:{ ...state.dungeonStars },
        heroes: JSON.parse(JSON.stringify(state.heroes)),
        sets: JSON.parse(JSON.stringify(state.sets)),
        market: JSON.parse(JSON.stringify(state.market)),
        redeemed: state.redeemed.slice(),
        settings:{ ...state.settings },
      };
    }
    function applySave(s){
      try {
        if (s.player) Object.assign(state.player, s.player);
        if (s.materials) Object.assign(state.materials, s.materials);
        if (typeof s.clearedMax === 'number') state.clearedMax = s.clearedMax;
        if (s.dungeonStars && typeof s.dungeonStars === 'object') state.dungeonStars = s.dungeonStars;
        if (Array.isArray(s.heroes) && s.heroes.length === 3) state.heroes = s.heroes;
        if (Array.isArray(s.sets)) state.sets = s.sets;
        if (s.market && Array.isArray(s.market.offers)) state.market = s.market;
        if (Array.isArray(s.redeemed)) state.redeemed = s.redeemed;
        if (s.settings) Object.assign(state.settings, s.settings);
        let maxId = 0;
        const scan = (set) => { const m = /^s(\d+)$/.exec(set && set.id || ''); if (m) maxId = Math.max(maxId, +m[1]); };
        state.heroes.forEach(h => scan(h.set));
        state.sets.forEach(scan);
        if (state.market.featured) scan(state.market.featured);
        (state.market.offers || []).forEach(scan);
        setGearIdFloor(maxId);
      } catch(e){ /* ignore corrupt save */ }
    }

    const resetArmed = ref(false);
    let _resetTimer = null;
    function resetGame(){
      if (!resetArmed.value){
        resetArmed.value = true;
        clearTimeout(_resetTimer);
        _resetTimer = setTimeout(() => { resetArmed.value = false; }, 2500);
        return;
      }
      persistClear();
      try { location.reload(); } catch(e){}
    }

    const saved = persistLoad();
    if (saved) applySave(saved);
    ensureMarket();

    watch(
      () => [state.player, state.materials, state.heroes, state.sets, state.market, state.redeemed, state.clearedMax, state.dungeonStars, state.settings],
      () => { persistSave(snapshot()); },
      { deep:true }
    );

    return {
      state, tabs, dungeons, tiers, elements, exchanges, rerollCost, partyPower,
      elementColor, elementTrait, matIcon, matName, pct, costLabel, lastLog, floaterStyle, toggleSound, setDot, setBg,
      hs, heroPower, heroMax, heroName, heroEl, setColor, rarityName, heroVars, neonClass, enemyVars, activeHero, isActive, fighterStyle, weaponClass,
      canEnhance, enhanceLabel, enhanceHeroSet, canUpgradeHero, heroUpLabel, upgradeHero,
      openSwap, closeSwap, equipFromSwap,
      tierObj, craftCostObj, canCraft, doCraft,
      rerollMarket, openBuy, closeBuy, confirmBuy, canExchange, doExchange, exGive, sellSet, sellGems,
      openSettings, closeSettings, redeemPromo,
      isUnlocked, enterDungeon, onAttack, toggleAuto, closeCombat, retryDungeon,
      difficulties: DIFFICULTIES, affixDefs: AFFIXES,
      bestStars, starsFor, diffUnlocked, previewWaves, previewAffixes,
      openPreview, closePreview, setPreviewDiff, previewStart,
      resetArmed, resetGame,
    };
  }
}).mount('#app');

/* fade out the loading screen once the app is mounted */
(function(){
  var l = document.getElementById('loader');
  if (l){ l.classList.add('loaded'); setTimeout(function(){ if (l.parentNode) l.parentNode.removeChild(l); }, 650); }
})();
