const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors'); // agregado para permitir acceso remoto desde la app
require('dotenv').config();

// =======================
// CONFIGURACIÓN GENERAL
// =======================

const TOKEN = process.env.TOKEN;
const ESP8266_IP = process.env.ESP8266_IP;
const ESP32CAM_IP = process.env.ESP32CAM_IP;

// =======================
// BOT DE DISCORD
// =======================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('clientReady', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const cmd = message.content.trim().toLowerCase(); // normaliza a minúsculas

  // Lista de comandos válidos
  const comandosValidos = [
    'f','b','l','r','i','g','j','h','s',
    '/f','/b','/l','/r','/i','/g','/j','/h','/s',
    '0','1','2','3','4','5','6','7','8','9',
    'encender luces','apagar luces','encender cooler','apagar cooler'
  ];

  if (comandosValidos.includes(cmd)) {
    try {
      // Enviar al ESP8266
      await axios.get(`${ESP8266_IP}/?State=${encodeURIComponent(cmd)}`);
      message.reply(`✅ Comando enviado: ${cmd}`);
    } catch (error) {
      message.reply(`❌ Error al conectar con ESP8266`);
      console.error(`Error al enviar comando ${cmd}:`, error.message);
    }
  } else {
    message.reply(`⚠️ Comando no reconocido: ${cmd}`);
  }
});

client.login(TOKEN);

// =======================
// SERVIDOR EXPRESS PARA ESP32-CAM
// =======================

const app = express();
app.use(cors()); // habilita CORS para acceso desde cualquier origen
app.use(express.json()); // asegura que pueda leer JSON

// Ruta pública para retransmitir el stream MJPEG
app.use('/cam', createProxyMiddleware({
  target: ESP32CAM_IP,
  changeOrigin: true,
  pathRewrite: {
    '^/cam': '/stream',
  },
  onError: (err, req, res) => {
    console.error('❌ Error al conectar con ESP32-CAM:', err.message);
    res.status(502).send('Error al conectar con ESP32-CAM');
  }
}));

// Página de prueba para visualizar el stream
app.get('/', (req, res) => {
  res.send(`
    <h1>📡 Stream de ESP32-CAM</h1>
    <img src="/cam" style="width: 100%; max-width: 640px;" />
  `);
});

// Ruta de estado para verificar conectividad
app.get('/status', async (req, res) => {
  const status = {
    ESP8266: 'Desconocido',
    ESP32CAM: 'Desconocido'
  };

  try {
    await axios.get(`${ESP8266_IP}`);
    status.ESP8266 = 'Conectado';
  } catch {
    status.ESP8266 = 'No responde';
  }

  try {
    await axios.get(`${ESP32CAM_IP}/stream`);
    status.ESP32CAM = 'Conectado';
  } catch {
    status.ESP32CAM = 'No responde';
  }

  res.json(status);
});

// Ruta para recibir comandos desde App Inventor
app.post('/comando', async (req, res) => {
  const { cmd } = req.body;

  const comandosValidos = [
    'f','b','l','r','i','g','j','h','s',
    '/f','/b','/l','/r','/i','/g','/j','/h','/s',
    '0','1','2','3','4','5','6','7','8','9',
    'encender luces','apagar luces','encender cooler','apagar cooler'
  ];

  if (!comandosValidos.includes(cmd)) {
    return res.status(400).send({ error: 'Comando inválido' });
  }

  try {
    await axios.get(`${ESP8266_IP}/?State=${encodeURIComponent(cmd)}`);
    res.send({ status: 'ok', enviado: cmd });
  } catch (error) {
    console.error(`Error al enviar comando ${cmd}:`, error.message);
    res.status(500).send({ error: 'Error al conectar con ESP8266' });
  }
});

// =======================
// INICIO DEL SERVIDOR
// =======================

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌐 Servidor web activo en puerto ${port}`);
});