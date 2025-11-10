const askBtn = document.getElementById('askBtn');
const q = document.getElementById('q');
const log = document.getElementById('log');
const limitMsg = document.getElementById('limitMsg');

function uid() { return crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random()); }
function todayKey() { return new Date().toISOString().slice(0,10); }

const PLAYER_KEY = 'stone.playerId';
const LAST_DAY_KEY = 'stone.lastDay';
let playerId = localStorage.getItem(PLAYER_KEY) || (localStorage.setItem(PLAYER_KEY, uid()), localStorage.getItem(PLAYER_KEY));

function addBubble(text) {
  const div = document.createElement('div');
  div.className = 'bubble';
  div.textContent = text;
  log.prepend(div);
}

function checkClientLimit() {
  const d = localStorage.getItem(LAST_DAY_KEY);
  const today = todayKey();
  if (d === today) {
    limitMsg.hidden = false;
    limitMsg.textContent = "The Stone slumbers. It will speak again at the next dawn.";
    return true;
  }
  limitMsg.hidden = true;
  return false;
}

checkClientLimit();

askBtn.addEventListener('click', async () => {
  if (!q.value.trim()) return;
  if (checkClientLimit()) return;

  const question = q.value.trim();
  q.value = '';
  addBubble("You: " + question);

  askBtn.disabled = true;
  try {
    const resp = await fetch('/api/stone/ask', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ question, playerId })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error');

    addBubble("Stone: " + data.answer);
    // Soft client limit
    localStorage.setItem(LAST_DAY_KEY, todayKey());
    checkClientLimit();
  } catch (e) {
    addBubble("Stone: …the current is turbulent. (" + e.message + ")");
  } finally {
    askBtn.disabled = false;
  }
});
