/* =========================================================================
   أساطير النصل — Persistence (Part 5)
   Save/load to localStorage. Everything is wrapped in try/catch: if storage
   is unavailable (private mode, sandboxed preview, etc.) the game simply runs
   without saving instead of crashing. Only durable progress is stored — never
   transient combat state.
   ========================================================================= */
const SAVE_KEY = 'asateer-al-nasl-save-v1';

function persistSave(data){
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; }
  catch(e){ return false; }
}

function persistLoad(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}

function persistClear(){
  try { localStorage.removeItem(SAVE_KEY); } catch(e){}
}
