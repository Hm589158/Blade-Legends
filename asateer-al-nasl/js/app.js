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

      /* combat (relay) */
      combat:{ active:false, dungeonId:null, enemy:null, hp:[], idx:0, turn:'idle', busy:false, result:null, reward:null },
      log:[], floaters:[],

      /* craft / swap UI */
      craftTier:1, craftElement:'نار', craftResult:null, swapIdx:null,

      /* market */
      market:{ day:'', featured:null, offers:[] },
      marketTab:'shop', buyTarget:null,

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
    function heroVars(h){
      const c = h.set ? h.set.colors : { primary:'#555', secondary:'#222', accent:'#888' };
      const glow = h.set ? (RARITY_GLOW[h.set.rarity] || 0.2) : 0.2;
      const el = h.set ? h.set.element : 'هواء';
      return {
        '--helmet':c.accent, '--helmet-acc':c.primary,
        '--chest':c.primary, '--chest-sec':c.secondary, '--chest-acc':c.accent,
        '--weapon':c.secondary, '--weapon-acc':c.accent,
        '--glow-h':(4+glow*20)+'px', '--glow-c':(4+glow*20)+'px', '--glow-w':(4+glow*24)+'px',
        '--aura-col':c.accent, '--el-col':ELEMENT_COLORS[el],
      };
    }
    const partyPower = computed(() => state.heroes.reduce((s, h, i) => s + heroPower(i), 0));
    const activeHero = computed(() => state.heroes[state.combat.idx] || state.heroes[0]);
    const isActive = (i) => i === state.combat.idx;

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

    /* ---------- dungeons / RELAY combat ---------- */
    const isUnlocked = (d) => d.id === 1 || state.clearedMax >= d.id - 1;
    function firstAlive(){ for (let i=0;i<state.heroes.length;i++) if (state.combat.hp[i] > 0) return i; return -1; }
    function nextAlive(from){ for (let i=from+1;i<state.heroes.length;i++) if (state.combat.hp[i] > 0) return i; return -1; }

    function enterDungeon(d){
      if (!isUnlocked(d)) return;
      const e = d.enemy;
      state.combat.dungeonId = d.id;
      state.combat.enemy = { name:e.name, element:d.element, hp:e.hp, maxHp:e.hp, atk:e.atk, def:e.def, colors:{ ...ENEMY_PAL[d.element] } };
      state.combat.hp = state.heroes.map((h, i) => heroMax(i));
      state.combat.idx = 0;
      state.combat.active = true;
      state.combat.turn = 'player';
      state.combat.busy = false;
      state.combat.result = null;
      state.combat.reward = null;
      state.log = [];
      pushLog('دخلت ' + d.nameAr + '! يتقدّم ' + heroName(state.heroes[0]) + '.');
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
      pushLog(heroName(h) + ' ضرب بـ ' + r.dmg + '.');
      setTimeout(() => { if (enemy.hp <= 0) winDungeon(); else enemyStrike(); }, 520);
    }

    function enemyStrike(){
      const cb = state.combat;
      cb.turn = 'enemy';
      setTimeout(() => {
        const enemy = cb.enemy, i = cb.idx, h = state.heroes[i], st = heroStats(h);
        const r = computeDamage(enemy.atk, st.def, enemy.element, h.set.element);
        cb.hp[i] = Math.max(0, cb.hp[i] - r.dmg);
        fxEnemyAttack();
        sfx('hurt');
        spawnFloater('hero', '-' + r.dmg, '#ff6a6a');
        pushLog(enemy.name + ' ضرب ' + heroName(h) + ' بـ ' + r.dmg + '.');
        setTimeout(() => {
          if (cb.hp[i] <= 0){
            pushLog(heroName(h) + ' سقط!');
            const n = nextAlive(i);
            if (n < 0){ loseDungeon(); return; }
            cb.idx = n;
            pushLog(heroName(state.heroes[n]) + ' يدخل المعركة!');
            nextTick(() => fxLeadEnter());
          }
          cb.turn = 'player';
          cb.busy = false;
        }, 520);
      }, 560);
    }

    function winDungeon(){
      const cb = state.combat;
      cb.turn = 'over';
      const d = DUNGEONS.find(x => x.id === cb.dungeonId);
      const gold = randInt(d.gold[0], d.gold[1]);
      const amt = randInt(d.mat.amt[0], d.mat.amt[1]);
      const firstClear = d.id > state.clearedMax;
      state.player.gold += gold;
      state.materials[d.mat.type] = (state.materials[d.mat.type] || 0) + amt;
      let gems = 0;
      if (firstClear){ state.clearedMax = d.id; gems = d.id * 2; state.player.gems += gems; }
      cb.reward = { gold, matType:d.mat.type, amt, gems };
      sfx('win');
      pushLog('انتصرت! +' + gold + ' ذهب، +' + amt + ' ' + matName(d.mat.type) + (gems ? ('، +' + gems + ' جوهرة') : '') + '.');
      cb.result = 'win';
    }
    function loseDungeon(){
      const cb = state.combat;
      cb.turn = 'over';
      sfx('lose');
      pushLog('سقط فريقك…');
      cb.result = 'lose';
    }
    function closeCombat(){
      state.combat.active = false;
      state.combat.result = null;
      state.combat.turn = 'idle';
    }
    function retryDungeon(){
      const d = DUNGEONS.find(x => x.id === state.combat.dungeonId);
      if (d) enterDungeon(d);
    }

    /* ---------- animations (transform/opacity/filter on wrappers only) ---------- */
    function fxHero(i){
      if (prefersReducedMotion) return;
      const el = document.querySelectorAll('.hero-grid .hero-card')[i];
      if (!el) return;
      gsap.fromTo(el, { scale:1 }, { scale:1.04, duration:0.14, yoyo:true, repeat:1, ease:'power2.out' });
      const body = el.querySelector('.knight .body');
      if (body) gsap.fromTo(body, { filter:'brightness(2.3)' }, { filter:'brightness(1)', duration:0.5, ease:'power2.out' });
    }
    function fxLeadAttack(){
      if (prefersReducedMotion) return;
      gsap.to('.combat .lead', { x:20, duration:0.15, yoyo:true, repeat:1, ease:'power2.out' });
      gsap.fromTo('.combat .monster .m-body', { filter:'brightness(2.6)' }, { filter:'brightness(1)', duration:0.45, ease:'power2.out' });
    }
    function fxEnemyAttack(){
      if (prefersReducedMotion) return;
      gsap.to('.combat .monster', { x:-28, duration:0.16, yoyo:true, repeat:1, ease:'power2.out' });
      const body = document.querySelector('.combat .lead .knight .body');
      if (body) gsap.fromTo(body, { filter:'brightness(2.4)' }, { filter:'brightness(1)', duration:0.4, ease:'power2.out' });
      gsap.fromTo('.combat .lead', { x:0 }, { x:6, duration:0.05, repeat:4, yoyo:true, clearProps:'x' });
    }
    function fxLeadEnter(){
      if (prefersReducedMotion) return;
      gsap.fromTo('.combat .lead', { y:16, opacity:0 }, { y:0, opacity:1, duration:0.38, ease:'power2.out' });
    }

    /* ---------- persistence ---------- */
    function snapshot(){
      return {
        v:4,
        player:{ ...state.player },
        materials:{ ...state.materials },
        clearedMax: state.clearedMax,
        heroes: JSON.parse(JSON.stringify(state.heroes)),
        sets: JSON.parse(JSON.stringify(state.sets)),
        market: JSON.parse(JSON.stringify(state.market)),
        settings:{ ...state.settings },
      };
    }
    function applySave(s){
      try {
        if (s.player) Object.assign(state.player, s.player);
        if (s.materials) Object.assign(state.materials, s.materials);
        if (typeof s.clearedMax === 'number') state.clearedMax = s.clearedMax;
        if (Array.isArray(s.heroes) && s.heroes.length === 3) state.heroes = s.heroes;
        if (Array.isArray(s.sets)) state.sets = s.sets;
        if (s.market && Array.isArray(s.market.offers)) state.market = s.market;
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
      () => [state.player, state.materials, state.heroes, state.sets, state.market, state.clearedMax, state.settings],
      () => { persistSave(snapshot()); },
      { deep:true }
    );

    onMounted(() => {
      if (prefersReducedMotion) return;
      gsap.to('.monster .m-aura', { scale:1.10, opacity:0.80, duration:2.2, repeat:-1, yoyo:true, ease:'sine.inOut' });
    });

    return {
      state, tabs, dungeons, tiers, elements, exchanges, rerollCost, partyPower,
      elementColor, elementTrait, matIcon, matName, pct, costLabel, lastLog, floaterStyle, toggleSound, setDot, setBg,
      hs, heroPower, heroMax, heroName, heroEl, setColor, rarityName, heroVars, enemyVars, activeHero, isActive,
      canEnhance, enhanceLabel, enhanceHeroSet, canUpgradeHero, heroUpLabel, upgradeHero,
      openSwap, closeSwap, equipFromSwap,
      tierObj, craftCostObj, canCraft, doCraft,
      rerollMarket, openBuy, closeBuy, confirmBuy, canExchange, doExchange, exGive, sellSet, sellGems,
      isUnlocked, enterDungeon, onAttack, closeCombat, retryDungeon,
      resetArmed, resetGame,
    };
  }
}).mount('#app');
