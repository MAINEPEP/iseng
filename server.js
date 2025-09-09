const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

// In-memory data
let products = [
  { id: 1, name: "Produk A", price: 100000, image: "/images/prod1.jpg" },
  { id: 2, name: "Produk B", price: 150000, image: "/images/prod2.jpg" }
];

// Telegram bot config (2 bots, 2 chat IDs)
let telegramBots = [
  { token: "8315098365:AAEWtZiyDJF-0QhNFgr98MNaAbUE37ADYAs", chatId: "6616319071" },
  { token: "", chatId: "" }
];

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
  secret: 'zurzensecret',
  resave: false,
  saveUninitialized: true
}));

// Middleware auth for admin
function authAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Login admin
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === "ZURZEN" && password === "ADMIN123") {
    req.session.admin = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid credentials" });
  }
});

// Logout admin
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Add product (admin)
app.post('/api/admin/products', authAdmin, (req, res) => {
  const { name, price, image } = req.body;
  if (!name || !price || !image) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const id = products.length ? products[products.length - 1].id + 1 : 1;
  products.push({ id, name, price, image });
  res.json({ success: true, products });
});

// Update product (admin)
app.put('/api/admin/products/:id', authAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, price, image } = req.body;
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (name) product.name = name;
  if (price) product.price = price;
  if (image) product.image = image;
  res.json({ success: true, product });
});

// Get telegram bots config (admin)
app.get('/api/admin/telegram', authAdmin, (req, res) => {
  res.json(telegramBots);
});

// Update telegram bots config (admin)
app.post('/api/admin/telegram', authAdmin, (req, res) => {
  const bots = req.body;
  if (!Array.isArray(bots) || bots.length !== 2) {
    return res.status(400).json({ error: "Invalid bots config" });
  }
  telegramBots = bots;
  res.json({ success: true });
});

// Send message to Telegram bot
async function sendTelegramMessage(token, chatId, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
  return res.json();
}

// Endpoint to send chat message to CS via Telegram bot
app.post('/api/chatcs', async (req, res) => {
  const { botIndex, message } = req.body;
  if (botIndex !== 0 && botIndex !== 1) {
    return res.status(400).json({ error: "Invalid bot index" });
  }
  const bot = telegramBots[botIndex];
  if (!bot.token || !bot.chatId) {
    return res.status(400).json({ error: "Bot token or chatId not configured" });
  }
  try {
    await sendTelegramMessage(bot.token, bot.chatId, message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Endpoint to handle purchase order, send to all telegram bots
app.post('/api/purchase', async (req, res) => {
  const { whatsapp, productId, quantity } = req.body;
  if (!whatsapp || !productId || !quantity) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const product = products.find(p => p.id === productId);
  if (!product) return res.status(400).json({ error: "Product not found" });

  const message = `Order baru:\nProduk: ${product.name}\nJumlah: ${quantity}\nNomor WhatsApp: ${whatsapp}`;

  try {
    for (const bot of telegramBots) {
      if (bot.token && bot.chatId) {
        await sendTelegramMessage(bot.token, bot.chatId, message);
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to send order" });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
