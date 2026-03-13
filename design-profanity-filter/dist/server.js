/**
 * Real-Time Profanity Filter Server
 *
 * Socket.IO server that filters messages in real-time before broadcasting
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ProfanityFilter } from './profanity-filter.js';
import { blocklist } from './blocklist.js';
// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize Express and Socket.IO
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// Initialize profanity filter
const filter = new ProfanityFilter(blocklist);
// Serve static files (client.html)
app.use(express.static(join(__dirname, '..')));
app.get('/', (_req, res) => {
    res.sendFile(join(__dirname, '..', 'client.html'));
});
// Statistics
const stats = {
    totalMessages: 0,
    blockedMessages: 0,
    sanitizedMessages: 0,
    cleanMessages: 0,
    violations: []
};
// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`);
    // Send current stats to new user
    socket.emit('stats', stats);
    // Handle incoming messages
    socket.on('message', (data) => {
        const { username, message } = data;
        stats.totalMessages++;
        console.log(`\n[${new Date().toISOString()}] Message from ${username}:`);
        console.log(`Original: "${message}"`);
        // Filter the message
        const filterResult = filter.filter(message);
        console.log(`Clean: ${filterResult.clean}`);
        console.log(`Severity: ${filterResult.severity}`);
        console.log(`Violations: ${filterResult.violations.length}`);
        // Handle based on severity
        if (filterResult.blocked) {
            // BLOCK: Do not broadcast, notify sender only
            stats.blockedMessages++;
            console.log(`[BLOCKED] Message blocked due to severe profanity`);
            socket.emit('messageBlocked', {
                original: message,
                reason: 'Message contains prohibited content',
                violations: filterResult.violations
            });
            // Log violation
            logViolation(username, message, filterResult);
        }
        else if (!filterResult.clean) {
            // SANITIZE: Broadcast sanitized version
            stats.sanitizedMessages++;
            console.log(`[SANITIZED] Broadcasting: "${filterResult.sanitized}"`);
            io.emit('message', {
                username,
                message: filterResult.sanitized,
                timestamp: new Date().toISOString(),
                sanitized: true,
                original: message // For debugging
            });
            // Log violation
            logViolation(username, message, filterResult);
        }
        else {
            // CLEAN: Broadcast as-is
            stats.cleanMessages++;
            console.log(`[CLEAN] Broadcasting: "${message}"`);
            io.emit('message', {
                username,
                message,
                timestamp: new Date().toISOString(),
                sanitized: false
            });
        }
        // Update stats
        io.emit('stats', stats);
    });
    // Handle typing indicator
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] User disconnected: ${socket.id}`);
    });
});
/**
 * Log violation to stats and console
 */
function logViolation(username, message, filterResult) {
    const violation = {
        timestamp: new Date().toISOString(),
        username,
        message,
        severity: filterResult.severity,
        violations: filterResult.violations,
        sanitized: filterResult.sanitized
    };
    stats.violations.push(violation);
    // Keep only last 100 violations
    if (stats.violations.length > 100) {
        stats.violations.shift();
    }
    console.log(`\n[VIOLATION LOG]`);
    console.log(`User: ${username}`);
    console.log(`Severity: ${filterResult.severity}`);
    console.log(`Detected violations:`);
    filterResult.violations.forEach(v => {
        console.log(`  - "${v.original}" (${v.strategy}): ${v.word} [${v.severity}]`);
    });
}
// API endpoint for stats
app.get('/api/stats', (_req, res) => {
    res.json(stats);
});
// API endpoint for violations
app.get('/api/violations', (_req, res) => {
    res.json(stats.violations);
});
// API endpoint to test filter
app.get('/api/test', (req, res) => {
    const message = req.query.message || '';
    const result = filter.analyze(message);
    res.json(result);
});
// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('Real-Time Profanity Filter Server');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready for connections`);
    console.log(`\nAPI Endpoints:`);
    console.log(`  GET /                - Client interface`);
    console.log(`  GET /api/stats       - Server statistics`);
    console.log(`  GET /api/violations  - Violation log`);
    console.log(`  GET /api/test?message=<msg> - Test filter`);
    console.log('='.repeat(60));
    console.log('Waiting for connections...\n');
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n[SHUTDOWN] Closing server...');
    httpServer.close(() => {
        console.log('[SHUTDOWN] Server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map