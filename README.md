# TAPTAP&nbsp;BOSS

TAPTAP BOSS is a real‑time idle clicker RPG designed for web browsers with a mobile‑first 9:16 aspect ratio. Built from the ground up with no copyrighted assets or borrowed mechanics, it features an infinite boss‑fighting loop, upgrade and prestige systems, and a dark neon fantasy aesthetic. The entire system is server‑authoritative to prevent cheating and provide a consistent multiplayer‑ready experience.

## 🎮 Game Overview

- **Platform:** Web (responsive mobile layout)
- **Engine:** Node.js + Socket.IO real‑time server
- **Gameplay loop:** Tap to attack → Server calculates damage → Enemy HP reduces → Rewards and drops → New enemy/boss spawns
- **Bosses:** Infinite waves with periodic bosses and multi‑phase encounters
- **Upgrades & Economy:** Spend gold on tap damage upgrades; spend crystals on future skill tree; equipment system with fusion of duplicate items
- **Prestige:** Reset progress to gain crystals and increase long‑term power
- **Anti‑cheat:** Server‑side validation, tap rate limiting, DPS anomaly detection and state reconciliation

## 🧱 Tech Stack

| Layer          | Technology                                                  |
|---------------|-------------------------------------------------------------|
| Frontend      | Plain HTML, CSS (dark neon UI), Vanilla JS, Socket.IO client |
| Backend       | Node.js, Express, Socket.IO, MongoDB (Mongoose), Redis‑ready cache |
| Deployment    | Frontend → Vercel. Backend → Render (or custom VPS)         |
| CI/CD         | GitHub Actions for build, basic validation and deployment    |

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **MongoDB** instance (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- Optional: **Redis** for leaderboard caching

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/TCetintasss/taptapboss.git
   cd taptapboss
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and set your environment variables:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/taptapboss
   REDIS_URL=redis://localhost:6379 # optional
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`. The frontend is served from `frontend/index.html`.

## 🧠 Architecture

The system follows a **server‑authoritative model**:

1. The client connects via Socket.IO and requests game state.
2. All tap actions and upgrades are sent to the server as events.
3. The server validates input, computes damage, updates HP, spawns enemies/bosses and distributes rewards.
4. The server persists player state to MongoDB and caches leaderboard data in memory (or Redis).
5. The client receives real‑time updates (damage, new enemy, item drops) and updates its UI accordingly.

### Socket Event Flow

| Event                | Direction | Purpose                                                        |
|----------------------|----------|----------------------------------------------------------------|
| `INIT`               | Server→Client | Sends initial player stats, current stage and enemy HP          |
| `PLAYER_TAP`         | Client→Server | Player tapped; server calculates damage and validates rate      |
| `DAMAGE_CALCULATED`  | Server→Client | Returns damage amount and updated enemy HP                     |
| `ENEMY_DEAD`         | Server→Client | Notifies that current enemy or boss is defeated; includes rewards |
| `NEW_ENEMY`          | Server→Client | Sends new enemy HP and boss flag                               |
| `ITEM_DROP`          | Server→Client | Announces an item drop with type and rarity                    |
| `UPGRADE_APPLIED`    | Both ways | Client requests an upgrade; server responds with new value      |
| `PRESTIGE_TRIGGERED` | Both ways | Player prestiges; server resets progress and awards crystals    |

### Leaderboard System

The `/leaderboard` endpoint returns the top players sorted by `maxBossLevel`, `prestigeLevel` and `maxDamage`. Leaderboard data is cached in memory for 10 minutes to prevent polling spam. If you have a Redis instance, you can adapt the `getLeaderboard` helper in `backend/index.js` to store and retrieve cached entries from Redis.

## 🔒 Anti‑Cheat & Security

- **Rate limiting:** The server ignores taps faster than once every 100 ms (10 taps/sec).
- **Server authoritative:** All damage calculations and drops occur on the server; the client never trusts its own state.
- **DPS anomaly detection:** The server tracks `maxDamage` and can compare current DPS against expected values to flag suspicious activity (logic to be extended).
- **State reconciliation:** On reconnect, the client receives the server‑trusted state and updates accordingly.

## 🗄️ File Structure

```
taptapboss/
├── backend/         # Node.js + Express + Socket.IO server
│   └── index.js
├── frontend/        # Static frontend assets
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── package.json
└── README.md
```

## ☁️ Deployment

### Frontend (Vercel)

The GitHub Actions workflow uses the `amondnet/vercel-action` to deploy the `frontend` directory to Vercel. To enable this, create the following secrets in your repository settings:

- `VERCEL_TOKEN` – A personal token from Vercel
- `VERCEL_ORG_ID` – Your Vercel organization ID
- `VERCEL_PROJECT_ID` – The project ID associated with this site

### Backend (Render)

The backend can be hosted on [Render](https://render.com) or any VPS. The example workflow triggers a deployment via the `swillson/render-deploy` action. Create these secrets:

- `RENDER_API_KEY` – Your Render API token
- `RENDER_SERVICE_ID` – The ID of your Render service

### Environment Variables

When deploying to production, set the following environment variables in your deployment provider:

- `PORT` – The port for the Express server (Render sets this automatically)
- `MONGODB_URI` – Connection string to your MongoDB Atlas cluster
- `REDIS_URL` – (Optional) Redis instance URL for caching

## 🏷️ Semantic Versioning

This project uses [semantic versioning](https://semver.org/). Update the `version` field in `package.json` when releasing:

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward‑compatible manner
- **PATCH** version when you make backward‑compatible bug fixes

Example version history:

- `v1.0.0` – Initial engine and core gameplay loop
- `v1.1.0` – Added shop system
- `v1.2.0` – Implemented multiplayer raids (future)

## 🧩 Future Improvements

- **Shared boss raids:** Room‑based Socket.IO system for cooperative boss fights
- **Skill tree:** Deeper customization using crystals
- **Clans and social features**
- **Enhanced anti‑cheat:** Statistical analysis of player behaviour
- **Visual polish:** More animations, particle effects and responsive layouts

Contributions are welcome! Feel free to fork and submit pull requests.