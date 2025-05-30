export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { action, data } = req.body || {};

    if (action === 'openChest') {
      return openChest(res, data);
    }
    
    if (action === 'getLeaderboard') {
      return getLeaderboard(res);
    }
    
    if (action === 'saveScore') {
      return saveScore(res, data);
    }

    return res.status(400).json({ error: 'Acción no válida' });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Base de datos simulada (en memoria)
const leaderboard = [
  { name: 'Aventurero Demo', score: 150, timestamp: Date.now() },
  { name: 'Explorador', score: 89, timestamp: Date.now() - 3600000 }
];

function openChest(res, data) {
  const { chestType = 'common' } = data || {};
  
  // Configuración de cofres
  const chests = {
    common: {
      cost: 10,
      rewards: [
        { item: '🪙 Moneda de Cobre', value: 5, probability: 0.4, rarity: 'common' },
        { item: '💎 Gema Pequeña', value: 15, probability: 0.3, rarity: 'common' },
        { item: '🧪 Poción de Vida', value: 25, probability: 0.2, rarity: 'uncommon' },
        { item: '⚔️ Espada de Hierro', value: 50, probability: 0.08, rarity: 'rare' },
        { item: '🛡️ Armadura Mágica', value: 100, probability: 0.02, rarity: 'legendary' }
      ]
    },
    rare: {
      cost: 50,
      rewards: [
        { item: '🥈 Moneda de Plata', value: 25, probability: 0.3, rarity: 'common' },
        { item: '🔮 Cristal Mágico', value: 75, probability: 0.25, rarity: 'uncommon' },
        { item: '⚔️ Espada Encantada', value: 150, probability: 0.2, rarity: 'rare' },
        { item: '💍 Anillo de Poder', value: 300, probability: 0.15, rarity: 'epic' },
        { item: '👑 Corona del Rey', value: 500, probability: 0.08, rarity: 'legendary' },
        { item: '🌟 Orbe del Destino', value: 1000, probability: 0.02, rarity: 'mythic' }
      ]
    },
    legendary: {
      cost: 200,
      rewards: [
        { item: '🥇 Moneda de Oro', value: 100, probability: 0.25, rarity: 'uncommon' },
        { item: '✨ Fragmento Divino', value: 250, probability: 0.2, rarity: 'rare' },
        { item: '🗡️ Espada Legendaria', value: 500, probability: 0.2, rarity: 'epic' },
        { item: '🛡️ Armadura Celestial', value: 750, probability: 0.15, rarity: 'legendary' },
        { item: '🔮 Báculo del Tiempo', value: 1500, probability: 0.15, rarity: 'mythic' },
        { item: '⚡ Reliquia Ancestral', value: 3000, probability: 0.05, rarity: 'divine' }
      ]
    }
  };

  const chest = chests[chestType];
  if (!chest) {
    return res.status(400).json({ error: 'Tipo de cofre no válido' });
  }

  // Generar recompensa aleatoria
  const random = Math.random();
  let cumulative = 0;
  let reward = null;

  for (const r of chest.rewards) {
    cumulative += r.probability;
    if (random <= cumulative) {
      reward = r;
      break;
    }
  }

  // Fallback si no se encontró recompensa
  if (!reward) {
    reward = chest.rewards[0];
  }

  // Probabilidad de suerte (10%)
  const isLucky = Math.random() < 0.1;
  const finalValue = reward.value * (isLucky ? 2 : 1);

  const result = {
    success: true,
    reward: {
      ...reward,
      value: finalValue,
      isLucky: isLucky
    },
    chestCost: chest.cost,
    netGain: finalValue - chest.cost
  };

  return res.status(200).json(result);
}

function getLeaderboard(res) {
  const sorted = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      score: entry.score,
      timestamp: entry.timestamp
    }));

  return res.status(200).json({
    success: true,
    leaderboard: sorted
  });
}

function saveScore(res, data) {
  const { playerName, score } = data || {};
  
  if (!playerName || typeof score !== 'number') {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  leaderboard.push({
    name: playerName.substring(0, 20),
    score: Math.max(0, Math.floor(score)),
    timestamp: Date.now()
  });

  return res.status(200).json({
    success: true,
    message: 'Puntuación guardada'
  });
}