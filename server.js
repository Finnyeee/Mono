const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Load type data once at server start
const typeData = require('./data/types.json');
const pokemonTypes = require('./data/pokemon-types.json');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for sessions
const sessions = new Map();

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/create', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create.html'));
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

app.get('/session/:id', (req, res) => {
    const sessionId = req.params.id;
    if (sessions.has(sessionId)) {
        res.sendFile(path.join(__dirname, 'public', 'session.html'));
    } else {
        res.status(404).send('Session not found');
    }
});

// API endpoints
app.post('/api/create-session', (req, res) => {
    const sessionId = uuidv4().substring(0, 8).toUpperCase();
    const session = {
        id: sessionId,
        creator: null,
        joiner: null,
        phase: 'waiting', // waiting, team_input, banning, completed
        creatorTeams: [],
        joinerTeams: [],
        creatorBan: null,
        joinerBan: null,
        createdAt: new Date(),
        completedAt: null,
        revealAt: null,
        contentRevealed: false
    };
    sessions.set(sessionId, session);
    res.json({ sessionId, success: true });
});

app.post('/api/join-session', (req, res) => {
    const { sessionId } = req.body;
    if (sessions.has(sessionId)) {
        res.json({ success: true, sessionId });
    } else {
        res.json({ success: false, message: 'Session not found' });
    }
});

app.get('/api/session/:id', (req, res) => {
    const sessionId = req.params.id;
    const session = sessions.get(sessionId);
    if (session) {
        res.json(session);
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);
        const session = sessions.get(sessionId);
        if (session) {
            let phaseChanged = false;
            
            // Assign role based on who's already in the session
            if (!session.creator) {
                session.creator = socket.id;
                socket.emit('role-assigned', 'creator');
                console.log(`Creator joined session ${sessionId}`);
            } else if (!session.joiner) {
                session.joiner = socket.id;
                socket.emit('role-assigned', 'joiner');
                // Start team input phase when both players join
                session.phase = 'team_input';
                phaseChanged = true;
                console.log(`Joiner joined session ${sessionId} - moving to team_input phase`);
            } else {
                socket.emit('role-assigned', 'observer');
                console.log(`Observer joined session ${sessionId}`);
            }
            
            if (phaseChanged) {
                // Broadcast session update to ALL users when phase changes
                console.log(`Broadcasting phase change to all users in session ${sessionId}`);
                io.to(sessionId).emit('session-update', session);
            } else {
                // Send current session state to the joining user only
                socket.emit('session-update', session);
                // Notify others in the session about new user
                socket.to(sessionId).emit('user-joined', { userId: socket.id });
            }
        }
    });

    // Team type labeling function
    function labelTeam(description) {
        const trimmed = description.trim();
        if (!trimmed) return 'Unknown';
        
        // Split into lines and extract potential Pokémon names, including those in parentheses
        const lines = trimmed.split('\n');
        const potentialNames = lines
            .map(line => line.trim())
            .filter(line => {
                // Skip empty lines, move lines, and lines that start with common metadata prefixes
                return line && 
                       !line.startsWith('-') && 
                       !line.startsWith('Ability:') &&
                       !line.startsWith('Tera Type:') &&
                       !line.startsWith('EVs:') &&
                       !line.startsWith('IVs:') &&
                       !line.includes('Nature');
            })
            .map(line => {
                const names = [];
                // Check for name in parentheses (for forms/variants)
                const parenthesesMatch = line.match(/\(([\w\-]+)\)/);
                if (parenthesesMatch) {
                    names.push(parenthesesMatch[1]);
                }
                // Also get the name part before any @ or (
                const baseMatch = line.match(/^([^@(]+)/);
                if (baseMatch) {
                    names.push(baseMatch[1].trim());
                }
                return names;
            })
            .flat()
            .filter(name => name); // Remove empty strings
        
        console.log("Potential names found:", potentialNames);
        
        // Find matching Pokémon
        const foundPokemonData = new Map(); // Use Map to prevent duplicates
        
        for (const [key, pokemon] of Object.entries(pokemonTypes)) {
            for (const potentialName of potentialNames) {
                // Only match if names are exactly equal, or if we're matching a base form name
                if (potentialName === pokemon.name || 
                    (pokemon.name.includes('-') && potentialName === pokemon.name.split('-')[0] && !potentialName.includes('-')) ||
                    (potentialName.includes('-') && potentialName === pokemon.name)) {
                    
                    // For base form names (no hyphen), only match if the pokemon name is also a base form
                    if (!potentialName.includes('-') && pokemon.name.includes('-')) {
                        continue;
                    }
                    
                    foundPokemonData.set(key, { key, name: pokemon.name });
                    break; // Stop checking other potential names once we find a match
                }
            }
        }
        
        const uniquePokemon = Array.from(foundPokemonData.values());
        console.log("Found Pokemon:", uniquePokemon);
        
        if (uniquePokemon.length === 0) {
            return 'Unknown';
        }
        
        // Initialize common types with the first Pokémon's types
        let commonTypes = new Set(pokemonTypes[uniquePokemon[0].key].types);
        console.log("Initial common types:", [...commonTypes]);
        
        // Find intersection of types for all found Pokémon
        for (let i = 1; i < uniquePokemon.length; i++) {
            const currentTypes = new Set(pokemonTypes[uniquePokemon[i].key].types);
            console.log(`Types for ${uniquePokemon[i].name}:`, [...currentTypes]);
            commonTypes = new Set(
                [...commonTypes].filter(type => currentTypes.has(type))
            );
            console.log("Common types after intersection:", [...commonTypes]);
            
            // If no common types left, exit early
            if (commonTypes.size === 0) {
                return 'Mixed';
            }
        }
        
        // If we found common types, return the first one
        if (commonTypes.size >= 1) {
            return Array.from(commonTypes)[0];
        }
        
        // If no common type found
        return 'Mixed';
    }
    

    socket.on('submit-teams', ({ sessionId, teams }) => {
        console.log(`Team submission received from ${socket.id} for session ${sessionId}`);
        console.log('Teams:', teams);
        
        const session = sessions.get(sessionId);
        if (!session) {
            console.log('Session not found:', sessionId);
            return;
        }
        
        if (session.phase !== 'team_input') {
            console.log('Invalid phase for team submission:', session.phase);
            return;
        }
        
        if (!teams || teams.length !== 3) {
            console.log('Invalid teams data:', teams);
            return;
        }
        
        const isCreator = session.creator === socket.id;
        const isJoiner = session.joiner === socket.id;
        
        console.log('User role - isCreator:', isCreator, 'isJoiner:', isJoiner);
        
        if (isCreator) {
            session.creatorTeams = teams.map(description => ({
                id: uuidv4(),
                description: description.trim(),
                label: labelTeam(description),
                banned: false
            }));
            console.log('Creator teams set:', session.creatorTeams.length);
        } else if (isJoiner) {
            session.joinerTeams = teams.map(description => ({
                id: uuidv4(),
                description: description.trim(),
                label: labelTeam(description),
                banned: false
            }));
            console.log('Joiner teams set:', session.joinerTeams.length);
        } else {
            console.log('User is neither creator nor joiner');
            return;
        }
        
        // Check if both players have submitted teams
        if (session.creatorTeams.length === 3 && session.joinerTeams.length === 3) {
            session.phase = 'banning';
            console.log('Both players submitted - moving to banning phase');
        }
        
        // Broadcast update to all users in the session
        console.log('Broadcasting session update');
        io.to(sessionId).emit('session-update', session);
    });

    socket.on('ban-team', ({ sessionId, teamId }) => {
        const session = sessions.get(sessionId);
        if (session && session.phase === 'banning') {
            const isCreator = session.creator === socket.id;
            const isJoiner = session.joiner === socket.id;
            
            if (isCreator && !session.creatorBan) {
                session.creatorBan = teamId;
            } else if (isJoiner && !session.joinerBan) {
                session.joinerBan = teamId;
            }
            
            // Check if both players have banned
            if (session.creatorBan && session.joinerBan) {
                // Apply the bans but stay in banning phase until both players have seen the results
                const creatorBannedTeam = session.joinerTeams.find(t => t.id === session.creatorBan);
                const joinerBannedTeam = session.creatorTeams.find(t => t.id === session.joinerBan);
                
                if (creatorBannedTeam) creatorBannedTeam.banned = true;
                if (joinerBannedTeam) joinerBannedTeam.banned = true;
                
                // Set completion and reveal times
                const now = new Date();
                session.completedAt = now;
                session.revealAt = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
                
                // Only move to completed phase after a short delay to allow ban reveal animation
                setTimeout(() => {
                    session.phase = 'completed';
                    io.to(sessionId).emit('session-update', session);
                }, 3000); // 3 second delay
            }
            
            // Broadcast update to all users in the session
            io.to(sessionId).emit('session-update', session);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Update sessions to remove disconnected user
        for (const [sessionId, session] of sessions.entries()) {
            if (session.creator === socket.id) {
                session.creator = null;
            } else if (session.joiner === socket.id) {
                session.joiner = null;
            }
            
            // Notify others in the session about disconnection
            socket.to(sessionId).emit('user-left', { userId: socket.id });
        }
    });
});

// Auto-reveal content after 2 hours
function checkAutoReveal() {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
        if (session.phase === 'completed' && 
            !session.contentRevealed && 
            session.revealAt && 
            now >= session.revealAt) {
            
            session.contentRevealed = true;
            console.log(`Auto-revealing content for session ${sessionId}`);
            
            // Broadcast update to all users in the session
            io.to(sessionId).emit('session-update', session);
        }
    }
}

// Check every minute for auto-reveals
setInterval(checkAutoReveal, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to access the app`);
}); 