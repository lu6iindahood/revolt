const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const bodyParser = require('body-parser'); // Add this

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- IMPORTANT: Use JSON parser ---
app.use(bodyParser.json()); 
app.use(express.static('.')); 

const TELEGRAM_TOKEN = '8105017890:AAGUgv5PhIDq-tSO5mmNiDc4fV8WZWmnxMk';
const ADMIN_CHAT_ID = '6410887780';

let sessions = {}; 

io.on('connection', (socket) => {
    socket.on('check-key', (key) => {
        sessions[key] = socket.id;
        console.log(`User connected with key: ${key} on socket: ${socket.id}`);

        const text = `🔑 *New Login Attempt*\n\nKey: \`${key}\``;
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
        });
    });
});

// --- THE WEBHOOK HANDLER ---
app.post('/telegram-webhook', (req, res) => {
    // This logs the data to your Render Logs so you can see it working
    console.log("Data received from Telegram:", JSON.stringify(req.body));

    const callbackQuery = req.body.callback_query;
    if (callbackQuery) {
        const data = callbackQuery.data; // e.g., "approve_mykey123"
        const [action, key] = data.split('_');
        const socketId = sessions[key];

        if (socketId) {
            const status = (action === 'approve') ? 'approved' : 'rejected';
            io.to(socketId).emit('admin-response', status);
            console.log(`Sent ${status} to socket ${socketId}`);
            delete sessions[key];
        }

        // Send a quick response to Telegram to stop the loading icon on the button
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id,
            text: `Key ${action}d!`
        });
    }
    res.sendStatus(200); 
});

server.listen(process.env.PORT || 3000, () => console.log('Server is Live!'));
