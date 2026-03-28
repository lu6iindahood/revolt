const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION ---
const TELEGRAM_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = 'YOUR_TELEGRAM_ID_HERE';
const PORT = process.env.PORT || 3000;

app.use(express.static('.')); // Serves index.html
app.use(express.json());

let sessions = {}; // Stores socket IDs linked to keys

io.on('connection', (socket) => {
    socket.on('check-key', (key) => {
        sessions[key] = socket.id;

        // Send Request to Telegram
        const text = `⚠️ *New Login Attempt*\n\nKey: \`${key}\`\nStatus: Pending Approval`;
        const keyboard = {
            inline_keyboard: [[
                { text: "✅ Approve", callback_data: `approve_${key}` },
                { text: "❌ Reject", callback_data: `reject_${key}` }
            ]]
        };

        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: text,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }).catch(err => console.log("Telegram Error:", err.message));
    });
});

// Endpoint for Telegram Webhook
app.post('/telegram-webhook', (req, res) => {
    if (req.body.callback_query) {
        const data = req.body.callback_query.data;
        const [action, key] = data.split('_');
        const socketId = sessions[key];

        if (socketId) {
            const result = action === 'approve' ? 'approved' : 'rejected';
            io.to(socketId).emit('admin-response', result);
            delete sessions[key];
        }
        
        // Update Telegram Message
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: req.body.callback_query.id,
            text: `Key ${action}d!`
        });
    }
    res.sendStatus(200);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));