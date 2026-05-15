// TAPTAP BOSS backend server
// Node.js + Express + Socket.IO + MongoDB

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taptapboss';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Mongoose schemas
const ItemSchema = new mongoose.Schema({
  type: { type: String, enum: ['sword', 'armor', 'ring', 'artifact', 'relic'], required: true },
  rarity: { type: Number, min: 1, max: 5, required: true },
  level: { type: Number, default: 1 },
});

const UpgradeSchema = new mongoose.Schema({
  tapDamage: { type: Number, default: 1 },
  autoTap: {
    active: { type: Boolean, default: false },
    dps: { type: Number, default: 0 },
  },
});

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  maxBossLevel: { type: Number, default: 0 },
  prestigeLevel: { type: Number, default: 0 },
  maxDamage: { type: Number, default: 1 },
  totalTaps: { type: Number, default: 0 },
  gold: { type: Number, default: 0 },
  crystals: { type: Number, default: 0 },
  stage: { type: Number, default: 1 },
  enemyHp: { type: Number, default: 10 },
  bossStageInterval: { type: Number, default: 10 },
  upgrades: { type: UpgradeSchema, default: () => ({}) },
  inventory: { type: [ItemSchema], default: [] },
  lastTapAt: { type: Date, default: null },
});

const Player = mongoose.model('Player', PlayerSchema);

// In-memory leaderboard cache
let cachedLeaderboard = null;
let leaderboardCacheTime = 0;
const LEADERBOARD_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function getLeaderboard() {
  const now = Date.now();
  if (cachedLeaderboard && now - leaderboardCacheTime < LEADERBOARD_CACHE_DURATION) {
    return cachedLeaderboard;
  }
  const players = await Player.find({})
    .select('name maxBossLevel prestigeLevel maxDamage totalTaps')
    .sort({ maxBossLevel: -1, prestigeLevel: -1, maxDamage: -1 })
    .limit(50)
    .lean();
  cachedLeaderboard = players;
  leaderboardCacheTime = now;
  return players;
}

// Game logic helpers
function calculateEnemyHp(stage) {
  // Exponential scaling: base 10 hp increasing per stage
  return Math.floor(10 * Math.pow(1.15, stage - 1));
}

function isBossStage(player) {
  return player.stage % player.bossStageInterval === 0;
}

function calculateTapDamage(player) {
  // Basic damage calculation: base 1 + upgrades tapDamage + item bonuses
  let base = 1 + (player.upgrades?.tapDamage || 0);
  // Items add 0.5 damage per rarity level
  if (player.inventory && player.inventory.length) {
    base += player.inventory.reduce((sum, it) => sum + it.rarity * 0.5, 0);
  }
  return base;
}

function rewardPlayer(player, enemyHp, isBoss) {
  // Reward simple: gold equal to enemy HP; crystals for bosses
  const goldReward = enemyHp;
  const crystalReward = isBoss ? Math.floor(enemyHp / 10) : 0;
  player.gold += goldReward;
  player.crystals += crystalReward;
  return { gold: goldReward, crystals: crystalReward };
}

function generateItemDrop() {
  // Randomly generate item with probability; 30% drop chance
  if (Math.random() > 0.3) return null;
  const types = ['sword', 'armor', 'ring', 'artifact', 'relic'];
  const type = types[Math.floor(Math.random() * types.length)];
  // Weighted rarity distribution (common more likely)
  const rarityWeights = [0.4, 0.3, 0.2, 0.08, 0.02];
  let rand = Math.random();
  let cumulative = 0;
  let rarity = 1;
  for (let i = 0; i < rarityWeights.length; i++) {
    cumulative += rarityWeights[i];
    if (rand <= cumulative) {
      rarity = i + 1;
      break;
    }
  }
  return { type, rarity, level: 1 };
}

// Express app and server
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Leaderboard endpoint
app.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Create HTTP server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Active players in memory: mapping socket.id -> game state for quick access
const activePlayers = new Map();

io.on('connection', async (socket) => {
  const { username } = socket.handshake.query;
  let name = typeof username === 'string' ? username.trim() : '';
  if (!name) {
    // generate guest username
    name = 'Guest' + Math.floor(Math.random() * 10000);
  }
  let player = await Player.findOne({ name });
  if (!player) {
    player = new Player({ name });
    player.enemyHp = calculateEnemyHp(player.stage);
    await player.save();
  }
  // attach to activePlayers
  activePlayers.set(socket.id, { player, enemyHp: player.enemyHp });
  // Send initial state
  socket.emit('INIT', {
    player: {
      name: player.name,
      stage: player.stage,
      gold: player.gold,
      crystals: player.crystals,
      maxBossLevel: player.maxBossLevel,
      prestigeLevel: player.prestigeLevel,
      maxDamage: player.maxDamage,
      totalTaps: player.totalTaps,
    },
    enemyHp: player.enemyHp,
    isBoss: isBossStage(player),
  });

  // Rate limiting config
  const TAP_INTERVAL_MS = 100; // 10 taps per second

  socket.on('PLAYER_TAP', async () => {
    const state = activePlayers.get(socket.id);
    if (!state) return;
    const p = state.player;
    const now = Date.now();
    if (p.lastTapAt && now - p.lastTapAt.getTime() < TAP_INTERVAL_MS) {
      // Too fast -> ignore (anti-cheat)
      return;
    }
    p.lastTapAt = new Date();
    p.totalTaps += 1;
    // Calculate damage
    const dmg = calculateTapDamage(p);
    // Update maxDamage
    if (dmg > p.maxDamage) p.maxDamage = dmg;
    // Reduce enemy HP
    state.enemyHp -= dmg;
    socket.emit('DAMAGE_CALCULATED', { damage: dmg, enemyHp: state.enemyHp });
    // Enemy dead?
    if (state.enemyHp <= 0) {
      const isBoss = isBossStage(p);
      // Reward
      const rewards = rewardPlayer(p, calculateEnemyHp(p.stage), isBoss);
      socket.emit('ENEMY_DEAD', {
        isBoss,
        rewards,
      });
      // Update stats
      if (isBoss && p.stage > p.maxBossLevel) {
        p.maxBossLevel = p.stage;
      }
      p.stage += 1;
      // Spawn next enemy
      state.enemyHp = calculateEnemyHp(p.stage);
      socket.emit('NEW_ENEMY', {
        enemyHp: state.enemyHp,
        isBoss: isBossStage(p),
      });
      // Item drop
      const drop = generateItemDrop();
      if (drop) {
        p.inventory.push(drop);
        socket.emit('ITEM_DROP', drop);
      }
    }
    // Persist changes asynchronously
    try {
      await p.save();
    } catch (err) {
      console.error('Error saving player:', err);
    }
  });

  socket.on('UPGRADE_APPLIED', async (data) => {
    const state = activePlayers.get(socket.id);
    if (!state) return;
    const p = state.player;
    // Example: increase tapDamage by spending gold
    const { type, cost } = data;
    if (type === 'tapDamage' && p.gold >= cost) {
      p.gold -= cost;
      p.upgrades.tapDamage = (p.upgrades.tapDamage || 1) + 1;
      socket.emit('UPGRADE_APPLIED', { type, newValue: p.upgrades.tapDamage });
      await p.save();
    }
    // Additional upgrades can be implemented here (autoTap, etc.)
  });

  socket.on('PRESTIGE_TRIGGERED', async () => {
    const state = activePlayers.get(socket.id);
    if (!state) return;
    const p = state.player;
    // Prestige resets stage and upgrades; awards crystals
    const awardedCrystals = Math.floor(p.stage / 10);
    p.prestigeLevel += 1;
    p.crystals += awardedCrystals;
    p.stage = 1;
    p.upgrades = {};
    p.inventory = [];
    state.enemyHp = calculateEnemyHp(p.stage);
    socket.emit('PRESTIGE_TRIGGERED', { crystals: awardedCrystals });
    socket.emit('NEW_ENEMY', { enemyHp: state.enemyHp, isBoss: isBossStage(p) });
    await p.save();
  });

  socket.on('disconnect', () => {
    activePlayers.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`TAPTAP BOSS server listening on port ${PORT}`);
});