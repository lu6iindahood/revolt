const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- البيانات الخاصة بك ---
const TELEGRAM_TOKEN = '8105017890:AAGUgv5PhIDq-tSO5mmNiDc4fV8WZWmnxMk';
const ADMIN_CHAT_ID = '6410887780';
const PORT = process.env.PORT || 3000;

app.use(express.static('.')); 
app.use(express.json());

let sessions = {}; 

io.on('connection', (socket) => {
    socket.on('check-key', (key) => {
        sessions[key] = socket.id;

        // إرسال الإشعار لتليجرام
        const text = `🔑 *New Login Attempt*\n\nKey: \`${key}\` \nStatus: Waiting for approval...`;
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
        }).catch(err => console.log("Telegram Send Error:", err.message));
    });
});

// استقبال ردود الأزرار من تليجرام
app.post('/telegram-webhook', (req, res) => {
    const callbackQuery = req.body.callback_query;
    
    if (callbackQuery) {
        const data = callbackQuery.data;
        const [action, key] = data.split('_');
        const socketId = sessions[key];

        if (socketId) {
            const result = action === 'approve' ? 'approved' : 'rejected';
            
            // إرسال النتيجة للمتصفح فوراً عبر Socket.io
            io.to(socketId).emit('admin-response', result);
            
            // تحديث رسالة تليجرام لتأكيد الإجراء
            axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                chat_id: ADMIN_CHAT_ID,
                message_id: callbackQuery.message.message_id,
                text: `🔑 *Login Result*\n\nKey: \`${key}\` \nStatus: ${action === 'approve' ? '✅ Approved' : '❌ Rejected'}`,
                parse_mode: 'Markdown'
            });

            delete sessions[key];
        }

        // إغلاق أيقونة التحميل في تليجرام
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            callback_query_id: callbackQuery.id,
            text: `Action: ${action}`
        });
    }
    res.sendStatus(200);
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
