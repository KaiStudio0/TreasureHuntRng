// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura-rng-game';

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' }
});
app.use('/api/', limiter);

// Roll rate limiting (more restrictive)
const rollLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 rolls per minute max
    message: { error: 'Demasiados rolls, espera un momento.' }
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('📦 Conectado a MongoDB'))
.catch(err => console.error('❌ Error conectando a MongoDB:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    gameState: {
        coins: { type: Number, default: 1000 },
        luck: { type: Number, default: 1.0 },
        totalRolls: { type: Number, default: 0 },
        starterBundleClaimed: { type: Boolean, default: false },
        permanentLuckBonus: { type: Number, default: 0 },
        lastDailyReward: { type: Date, default: null },
        streakDays: { type: Number, default: 0 }
    },
    auras: [{
        name: String,
        rarity: String,
        value: Number,
        color: String,
        minValue: Number,
        maxValue: Number,
        obtainedAt: { type: Date, default: Date.now },
        id: String
    }],
    achievements: [{
        id: String,
        name: String,
        description: String,
        unlockedAt: { type: Date, default: Date.now },
        reward: {
            coins: Number,
            luck: Number
        }
    }],
    activePotions: [{
        multiplier: Number,
        endTime: Date,
        type: String
    }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    totalPlayTime: { type: Number, default: 0 },
    highestValueAura: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Leaderboard Schema
const leaderboardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    category: { type: String, required: true }, // 'highest_aura', 'total_rolls', 'total_coins'
    value: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

// Aura definitions (same as frontend)
const auras = [
    // Common (1-100)
    {name: "Brisa Común", rarity: "Common", minValue: 1, maxValue: 100, color: "#95a5a6", chance: 40},
    {name: "Luz Básica", rarity: "Common", minValue: 1, maxValue: 100, color: "#95a5a6", chance: 35},
    
    // Rare (101-1000)  
    {name: "Viento Azul", rarity: "Rare", minValue: 101, maxValue: 1000, color: "#3498db", chance: 15},
    {name: "Chispa Eléctrica", rarity: "Rare", minValue: 101, maxValue: 1000, color: "#3498db", chance: 12},
    
    // Epic (1001-10000)
    {name: "Llama Púrpura", rarity: "Epic", minValue: 1001, maxValue: 10000, color: "#9b59b6", chance: 8},
    {name: "Cristal Místico", rarity: "Epic", minValue: 1001, maxValue: 10000, color: "#9b59b6", chance: 6},
    
    // Legendary (10001-100000)
    {name: "Oro Radiante", rarity: "Legendary", minValue: 10001, maxValue: 100000, color: "#f39c12", chance: 3},
    {name: "Fénix Dorado", rarity: "Legendary", minValue: 10001, maxValue: 100000, color: "#f39c12", chance: 2},
    
    // Mythic (100001-1000000)
    {name: "Dragón Carmesí", rarity: "Mythic", minValue: 100001, maxValue: 1000000, color: "#e74c3c", chance: 1},
    {name: "Tormenta Eterna", rarity: "Mythic", minValue: 100001, maxValue: 1000000, color: "#e74c3c", chance: 0.8},
    
    // Divine (1000001-100000000)
    {name: "Aurora Divina", rarity: "Divine", minValue: 1000001, maxValue: 100000000, color: "#fd79a8", chance: 0.5},
    {name: "Estrella Celestial", rarity: "Divine", minValue: 1000001, maxValue: 100000000, color: "#fd79a8", chance: 0.3},
    
    // Celestial (100000001-1000000000)
    {name: "Galaxia Infinita", rarity: "Celestial", minValue: 100000001, maxValue: 1000000000, color: "#00cec9", chance: 0.1},
    {name: "Cosmos Eterno", rarity: "Celestial", minValue: 100000001, maxValue: 1000000000, color: "#00cec9", chance: 0.08},
    
    // Transcendent (1000000001+)
    {name: "Omnipresencia", rarity: "Transcendent", minValue: 1000000001, maxValue: 10000000000, color: "#6c5ce7", chance: 0.05},
    {name: "Realidad Absoluta", rarity: "Transcendent", minValue: 1000000001, maxValue: 10000000000, color: "#6c5ce7", chance: 0.03},
    
    // Omnipotent (10000000001+)
    {name: "DIOS SUPREMO", rarity: "Omnipotent", minValue: 10000000001, maxValue: 100000000000, color: "#ffd700", chance: 0.01},
    {name: "CREADOR UNIVERSAL", rarity: "Omnipotent", minValue: 10000000001, maxValue: 100000000000, color: "#ffd700", chance: 0.005}
];

// Achievements definitions
const achievements = [
    { id: 'first_roll', name: 'Primer Roll', description: 'Realiza tu primer roll', trigger: 'roll_count', value: 1, reward: { coins: 100, luck: 0.1 }},
    { id: 'roll_master', name: 'Maestro del Roll', description: 'Realiza 100 rolls', trigger: 'roll_count', value: 100, reward: { coins: 1000, luck: 0.5 }},
    { id: 'roll_legend', name: 'Leyenda del Roll', description: 'Realiza 1000 rolls', trigger: 'roll_count', value: 1000, reward: { coins: 10000, luck: 1.0 }},
    { id: 'first_rare', name: 'Primera Rareza', description: 'Obtén tu primera aura rara o superior', trigger: 'aura_rarity', value: 'Rare', reward: { coins: 500, luck: 0.2 }},
    { id: 'millionaire', name: 'Millonario', description: 'Obtén un aura de valor 1,000,000+', trigger: 'aura_value', value: 1000000, reward: { coins: 5000, luck: 2.0 }},
    { id: 'collector', name: 'Coleccionista', description: 'Posee 50 auras', trigger: 'aura_count', value: 50, reward: { coins: 2000, luck: 0.8 }}
];

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};

// Helper functions
const calculateTotalLuck = (user) => {
    let totalLuck = user.gameState.luck + user.gameState.permanentLuckBonus;
    
    // Add active potions
    const now = new Date();
    user.activePotions = user.activePotions.filter(potion => potion.endTime > now);
    
    user.activePotions.forEach(potion => {
        totalLuck += potion.multiplier;
    });
    
    return totalLuck;
};

const performRoll = (totalLuck) => {
    // Calculate weighted chances based on luck
    let weightedAuras = auras.map(aura => ({
        ...aura,
        adjustedChance: aura.chance * (aura.chance < 1 ? totalLuck : Math.sqrt(totalLuck))
    }));
    
    const totalWeight = weightedAuras.reduce((sum, aura) => sum + aura.adjustedChance, 0);
    let random = Math.random() * totalWeight;
    
    for (let aura of weightedAuras) {
        random -= aura.adjustedChance;
        if (random <= 0) {
            const value = Math.floor(Math.random() * (aura.maxValue - aura.minValue + 1)) + aura.minValue;
            return {
                ...aura,
                value: value,
                id: Date.now() + Math.random(),
                obtainedAt: new Date()
            };
        }
    }
    
    // Fallback
    const fallbackAura = weightedAuras[0];
    const value = Math.floor(Math.random() * (fallbackAura.maxValue - fallbackAura.minValue + 1)) + fallbackAura.minValue;
    return {
        ...fallbackAura,
        value: value,
        id: Date.now() + Math.random(),
        obtainedAt: new Date()
    };
};

const checkAchievements = async (user) => {
    const newAchievements = [];
    
    for (const achievement of achievements) {
        // Check if user already has this achievement
        if (user.achievements.some(a => a.id === achievement.id)) continue;
        
        let shouldUnlock = false;
        
        switch (achievement.trigger) {
            case 'roll_count':
                shouldUnlock = user.gameState.totalRolls >= achievement.value;
                break;
            case 'aura_rarity':
                shouldUnlock = user.auras.some(aura => 
                    ['Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'Celestial', 'Transcendent', 'Omnipotent']
                    .includes(aura.rarity)
                );
                break;
            case 'aura_value':
                shouldUnlock = user.highestValueAura >= achievement.value;
                break;
            case 'aura_count':
                shouldUnlock = user.auras.length >= achievement.value;
                break;
        }
        
        if (shouldUnlock) {
            user.achievements.push({
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                unlockedAt: new Date(),
                reward: achievement.reward
            });
            
            // Apply rewards
            user.gameState.coins += achievement.reward.coins || 0;
            user.gameState.permanentLuckBonus += achievement.reward.luck || 0;
            
            newAchievements.push(achievement);
        }
    }
    
    return newAchievements;
};

const updateLeaderboard = async (user) => {
    const categories = [
        { name: 'highest_aura', value: user.highestValueAura },
        { name: 'total_rolls', value: user.gameState.totalRolls },
        { name: 'total_coins', value: user.gameState.coins }
    ];
    
    for (const category of categories) {
        await Leaderboard.findOneAndUpdate(
            { userId: user._id, category: category.name },
            { 
                username: user.username, 
                value: category.value, 
                updatedAt: new Date() 
            },
            { upsert: true }
        );
    }
};

// Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'El nombre de usuario debe tener entre 3 y 20 caracteres' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario o email ya existe' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'Usuario creado exitosamente',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                gameState: user.gameState
            }
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        
        // Find user
        const user = await User.findOne({
            $or: [{ email: username }, { username: username }]
        });
        
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                gameState: user.gameState,
                auras: user.auras,
                achievements: user.achievements
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Game Routes
app.get('/api/game/state', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        // Clean expired potions
        const now = new Date();
        user.activePotions = user.activePotions.filter(potion => potion.endTime > now);
        await user.save();
        
        res.json({
            gameState: user.gameState,
            auras: user.auras,
            achievements: user.achievements,
            activePotions: user.activePotions,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error obteniendo estado:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/game/roll', [authenticateToken, rollLimiter], async (req, res) => {
    try {
        const user = req.user;
        const rollCost = 50;
        
        if (user.gameState.coins < rollCost) {
            return res.status(400).json({ error: 'No tienes suficientes monedas' });
        }
        
        // Deduct coins and increment roll count
        user.gameState.coins -= rollCost;
        user.gameState.totalRolls += 1;
        
        // Perform roll
        const totalLuck = calculateTotalLuck(user);
        const newAura = performRoll(totalLuck);
        
        // Add aura to user's collection
        user.auras.push(newAura);
        
        // Add coin reward based on aura value
        const coinReward = Math.floor(newAura.value / 10);
        user.gameState.coins += coinReward;
        
        // Update highest value aura
        if (newAura.value > user.highestValueAura) {
            user.highestValueAura = newAura.value;
        }
        
        // Check for achievements
        const newAchievements = await checkAchievements(user);
        
        // Save user
        await user.save();
        
        // Update leaderboard
        await updateLeaderboard(user);
        
        res.json({
            aura: newAura,
            coinReward,
            newAchievements,
            gameState: user.gameState,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error en roll:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/game/quick-roll', [authenticateToken, rollLimiter], async (req, res) => {
    try {
        const user = req.user;
        const rollCost = 500;
        const rollCount = 10;
        
        if (user.gameState.coins < rollCost) {
            return res.status(400).json({ error: 'No tienes suficientes monedas para Quick Roll' });
        }
        
        // Deduct coins and increment roll count
        user.gameState.coins -= rollCost;
        user.gameState.totalRolls += rollCount;
        
        // Perform multiple rolls
        const totalLuck = calculateTotalLuck(user);
        const results = [];
        let totalCoinReward = 0;
        
        for (let i = 0; i < rollCount; i++) {
            const newAura = performRoll(totalLuck);
            user.auras.push(newAura);
            results.push(newAura);
            
            const coinReward = Math.floor(newAura.value / 10);
            totalCoinReward += coinReward;
            
            if (newAura.value > user.highestValueAura) {
                user.highestValueAura = newAura.value;
            }
        }
        
        user.gameState.coins += totalCoinReward;
        
        // Check for achievements
        const newAchievements = await checkAchievements(user);
        
        // Save user
        await user.save();
        
        // Update leaderboard
        await updateLeaderboard(user);
        
        // Find best result
        const bestResult = results.reduce((best, current) => 
            current.value > best.value ? current : best
        );
        
        res.json({
            results,
            bestResult,
            totalCoinReward,
            newAchievements,
            gameState: user.gameState,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error en quick roll:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Shop Routes
app.post('/api/shop/luck-upgrade', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { luckIncrease, cost } = req.body;
        
        if (!luckIncrease || !cost || luckIncrease <= 0 || cost <= 0) {
            return res.status(400).json({ error: 'Parámetros inválidos' });
        }
        
        if (user.gameState.coins < cost) {
            return res.status(400).json({ error: 'No tienes suficientes monedas' });
        }
        
        user.gameState.coins -= cost;
        user.gameState.permanentLuckBonus += luckIncrease;
        
        await user.save();
        
        res.json({
            message: `Mejora de suerte comprada: +${luckIncrease}x`,
            gameState: user.gameState,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error comprando mejora:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/shop/potion', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { multiplier, duration, cost, type } = req.body;
        
        if (!multiplier || !duration || !cost || !type) {
            return res.status(400).json({ error: 'Parámetros inválidos' });
        }
        
        if (user.gameState.coins < cost) {
            return res.status(400).json({ error: 'No tienes suficientes monedas' });
        }
        
        user.gameState.coins -= cost;
        
        // Add potion effect
        user.activePotions.push({
            multiplier,
            endTime: new Date(Date.now() + duration),
            type
        });
        
        await user.save();
        
        res.json({
            message: `Poción activada: +${multiplier}x suerte por ${duration/1000}s`,
            gameState: user.gameState,
            activePotions: user.activePotions,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error comprando poción:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.post('/api/shop/starter-bundle', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        if (user.gameState.starterBundleClaimed) {
            return res.status(400).json({ error: 'Starter bundle ya reclamado' });
        }
        
        user.gameState.coins += 1000;
        user.gameState.permanentLuckBonus += 0.5;
        user.gameState.starterBundleClaimed = true;
        
        // Add free potion
        user.activePotions.push({
            multiplier: 2,
            endTime: new Date(Date.now() + 60000),
            type: 'starter'
        });
        
        await user.save();
        
        res.json({
            message: 'Starter Bundle reclamado!',
            gameState: user.gameState,
            activePotions: user.activePotions,
            totalLuck: calculateTotalLuck(user)
        });
    } catch (error) {
        console.error('Error reclamando starter bundle:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Daily reward route
app.post('/api/game/daily-reward', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const now = new Date();
        const lastReward = user.gameState.lastDailyReward;
        
        // Check if 24 hours have passed
        if (lastReward && (now - lastReward) < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - lastReward);
            return res.status(400).json({ 
                error: 'Recompensa diaria ya reclamada',
                timeLeft: Math.ceil(timeLeft / 1000)
            });
        }
        
        // Calculate streak
        if (lastReward && (now - lastReward) < 48 * 60 * 60 * 1000) {
            user.gameState.streakDays += 1;
        } else {
            user.gameState.streakDays = 1;
        }
        
        // Calculate reward based on streak
        const baseReward = 100;
        const streakMultiplier = Math.min(user.gameState.streakDays, 7);
        const coinReward = baseReward * streakMultiplier;
        
        user.gameState.coins += coinReward;
        user.gameState.lastDailyReward = now;
        
        await user.save();
        
        res.json({
            message: `Recompensa diaria reclamada! +${coinReward} monedas`,
            coinReward,
            streakDays: user.gameState.streakDays,
            gameState: user.gameState
        });
    } catch (error) {
        console.error('Error en recompensa diaria:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Leaderboard Routes
app.get('/api/leaderboard/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const validCategories = ['highest_aura', 'total_rolls', 'total_coins'];
        
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Categoría inválida' });
        }
        
        const leaderboard = await Leaderboard
            .find({ category })
            .sort({ value: -1 })
            .limit(100)
            .select('username value updatedAt');
        
        res.json(leaderboard);
    } catch (error) {
        console.error('Error obteniendo leaderboard:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// User profile route
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        // Calculate statistics
        const stats = {
            totalAuras: user.auras.length,
            highestValueAura: user.highestValueAura,
            totalRolls: user.gameState.totalRolls,
            totalCoins: user.gameState.coins,
            achievementsUnlocked: user.achievements.length,
            streakDays: user.gameState.streakDays,
            memberSince: user.createdAt,
            lastLogin: user.lastLogin
        };
        
        // Get rarity distribution
        const rarityCount = {};
        user.auras.forEach(aura => {
            rarityCount[aura.rarity] = (rarityCount[aura.rarity] || 0) + 1;
        });
        
        res.json({
            username: user.username,
            email: user.email,
            stats,
            rarityCount,
            achievements: user.achievements
        });
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: '
