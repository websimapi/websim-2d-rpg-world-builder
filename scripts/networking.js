class Networking {
    constructor(grid, storageManager) {
        this.grid = grid;
        this.storageManager = storageManager;
        this.peer = null;
        this.connections = new Map();
        this.players = new Map();
        this.lobbyId = null;
        this.hostConnection = null;
        this.isHost = false;
        this.isConnected = false;
        this.lastActionTime = new Map();
        this.actionCooldown = 300; // 300ms cooldown
    }
    
    // Initialize networking with PeerJS
    async initialize() {
        try {
            // Import PeerJS
            const Peer = await import('peerjs').then(module => module.default);
            
            // Create a new peer
            this.peer = new Peer({
                debug: 2,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            // Set up peer event handlers
            this.peer.on('open', id => {
                console.log('My peer ID is: ' + id);
            });
            
            this.peer.on('error', error => {
                console.error('Peer connection error:', error);
                this.updateConnectionStatus('Error: ' + error.message);
            });
            
            this.peer.on('connection', connection => {
                this.handleIncomingConnection(connection);
            });
            
            this.peer.on('disconnected', () => {
                console.log('Peer disconnected');
                this.updateConnectionStatus('Disconnected');
                this.isConnected = false;
            });
            
            return true;
        } catch (error) {
            console.error('Failed to initialize networking:', error);
            return false;
        }
    }
    
    // Host a new game lobby
    hostGame() {
        if (!this.peer) {
            console.error('Peer not initialized');
            return false;
        }
        
        this.lobbyId = this.peer.id;
        this.isHost = true;
        this.isConnected = true;
        this.updateConnectionStatus('Hosting lobby: ' + this.lobbyId);
        
        // Show the lobby with the ID
        ui.showLobby(this.lobbyId);
        
        return this.lobbyId;
    }
    
    // Join an existing game by lobby ID
    joinGame(lobbyId) {
        if (!this.peer) {
            console.error('Peer not initialized');
            return false;
        }
        
        try {
            const connection = this.peer.connect(lobbyId, {
                reliable: true
            });
            
            connection.on('open', () => {
                console.log('Connected to host');
                this.hostConnection = connection;
                this.lobbyId = lobbyId;
                this.isHost = false;
                this.isConnected = true;
                this.updateConnectionStatus('Connected to lobby');
                
                // Register connection handlers
                this.setupConnectionHandlers(connection);
                
                // Send initial player info
                this.sendMessage(connection, {
                    type: 'player_join',
                    data: {
                        id: this.peer.id,
                        name: 'Player_' + this.peer.id.substring(0, 5)
                    }
                });
                
                // Show lobby UI
                ui.showLobby(lobbyId);
            });
            
            connection.on('error', (err) => {
                console.error('Connection error:', err);
                this.updateConnectionStatus('Connection error');
            });
            
            return true;
        } catch (error) {
            console.error('Failed to join game:', error);
            return false;
        }
    }
    
    // Handle incoming peer connections
    handleIncomingConnection(connection) {
        console.log('Incoming connection from:', connection.peer);
        
        // Only accept connections if we are hosting
        if (!this.isHost) {
            console.warn('Rejecting connection - not a host');
            connection.close();
            return;
        }
        
        // Accept the connection
        this.connections.set(connection.peer, connection);
        this.lastActionTime.set(connection.peer, Date.now());
        
        // Setup message handlers
        this.setupConnectionHandlers(connection);
        
        // Send the current world state
        this.sendWorldState(connection);
    }
    
    // Set up handlers for connection messages
    setupConnectionHandlers(connection) {
        connection.on('data', data => {
            this.handleMessage(connection, data);
        });
        
        connection.on('close', () => {
            console.log('Connection closed:', connection.peer);
            
            // Remove the connection and player
            this.connections.delete(connection.peer);
            
            if (this.players.has(connection.peer)) {
                const playerName = this.players.get(connection.peer).name;
                this.players.delete(connection.peer);
                
                // Notify other players if we're the host
                if (this.isHost) {
                    this.broadcastMessage({
                        type: 'player_leave',
                        data: {
                            id: connection.peer,
                            name: playerName
                        }
                    });
                    
                    // Update the lobby UI
                    ui.updatePlayersList(Array.from(this.players.values()));
                }
            }
            
            if (connection === this.hostConnection) {
                this.hostConnection = null;
                this.isConnected = false;
                this.updateConnectionStatus('Disconnected from host');
                ui.closeLobby();
            }
        });
    }
    
    // Handle incoming messages
    handleMessage(connection, message) {
        if (!message || !message.type) {
            console.warn('Invalid message format');
            return;
        }
        
        const now = Date.now();
        const lastAction = this.lastActionTime.get(connection.peer) || 0;
        
        switch (message.type) {
            case 'player_join':
                this.handlePlayerJoin(connection, message.data);
                break;
                
            case 'world_state':
                this.handleWorldState(message.data);
                break;
                
            case 'tile_update':
                // Rate limit tile updates
                if (now - lastAction >= this.actionCooldown) {
                    this.handleTileUpdate(connection, message.data);
                    this.lastActionTime.set(connection.peer, now);
                } else {
                    console.warn('Rate limiting tile update from', connection.peer);
                }
                break;
                
            case 'player_list':
                this.handlePlayerList(message.data);
                break;
                
            case 'player_leave':
                this.handlePlayerLeave(message.data);
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    
    // Handle player join
    handlePlayerJoin(connection, playerData) {
        // Add player to the list
        this.players.set(connection.peer, {
            id: playerData.id,
            name: playerData.name
        });
        
        console.log('Player joined:', playerData.name);
        
        // If we're the host, broadcast to all other players
        if (this.isHost) {
            // Send the player list to the new player
            this.sendMessage(connection, {
                type: 'player_list',
                data: Array.from(this.players.values())
            });
            
            // Inform others about the new player
            this.broadcastMessage({
                type: 'player_join',
                data: playerData
            }, [connection.peer]);
            
            // Update the lobby UI
            ui.updatePlayersList(Array.from(this.players.values()));
        }
    }
    
    // Handle receiving world state (client only)
    handleWorldState(worldData) {
        if (this.isHost) return; // Hosts don't receive world state
        
        // Load the received world data
        if (worldData && worldData.chunks) {
            // Clear existing data
            this.storageManager.clearAllData();
            
            // Save new chunks
            Object.entries(worldData.chunks).forEach(([chunkKey, chunkData]) => {
                const [x, y] = chunkKey.split(',').map(Number);
                this.storageManager.saveChunk(x, y, chunkData);
            });
            
            // Reload visible chunks
            this.grid.loadVisibleChunks();
            this.grid.render();
        }
    }
    
    // Handle tile update
    handleTileUpdate(connection, updateData) {
        const { x, y, tileId } = updateData;
        
        // If we're the host, validate and apply tile update
        if (this.isHost) {
            // Get the tile data for the given ID
            let tileData = null;
            if (tileId) {
                const tileLibrary = this.storageManager.getTileLibrary();
                tileData = tileLibrary.find(tile => tile.id === tileId);
            }
            
            // Apply the tile update
            this.grid.setTileAt(x, y, tileData);
            
            // Broadcast the update to all other clients
            this.broadcastMessage({
                type: 'tile_update',
                data: updateData
            }, [connection.peer]);
        } 
        // If we're a client, apply validated updates from host
        else if (connection === this.hostConnection) {
            // Get the tile data for the given ID
            let tileData = null;
            if (tileId) {
                const tileLibrary = this.storageManager.getTileLibrary();
                tileData = tileLibrary.find(tile => tile.id === tileId);
            }
            
            // Apply the tile update
            this.grid.setTileAt(x, y, tileData);
        }
    }
    
    // Handle player list update
    handlePlayerList(players) {
        this.players.clear();
        players.forEach(player => {
            this.players.set(player.id, player);
        });
        
        // Update the lobby UI
        ui.updatePlayersList(players);
    }
    
    // Handle player leave notification
    handlePlayerLeave(playerData) {
        if (this.players.has(playerData.id)) {
            this.players.delete(playerData.id);
            console.log('Player left:', playerData.name);
            
            // Update the lobby UI
            ui.updatePlayersList(Array.from(this.players.values()));
        }
    }
    
    // Send message to a specific connection
    sendMessage(connection, message) {
        if (connection && connection.open) {
            connection.send(message);
            return true;
        }
        return false;
    }
    
    // Broadcast message to all connections except excluded IDs
    broadcastMessage(message, excludedPeers = []) {
        this.connections.forEach((connection, peerId) => {
            if (!excludedPeers.includes(peerId)) {
                this.sendMessage(connection, message);
            }
        });
    }
    
    // Send world state to a client (host only)
    sendWorldState(connection) {
        if (!this.isHost) return;
        
        const worldData = this.storageManager.loadWorld();
        if (worldData) {
            this.sendMessage(connection, {
                type: 'world_state',
                data: worldData
            });
        }
    }
    
    // Send tile update to host (client only)
    sendTileUpdate(x, y, tileId) {
        if (this.isHost || !this.hostConnection) return;
        
        const now = Date.now();
        const lastAction = this.lastActionTime.get(this.peer.id) || 0;
        
        // Apply rate limiting
        if (now - lastAction < this.actionCooldown) {
            console.warn('Rate limiting local tile update');
            return;
        }
        
        this.lastActionTime.set(this.peer.id, now);
        
        this.sendMessage(this.hostConnection, {
            type: 'tile_update',
            data: { x, y, tileId }
        });
    }
    
    // Leave current game/lobby
    leaveGame() {
        // Close all connections
        this.connections.forEach(connection => {
            connection.close();
        });
        
        if (this.hostConnection) {
            this.hostConnection.close();
            this.hostConnection = null;
        }
        
        this.connections.clear();
        this.players.clear();
        this.lobbyId = null;
        this.isHost = false;
        this.isConnected = false;
        
        this.updateConnectionStatus('Disconnected');
        ui.closeLobby();
    }
    
    // Update connection status display
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status;
        
        if (this.isConnected) {
            statusElement.classList.add('connected');
        } else {
            statusElement.classList.remove('connected');
        }
    }
}

