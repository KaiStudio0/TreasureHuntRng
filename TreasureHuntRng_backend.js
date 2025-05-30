// api/game.js - Vercel Serverless Function
export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { action, data } = req.body;

    switch (action) {
      case 'openChest':
        return handleOpenChest(req, res, data);
      case 'getLeaderboard':
        return handleGetLeaderboard(req, res);
      case 'saveScore':
        return handleSaveScore(req, res, data);
      default:
        return res.status(400).json({ error: 'Acción no válida' });
    }
  }

  res.status(405).json({ error: 'Método no permitido' });
}

// Simulamos una base de datos simple con un array en memoria
// En producción usarías una base de datos real
let leaderboard = [
  { name: 'Jugador Demo', score: 150, timestamp: Date.now() },
  { name: 'Explorer', score: 89, timestamp: Date.now() - 3600000 },
  { name: 'Treasure Hunter', score: 234, timestamp: Date.now() - 7200000 }
];

function handleOpenChest(req, res, data) {
  const { chestType = 'common' } = data || {};
  
  // Definir probabilidades y recompensas para cada tipo de cofre
  const chestConfig = {
    common: {
      cost: 10,
      rewards: [
        { item: 'Moneda de Cobre', value: 5, probability: 0.4, rarity: 'common' },
        { item: 'Gema Pequeña', value: 15, probability: 0.3, rarity: 'common' },
        { item: 'Poción de Vida', value: 25, probability: 0.2, rarity: 'uncommon' },
        { item: 'Espada de Hierro', value: 50, probability: 0.08, rarity: 'rare' },
        { item: 'Armadura Mágica', value: 100, probability: 0.02, rarity: 'legendary' }
      ]
    },
    rare: {
      cost: 50,
      rewards: [
        { item: 'Moneda de Plata', value: 25, probability: 0.3, rarity: 'common' },
        { item: 'Cristal Mágico', value: 75, probability: 0.25, rarity: 'uncommon' },
        { item: 'Espada Encantada', value: 150, probability: 0.2, rarity: 'rare' },
        { item: 'Anillo de Poder', value: 300, probability: 0.15, rarity: 'epic' },
        { item: 'Corona del Rey', value: 500, probability: 0.08, rarity: 'legendary' },
        { item: 'Orbe del Destino', value: 1000, probability: 0.02, rarity: 'mythic' }
      ]
    },
    legendary: {
      cost: 200,
      rewards: [
        { item: 'Moneda de Oro', value: 100, probability: 0.25, rarity: 'uncommon' },
        { item: 'Fragmento Divino', value: 250, probability: 0.2, rarity: 'rare' },
        { item: 'Espada Legendaria', value: 500, probability: 0.2, rarity: 'epic' },
        { item: 'Armadura Celestial', value: 750, probability: 0.15, rarity: 'legendary' },
        { item: 'Báculo del Tiempo', value: 1500, probability: 0.15, rarity: 'mythic' },
        { item: 'Reliquia Ancestral', value: 3000, probability: 0.05, rarity: 'divine' }
      ]
    }
  };

  const config = chestConfig[chestType];
  if (!config) {
    return res.status(400).json({ error: 'Tipo de cofre no válido' });
  }

  // Generar número aleatorio y determinar recompensa
  const random = Math.random();
  let cumulativeProbability = 0;
  let selectedReward = null;

  for (const reward of config.rewards) {
    cumulativeProbability += reward.probability;
    if (random <= cumulativeProbability) {
      selectedReward = reward;
      break;
    }
  }

  // Si no se seleccionó ninguna recompensa, dar la última como fallback
  if (!selectedReward) {
    selectedReward = config.rewards[config.rewards.length - 1];
  }

  // Calcular multiplicador de suerte
  const luckMultiplier = Math.random() < 0.1 ? 2 : 1; // 10% de probabilidad de doble recompensa
  const finalValue = selectedReward.value * luckMultiplier;

  const result = {
    success: true,
    reward: {
      ...selectedReward,
      value: finalValue,
      isLucky: luckMultiplier > 1
    },
    chestCost: config.cost,
    netGain: finalValue - config.cost
  };

  res.status(200).json(result);
}

function handleGetLeaderboard(req, res) {
  // Ordenar por puntuación descendente y tomar los top 10
  const sortedLeaderboard = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      score: entry.score,
      timestamp: entry.timestamp
    }));

  res.status(200).json({
    success: true,
    leaderboard: sortedLeaderboard
  });
}

function handleSaveScore(req, res, data) {
  const { playerName, score } = data || {};
  
  if (!playerName || typeof score !== 'number') {
    return res.status(400).json({ error: 'Nombre y puntuación requeridos' });
  }

  // Agregar nueva puntuación
  leaderboard.push({
    name: playerName.substring(0, 20), // Limitar longitud del nombre
    score: Math.max(0, Math.floor(score)), // Asegurar que sea un número positivo entero
    timestamp: Date.now()
  });

  // Mantener solo los últimos 100 registros para evitar que crezca indefinidamente
  if (leaderboard.length > 100) {
    leaderboard = leaderboard
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  }

  res.status(200).json({
    success: true,
    message: 'Puntuación guardada exitosamente'
  });
}