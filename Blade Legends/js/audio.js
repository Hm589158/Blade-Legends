/* =========================================================================
   أساطير النصل — Audio  (now powered by Tone.js, with a tiny WebAudio fallback)
   Public API is unchanged so the rest of the game needs no edits:
     Sfx.play(name)   name ∈ hit | super | crit | hurt | forge | win | lose
     Sfx.resume()     call on a user gesture to unlock/начать the audio context
   Everything is synthesised in code — still zero audio asset files.
   ========================================================================= */
const Sfx = (function () {
  var HAS_TONE = (typeof window !== 'undefined' && window.Tone);
  var ready = false, inst = null;

  /* ---- build the Tone instruments once (after the context is running) ---- */
  function build() {
    if (inst || !HAS_TONE) return inst;
    try {
      var master = new Tone.Volume(-7).toDestination();
      var lead = new Tone.Synth({ oscillator:{ type:'triangle' },
        envelope:{ attack:0.004, decay:0.12, sustain:0, release:0.12 } }).connect(master);
      var poly = new Tone.PolySynth(Tone.Synth, { oscillator:{ type:'triangle' },
        envelope:{ attack:0.01, decay:0.2, sustain:0.12, release:0.4 } }).connect(master);
      poly.volume.value = -4;
      var clangFilter = new Tone.Filter(2600, 'bandpass').connect(master);
      var noise = new Tone.NoiseSynth({ noise:{ type:'white' },
        envelope:{ attack:0.002, decay:0.09, sustain:0 } }).connect(clangFilter);
      noise.volume.value = -6;
      var thud = new Tone.MembraneSynth({ pitchDecay:0.03, octaves:4,
        envelope:{ attack:0.001, decay:0.26, sustain:0 } }).connect(master);
      thud.volume.value = -2;
      inst = { lead:lead, poly:poly, noise:noise, thud:thud };
    } catch (e) { inst = null; }
    return inst;
  }

  /* ---- Tone-based sound bank ---- */
  function playTone(name) {
    var x = build(); if (!x) return false;
    var t = Tone.now();
    try {
      switch (name) {
        case 'hit':
          x.noise.triggerAttackRelease(0.07, t); x.lead.triggerAttackRelease('A4', 0.05, t); break;
        case 'super':
          x.noise.triggerAttackRelease(0.1, t);
          x.lead.triggerAttackRelease('E5', 0.07, t); x.lead.triggerAttackRelease('B5', 0.1, t + 0.07); break;
        case 'crit':
          x.noise.triggerAttackRelease(0.11, t);
          ['E5','A5','E6'].forEach(function (n,i){ x.lead.triggerAttackRelease(n, 0.09, t + i*0.06); }); break;
        case 'hurt':
          x.thud.triggerAttackRelease('C2', 0.22, t); x.noise.triggerAttackRelease(0.05, t); break;
        case 'forge':
          x.noise.triggerAttackRelease(0.05, t); x.thud.triggerAttackRelease('G2', 0.1, t);
          x.noise.triggerAttackRelease(0.05, t + 0.1); break;
        case 'win':
          ['C5','E5','G5','C6'].forEach(function (n,i){ x.poly.triggerAttackRelease(n, 0.35, t + i*0.1); }); break;
        case 'lose':
          ['G4','Eb4','C4','A3'].forEach(function (n,i){ x.poly.triggerAttackRelease(n, 0.45, t + i*0.16); }); break;
        default: return false;
      }
      return true;
    } catch (e) { return false; }
  }

  /* ---- minimal WebAudio fallback (only if Tone is unavailable) ---- */
  var fbCtx = null;
  function ac(){ if(!fbCtx){ try{ fbCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ fbCtx=null; } } return fbCtx; }
  function beep(freq, dur, type, gain, when){
    var c = ac(); if(!c) return; var o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.value=freq; o.connect(g); g.connect(c.destination);
    var t=c.currentTime+(when||0); g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(gain||0.06,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.02);
  }
  var fb = {
    hit:function(){ beep(180,0.12,'square',0.07); },
    super:function(){ beep(320,0.1,'sawtooth',0.07); beep(520,0.16,'sawtooth',0.05,0.06); },
    crit:function(){ [660,880,1320].forEach(function(f,i){ beep(f,0.12,'triangle',0.06,i*0.07); }); },
    hurt:function(){ beep(120,0.2,'sawtooth',0.06); },
    forge:function(){ beep(150,0.08,'square',0.06); beep(90,0.18,'square',0.05,0.05); },
    win:function(){ [523,659,784,1047].forEach(function(f,i){ beep(f,0.18,'triangle',0.06,i*0.12); }); },
    lose:function(){ [330,247,165].forEach(function(f,i){ beep(f,0.26,'sine',0.06,i*0.14); }); },
  };

  return {
    play: function (name) {
      try { if (playTone(name)) return; } catch (e) {}
      try { (fb[name] || function(){})(); } catch (e) {}
    },
    resume: function () {
      if (HAS_TONE) {
        try { Tone.start(); var c = Tone.getContext(); if (c && c.state !== 'running') c.resume(); ready = true; } catch (e) {}
      }
      var c2 = ac(); if (c2 && c2.state === 'suspended') { try { c2.resume(); } catch (e) {} }
    },
  };
})();
