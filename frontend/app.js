// Frontend logic for TAPTAP BOSS
(() => {
  const socket = io({
    query: { username: getUsername() },
  });

  // DOM elements
  const stageEl = document.getElementById('stage');
  const hpEl = document.getElementById('hp');
  const goldEl = document.getElementById('gold');
  const crystalsEl = document.getElementById('crystals');
  const hpBar = document.getElementById('hp-bar');
  const enemyContainer = document.getElementById('enemy-container');
  const tapButton = document.getElementById('tap-button');
  const logEl = document.getElementById('log');
  const upgradeBtn = document.getElementById('upgrade-btn');
  const prestigeBtn = document.getElementById('prestige-btn');

  let maxHp = 10;
  let playerStats = {};
  let upgradeCost = 10;

  tapButton.addEventListener('click', () => {
    socket.emit('PLAYER_TAP');
  });

  upgradeBtn.addEventListener('click', () => {
    // send upgrade event with cost
    socket.emit('UPGRADE_APPLIED', { type: 'tapDamage', cost: upgradeCost });
  });

  prestigeBtn.addEventListener('click', () => {
    socket.emit('PRESTIGE_TRIGGERED');
  });

  socket.on('INIT', (data) => {
    playerStats = data.player;
    maxHp = data.enemyHp;
    updateStats();
    updateHpBar(maxHp);
    hpEl.textContent = `HP: ${maxHp}`;
    setStage(data.player.stage);
  });

  socket.on('DAMAGE_CALCULATED', ({ damage, enemyHp }) => {
    createDamagePopup(damage);
    updateHp(enemyHp);
  });

  socket.on('ENEMY_DEAD', ({ isBoss, rewards }) => {
    // Screen shake
    enemyContainer.classList.add('shake');
    setTimeout(() => enemyContainer.classList.remove('shake'), 300);
    // Update rewards
    if (rewards) {
      showLog(`+${rewards.gold} gold` + (rewards.crystals ? `, +${rewards.crystals} crystals` : ''));
      playerStats.gold += rewards.gold;
      playerStats.crystals += rewards.crystals;
      updateStats();
    }
  });

  socket.on('NEW_ENEMY', ({ enemyHp, isBoss }) => {
    maxHp = enemyHp;
    updateHp(enemyHp);
    setStage(playerStats.stage);
  });

  socket.on('ITEM_DROP', (item) => {
    showLog(`Item drop: ${item.type} (rarity ${item.rarity})`);
  });

  socket.on('UPGRADE_APPLIED', ({ type, newValue }) => {
    if (type === 'tapDamage') {
      playerStats.upgrades = playerStats.upgrades || {};
      playerStats.upgrades.tapDamage = newValue;
      // Increase cost exponentially
      upgradeCost = Math.floor(upgradeCost * 1.5 + 5);
      upgradeBtn.textContent = `Upgrade Damage (Cost: ${upgradeCost})`;
      showLog(`Tap damage upgraded to ${newValue}!`);
    }
  });

  socket.on('PRESTIGE_TRIGGERED', ({ crystals }) => {
    showLog(`Prestiged! Earned ${crystals} crystals`);
    // Reset UI
    playerStats.stage = 1;
    playerStats.gold = playerStats.gold; // crystals updated server-side
    updateStats();
    setStage(playerStats.stage);
    upgradeCost = 10;
    upgradeBtn.textContent = `Upgrade Damage (Cost: ${upgradeCost})`;
  });

  function updateHp(hp) {
    hp = Math.max(0, hp);
    hpEl.textContent = `HP: ${Math.floor(hp)}`;
    const percent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    hpBar.style.width = percent + '%';
  }

  function updateHpBar(hp) {
    hpBar.style.width = '100%';
  }

  function updateStats() {
    goldEl.textContent = `Gold: ${playerStats.gold}`;
    crystalsEl.textContent = `Crystals: ${playerStats.crystals}`;
  }

  function setStage(stage) {
    stageEl.textContent = `Stage: ${stage}`;
  }

  function showLog(message) {
    const div = document.createElement('div');
    div.textContent = message;
    div.style.fontSize = '0.8rem';
    div.style.marginTop = '0.2rem';
    logEl.appendChild(div);
    setTimeout(() => {
      div.remove();
    }, 4000);
  }

  function createDamagePopup(dmg) {
    const span = document.createElement('span');
    span.className = 'damage-popup';
    span.textContent = Math.floor(dmg);
    // Random horizontal offset within enemy container
    const rect = enemyContainer.getBoundingClientRect();
    const offsetX = Math.random() * (rect.width - 60) + 30;
    const offsetY = Math.random() * (rect.height / 2) + rect.height / 4;
    span.style.left = offsetX + 'px';
    span.style.top = offsetY + 'px';
    enemyContainer.appendChild(span);
    setTimeout(() => {
      span.remove();
    }, 1000);
  }

  function getUsername() {
    let name = localStorage.getItem('ttb_username');
    if (!name) {
      name = 'Player' + Math.floor(Math.random() * 100000);
      localStorage.setItem('ttb_username', name);
    }
    return name;
  }
})();