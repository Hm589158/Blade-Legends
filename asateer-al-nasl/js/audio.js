/* =========================================================================
   أساطير النصل — Audio (Part 5)
   Tiny Web Audio synthesiser: all sound effects are generated in code, so the
   project still ships with zero asset files. The AudioContext is created
   lazily on the first sound (which always follows a user tap, satisfying
   browser autoplay rules). All calls are wrapped so audio can never break the
   game if it is unavailable.
   ========================================================================= */
const Sfx = (function(){
  let ctx = null;
  function ac(){
    if (!ctx){
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ ctx = null; }
    }
    return ctx;
  }
  // one short enveloped oscillator note
  function tone(freq, dur, type, gain, when){
    const c = ac(); if (!c) return;
    type = type || 'square'; gain = gain || 0.06; when = when || 0;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sounds = {
    hit:   function(){ tone(180, 0.12, 'square', 0.07); },
    super: function(){ tone(320, 0.10, 'sawtooth', 0.07); tone(520, 0.16, 'sawtooth', 0.05, 0.06); },
    hurt:  function(){ tone(120, 0.20, 'sawtooth', 0.06); },
    win:   function(){ [523, 659, 784, 1047].forEach(function(f,i){ tone(f, 0.18, 'triangle', 0.06, i*0.12); }); },
    lose:  function(){ [330, 247, 165].forEach(function(f,i){ tone(f, 0.26, 'sine', 0.06, i*0.14); }); },
    forge: function(){ tone(150, 0.08, 'square', 0.06); tone(90, 0.18, 'square', 0.05, 0.05); },
    crit:  function(){ [660, 880, 1320].forEach(function(f,i){ tone(f, 0.12, 'triangle', 0.06, i*0.07); }); },
  };
  return {
    play: function(name){ try { (sounds[name] || function(){})(); } catch(e){} },
    resume: function(){ const c = ac(); if (c && c.state === 'suspended') c.resume(); },
  };
})();
