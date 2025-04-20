class UI {
    constructor(storageManager, tileGenerator) {
        this.storageManager = storageManager;
        this.tileGenerator = tileGenerator;
        this.selectedTileElement = null;
        
        this.setupEventListeners();
        this.updateTileLibrary();
    }
    
    setupEventListeners() {
        // Tool buttons
        document.getElementById('generateTileBtn').addEventListener('click', () => this.showGenerateTileModal());
        document.getElementById('selectTileBtn').addEventListener('click', () => this.activateTileSelectTool());
        document.getElementById('eraseBtn').addEventListener('click', () => this.activateEraseTool());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveWorld());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadWorld());
        
        // Network buttons
        document.getElementById('hostBtn').addEventListener('click', () => this.hostGame());
        document.getElementById('joinBtn').addEventListener('click', () => this.joinGame());
        
        // Tile generator modal
        document.getElementById('generateBtn').addEventListener('click', () => this.generateTile());
        document.getElementById('cancelGenerateBtn').addEventListener('click', () => this.closeGenerateTileModal());
        document.getElementById('saveTileBtn').addEventListener('click', () => this.saveTile());
        
        // Lobby modal
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('leaveLobbyBtn').addEventListener('click', () => this.leaveLobby());
    }
    
    updateTileLibrary() {
        const tileContainer = document.getElementById('tileContainer');
        tileContainer.innerHTML = '';
        
        const tileLibrary = this.storageManager.getTileLibrary();
        
        tileLibrary.forEach(tile => {
            const tileElement = document.createElement('div');
            tileElement.className = 'tile-item';
            tileElement.dataset.tileId = tile.id;
            
            const img = document.createElement('img');
            img.src = tile.url;
            img.alt = tile.name;
            
            const nameElement = document.createElement('div');
            nameElement.className = 'tile-name';
            nameElement.textContent = tile.name;
            
            tileElement.appendChild(img);
            tileElement.appendChild(nameElement);
            
            tileElement.addEventListener('click', () => {
                this.selectTile(tileElement, tile);
            });
            
            tileContainer.appendChild(tileElement);
        });
    }
    
    selectTile(tileElement, tile) {
        // Deselect previously selected tile
        if (this.selectedTileElement) {
            this.selectedTileElement.classList.remove('selected');
        }
        
        // Select new tile
        tileElement.classList.add('selected');
        this.selectedTileElement = tileElement;
        
        // Update grid
        grid.selectTile(tile);
        
        // Activate tile select button
        this.activateButton('selectTileBtn');
    }
    
    activateTileSelectTool() {
        this.activateButton('selectTileBtn');
        grid.isErasing = false;
    }
    
    activateEraseTool() {
        this.activateButton('eraseBtn');
        grid.enableEraser();
    }
    
    activateButton(buttonId) {
        // Remove active class from all tool buttons
        const buttons = document.querySelectorAll('#tools button');
        buttons.forEach(button => button.classList.remove('active'));
        
        // Add active class to the selected button
        document.getElementById(buttonId).classList.add('active');
    }
    
    saveWorld() {
        // World is automatically saved when tiles are placed
        alert('World saved successfully!');
    }
    
    loadWorld() {
        const worldData = this.storageManager.loadWorld();
        if (worldData) {
            grid.loadVisibleChunks();
            grid.render();
            alert('World loaded successfully!');
        } else {
            alert('No saved world found.');
        }
    }
    
    showGenerateTileModal() {
        document.getElementById('modalContainer').classList.remove('hidden');
        document.getElementById('tileGeneratorModal').classList.remove('hidden');
        document.getElementById('tilePrompt').focus();
        document.getElementById('tilePreview').classList.add('hidden');
        document.getElementById('generatingIndicator').classList.add('hidden');
    }
    
    closeGenerateTileModal() {
        document.getElementById('modalContainer').classList.add('hidden');
        document.getElementById('tileGeneratorModal').classList.add('hidden');
        document.getElementById('tilePrompt').value = '';
    }
    
    async generateTile() {
        const prompt = document.getElementById('tilePrompt').value.trim();
        
        if (!prompt) {
            alert('Please enter a description for your tile.');
            return;
        }
        
        try {
            document.getElementById('generateBtn').disabled = true;
            document.getElementById('generatingIndicator').classList.remove('hidden');
            
            const newTile = await this.tileGenerator.generateTile(prompt);
            
            // Show preview
            document.getElementById('tilePreviewImg').src = newTile.url;
            document.getElementById('tileName').value = newTile.name;
            document.getElementById('tilePreview').classList.remove('hidden');
            document.getElementById('tileName').focus();
            
            // Store temporary tile data
            this.tempTile = newTile;
            
        } catch (error) {
            console.error('Error generating tile:', error);
            alert('Failed to generate tile: ' + error.message);
        } finally {
            document.getElementById('generateBtn').disabled = false;
            document.getElementById('generatingIndicator').classList.add('hidden');
        }
    }
    
    saveTile() {
        if (!this.tempTile) return;
        
        // Update tile name
        const tileName = document.getElementById('tileName').value.trim();
        if (tileName) {
            this.tempTile.name = tileName;
        }
        
        // Save to storage
        this.storageManager.saveTile(this.tempTile);
        
        // Update UI
        this.updateTileLibrary();
        this.closeGenerateTileModal();
        
        // Clear temporary data
        this.tempTile = null;
    }
    
    async hostGame() {
        if (!networking.peer) {
            const initialized = await networking.initialize();
            if (!initialized) {
                alert('Failed to initialize networking');
                return;
            }
        }
        
        const lobbyId = networking.hostGame();
        if (!lobbyId) {
            alert('Failed to create game lobby');
        }
    }
    
    async joinGame() {
        if (!networking.peer) {
            const initialized = await networking.initialize();
            if (!initialized) {
                alert('Failed to initialize networking');
                return;
            }
        }
        
        const lobbyIdInput = document.getElementById('lobbyIdInput');
        const lobbyId = lobbyIdInput.value.trim();
        
        if (!lobbyId) {
            alert('Please enter a lobby ID');
            return;
        }
        
        const joined = networking.joinGame(lobbyId);
        if (!joined) {
            alert('Failed to join game');
        }
    }
    
    showLobby(lobbyId) {
        document.getElementById('modalContainer').classList.remove('hidden');
        document.getElementById('lobbyModal').classList.remove('hidden');
        document.getElementById('tileGeneratorModal').classList.add('hidden');
        
        document.getElementById('lobbyId').textContent = lobbyId;
        
        if (networking.isHost) {
            document.getElementById('lobbyTitle').textContent = 'Hosting Game Lobby';
            document.getElementById('startGameBtn').classList.remove('hidden');
        } else {
            document.getElementById('lobbyTitle').textContent = 'Game Lobby';
            document.getElementById('startGameBtn').classList.add('hidden');
        }
    }
    
    updatePlayersList(players) {
        const playersListElement = document.getElementById('playersListItems');
        playersListElement.innerHTML = '';
        
        players.forEach(player => {
            const playerItem = document.createElement('li');
            playerItem.textContent = player.name + (player.id === networking.peer.id ? ' (You)' : '');
            playersListElement.appendChild(playerItem);
        });
    }
    
    startGame() {
        if (!networking.isHost) return;
        
        // Just close the lobby modal to start the game
        document.getElementById('modalContainer').classList.add('hidden');
        document.getElementById('lobbyModal').classList.add('hidden');
    }
    
    closeLobby() {
        document.getElementById('modalContainer').classList.add('hidden');
        document.getElementById('lobbyModal').classList.add('hidden');
    }
    
    leaveLobby() {
        networking.leaveGame();
    }
}

