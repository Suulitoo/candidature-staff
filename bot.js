require('dotenv').config(); // toujours en haut

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require("discord.js");
const crypto = require("crypto");
const { Pool } = require("pg");

// ───────── Variables d'environnement ─────────
const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim();
const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID?.trim();
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const EXPIRATION_HOURS = 72;

if (!DISCORD_TOKEN || !STAFF_CHANNEL_ID || !DATABASE_URL) {
  console.error("❌ Variables d'environnement manquantes !");
  process.exit(1);
}

// ───────── PostgreSQL ─────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
CREATE TABLE IF NOT EXISTS approved (
  discord_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at BIGINT,
  expires_at BIGINT,
  used INTEGER DEFAULT 0
)
`).then(() => console.log("✅ Table PostgreSQL créée/vérifiée"))
  .catch(err => console.error("❌ Erreur DB:", err));

// ───────── Bot Discord ─────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot connecté → ${client.user.tag}`);
});

// ... (le reste de ton bot.js reste pareil : connexion, pool pg, etc.)

// ───────── Gestion APPROBATION (deux façons possibles) ─────────

// Option 1 : via commande !approve <discord_id>
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (message.content.startsWith("!approve ")) {
    const args = message.content.slice(9).trim().split(/\s+/);
    const discordId = args[0];

    if (!discordId || !/^\d{17,19}$/.test(discordId)) {
      return message.reply("Utilisation : `!approve 123456789012345678`");
    }

    await approveCandidate(discordId, message);  // fonction factorisée ci-dessous
  }
});

// Option 2 : via le bouton "Approuver" du webhook (interaction)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "approve_candidate") return;

  await interaction.deferUpdate();

  // On extrait le discord_id depuis l'embed (comme dans ta version précédente)
  const embed = interaction.message.embeds[0];
  if (!embed) return;

  const identityField = embed.fields.find(f => f.name.includes("Identité"));
  if (!identityField) return;

  const discordLine = identityField.value.split('\n').find(l => l.startsWith("Discord:"));
  if (!discordLine) return;

  const discordId = discordLine.replace("Discord: ", "").trim();

  if (!/^\d{17,19}$/.test(discordId)) return;

  await approveCandidate(discordId, interaction);  // même fonction

  await interaction.editReply({
    content: `Phase 1 acceptée pour <@${discordId}> → Message privé envoyé.`,
    components: []
  });
});

// ───────── Fonction commune d'approbation ─────────
async function approveCandidate(discordId, source) {  // source = message ou interaction
  try {
    const user = await client.users.fetch(discordId);

    
      const messageText = 
  `**Bien joué !** 🌅\n\n` +
  `🔥 **Amnesia Horizon – Phase 1 validée !** 🔥\n\n` +
  `Félicitations !\n` +
  `Ta candidature en Phase 1 a été acceptée par l’équipe.\n` +
  `Tu fais désormais partie des profils que nous souhaitons découvrir plus en profondeur.\n\n` +
  `**Prochaine étape :**\n` +
  `Contacte en message privé un membre du staff (de préférence le fondateur ou le responsable staff) et transmets-lui simplement ton Discord ID exact.\n` +
  `Nous organiserons ensuite un entretien vocal avec toi pour faire connaissance et voir si le courant passe vraiment.\n\n` +
  `Chez Amnesia Horizon, **l’honnêteté et la cohérence** sont des valeurs non négociables.\n` +
  `Toute incohérence volontaire ou tentative de tromperie entraînera une exclusion définitive et immédiate du processus de recrutement.\n\n` +
  `On a vraiment hâte de discuter avec toi, d’entendre ton parcours et de voir ce que tu pourrais apporter à la team.\n` +
  `Donne le meilleur de toi-même, reste naturel·le, et on se retrouve très vite en vocal !\n\n` +
  `Merci pour ton sérieux et ta candidature.\n` +
  `À tout de suite ✌️🔥`;

await user.send(messageText);

    await user.send(messageText);

    // Réponse visible pour le staff
    const replyContent = `✅ <@${discordId}> approuvé → Message privé envoyé.`;

    if (source.reply) {
      await source.reply(replyContent);
    } else if (source.editReply) {
      // déjà géré dans interactionCreate
    }

    console.log(`[APPROVED] ${discordId} → DM envoyé`);
  } catch (err) {
    console.error(`Impossible d'envoyer DM à ${discordId} :`, err);
    
    const errorMsg = `Erreur : impossible d'envoyer le message privé à <@${discordId}> (DM fermées ?).`;
    
    if (source.reply) {
      await source.reply(errorMsg);
    }
  }
}

// ───────── Lancement du bot ─────────
client.login(DISCORD_TOKEN)
  .then(() => console.log("🔹 Tentative de connexion Discord…"))
  .catch(err => console.error("❌ Échec login Discord :", err.message));
