const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000/internal-webhook';
const PYTHON_STATUS_URL = process.env.PYTHON_STATUS_URL || 'http://127.0.0.1:8000/api/wa/status-update';

let currentStatus = 'disconnected'; // disconnected | qr_ready | connected
let latestQrDataUrl = null;

// Initialize WhatsApp Client with Local Session (persists login)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
});

// Notify Python backend about status changes
async function notifyStatus(status, extra = {}) {
    currentStatus = status;
    try {
        await axios.post(PYTHON_STATUS_URL, { status, ...extra });
        console.log(`Status notified: ${status}`);
    } catch (err) {
        console.error(`Failed to notify status: ${err.message}`);
    }
}

// Event: Generate QR Code
client.on('qr', async (qr) => {
    console.log('QR Code received.');
    
    // Generate QR as Data URL (base64 PNG) for serving to frontend
    try {
        latestQrDataUrl = await qrcode.toDataURL(qr, {
            width: 512,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        // Also save to file as backup
        await qrcode.toFile('../qr.png', qr, {
            width: 512,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        console.log('QR code generated and ready.');
        await notifyStatus('qr_ready');
    } catch (err) {
        console.error('QR generation error:', err);
    }
});

// Event: Authenticated
client.on('ready', () => {
    console.log('WhatsApp Client is Ready!');
    latestQrDataUrl = null;
    notifyStatus('connected');
});

// Event: Disconnected
client.on('disconnected', (reason) => {
    console.log('WhatsApp Client Disconnected:', reason);
    latestQrDataUrl = null;
    notifyStatus('disconnected');
});

// Event: Auth failure
client.on('auth_failure', (msg) => {
    console.error('WhatsApp Auth Failure:', msg);
    notifyStatus('disconnected');
});

// Event: Receive Message
client.on('message', async (message) => {
    if (message.from === 'status@broadcast' || message.isStatus) return;

    try {
        const contact = await message.getContact().catch(() => ({}));
        const chat = await message.getChat().catch(() => ({}));
        
        const senderName = chat.isGroup ? chat.name : (contact.pushname || contact.name || contact.number || message.from.split('@')[0]);
        console.log(`[WA] New Message from "${senderName}" (${message.from}): ${message.body}`);
        
        const payload = {
            from: message.from,
            body: message.body,
            platform: 'whatsapp',
            user_name: senderName,
            isGroupMsg: chat.isGroup,
            group_name: chat.isGroup ? chat.name : null
        };

        const response = await axios.post(PYTHON_BACKEND_URL, payload);
        console.log(`[WA] Backend responded: ${response.status}`);
    } catch (error) {
        console.error('[WA] Message processing Error:', error.message);
        if (error.response) {
            console.error('[WA] Backend Error Data:', error.response.data);
        }
    }
});

client.initialize();

// === Express API ===

// Get current status
app.get('/status', (req, res) => {
    res.json({ status: currentStatus });
});

// Get QR code as data URL
app.get('/qr', (req, res) => {
    if (latestQrDataUrl) {
        res.json({ qr: latestQrDataUrl, status: 'qr_ready' });
    } else if (currentStatus === 'connected') {
        res.json({ qr: null, status: 'connected' });
    } else {
        res.json({ qr: null, status: currentStatus });
    }
});

// Logout / Disconnect
app.post('/logout', async (req, res) => {
    try {
        await client.logout();
        latestQrDataUrl = null;
        currentStatus = 'disconnected';
        res.json({ status: 'logged_out' });
        // Re-initialize after logout so new QR appears
        setTimeout(() => {
            client.initialize();
        }, 2000);
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

// Send message
app.post('/send', async (req, res) => {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'Missing "to" or "text"' });

    try {
        await client.sendMessage(to, text);
        res.json({ status: 'sent' });
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Send message to group by name
app.post('/send-group', async (req, res) => {
    const { groupName, text } = req.body;
    if (!groupName || !text) return res.status(400).json({ error: 'Missing "groupName" or "text"' });

    try {
        const chats = await client.getChats();
        const group = chats.find(c => c.isGroup && c.name === groupName);
        
        if (group) {
            await client.sendMessage(group.id._serialized, text);
            res.json({ status: 'sent', group: groupName });
        } else {
            console.error(`Group "${groupName}" not found. Available groups:`, chats.filter(c => c.isGroup).map(c => c.name));
            res.status(404).json({ error: 'Group not found', availableGroups: chats.filter(c => c.isGroup).map(c => c.name) });
        }
    } catch (error) {
        console.error('Error sending message to group:', error);
        res.status(500).json({ error: 'Failed to send message to group' });
    }
});

// Send message to contact by name
app.post('/send-contact', async (req, res) => {
    const { contactName, text } = req.body;
    if (!contactName || !text) return res.status(400).json({ error: 'Missing "contactName" or "text"' });

    try {
        const chats = await client.getChats();
        // Look for direct chat with contact name or pushname
        const contactChat = chats.find(c => !c.isGroup && (c.name === contactName || (c.contact && c.contact.pushname === contactName) || c.name?.includes(contactName)));
        
        if (contactChat) {
            await client.sendMessage(contactChat.id._serialized, text);
            res.json({ status: 'sent', contact: contactName });
        } else {
            console.error(`Contact "${contactName}" not found in chats.`);
            res.status(404).json({ error: 'Contact not found in recent chats' });
        }
    } catch (error) {
        console.error('Error sending WhatsApp message to contact:', error);
        res.status(500).json({ error: 'Failed to send contact message' });
    }
});

// NEW: Get all chats to verify names/IDs
app.get('/api/chats', async (req, res) => {
    try {
        const chats = await client.getChats();
        const simplified = chats.map(c => ({
            id: c.id._serialized,
            name: c.name,
            isGroup: c.isGroup,
            unreadCount: c.unreadCount
        }));
        res.json(simplified);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp Bridge Server running on port ${PORT}`);
});
