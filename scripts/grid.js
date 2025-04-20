class WorldGrid {
    constructor(canvas, storageManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.storageManager = storageManager;
        
        // Grid configuration
        this.tileSize = 64;  // Size of each tile in pixels
        this.chunkSize = 8;  // Number of tiles in a chunk (8x8)
        this.chunkPixelSize = this.tileSize * this.chunkSize;
        
        // Camera/viewport position
        this.cameraX = 0;
        this.cameraY = 0;
        this.dragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Loaded chunks and images cache
        this.loadedChunks = new Map();
        this.imageCache = new Map();
        
        // Current editing state
        this.currentTile = null;
        this.isErasing = false;
        
        this.setupEvents();
        this.resizeCanvas();
        
        // Load initial chunks
        this.loadVisibleChunks();
    }
    
    setupEvents() {
        // Handle canvas resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Mouse events for interaction
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('click', e => this.handleClick(e));
        
        // Zoom with mouse wheel
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    handleMouseDown(e) {
        this.dragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        // Update coordinate display
        const worldPos = this.screenToWorldCoords(e.clientX, e.clientY);
        const coordsElement = document.getElementById('coordinates');
        coordsElement.textContent = `X: ${Math.floor(worldPos.x)}, Y: ${Math.floor(worldPos.y)}`;
        
        // Handle drag to move camera
        if (this.dragging) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            
            this.cameraX -= dx;
            this.cameraY -= dy;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            this.loadVisibleChunks();
            this.render();
        }
    }
    
    handleMouseUp() {
        this.dragging = false;
        this.canvas.style.cursor = 'default';
    }
    
    handleClick(e) {
        if (this.currentTile || this.isErasing) {
            const worldPos = this.screenToWorldCoords(e.clientX, e.clientY);
            const tileX = Math.floor(worldPos.x / this.tileSize);
            const tileY = Math.floor(worldPos.y / this.tileSize);
            
            this.setTileAt(tileX, tileY, this.isErasing ? null : this.currentTile);
            
            if (networking.isConnected && !networking.isHost) {
                // Send tile update to host
                networking.sendTileUpdate(tileX, tileY, this.isErasing ? null : this.currentTile?.id);
            }
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        // Zoom functionality can be added here
    }
    
    screenToWorldCoords(screenX, screenY) {
        return {
            x: (screenX + this.cameraX) / this.tileSize,
            y: (screenY + this.cameraY) / this.tileSize
        };
    }
    
    worldToChunkCoords(worldX, worldY) {
        return {
            chunkX: Math.floor(worldX / this.chunkSize),
            chunkY: Math.floor(worldY / this.chunkSize),
            localX: Math.floor(worldX % this.chunkSize),
            localY: Math.floor(worldY % this.chunkSize)
        };
    }
    
    loadVisibleChunks() {
        // Calculate visible chunks
        const visibleChunksX = Math.ceil(this.canvas.width / this.chunkPixelSize) + 1;
        const visibleChunksY = Math.ceil(this.canvas.height / this.chunkPixelSize) + 1;
        
        const startChunkX = Math.floor(this.cameraX / this.chunkPixelSize) - 1;
        const startChunkY = Math.floor(this.cameraY / this.chunkPixelSize) - 1;
        
        // Clear old chunks that are far away
        this.loadedChunks.forEach((chunk, key) => {
            const [chunkX, chunkY] = key.split(',').map(Number);
            if (chunkX < startChunkX - 1 || 
                chunkX > startChunkX + visibleChunksX + 1 || 
                chunkY < startChunkY - 1 || 
                chunkY > startChunkY + visibleChunksY + 1) {
                this.loadedChunks.delete(key);
            }
        });
        
        // Load new visible chunks
        for (let cx = startChunkX; cx < startChunkX + visibleChunksX; cx++) {
            for (let cy = startChunkY; cy < startChunkY + visibleChunksY; cy++) {
                const chunkKey = `${cx},${cy}`;
                
                if (!this.loadedChunks.has(chunkKey)) {
                    // Load chunk from storage
                    const chunkData = this.storageManager.getChunk(cx, cy);
                    if (chunkData) {
                        this.loadedChunks.set(chunkKey, chunkData);
                        
                        // Preload tile images
                        if (chunkData.tiles) {
                            Object.values(chunkData.tiles).forEach(tile => {
                                if (tile && !this.imageCache.has(tile.id)) {
                                    this.preloadImage(tile);
                                }
                            });
                        }
                    } else {
                        // Initialize an empty chunk
                        this.loadedChunks.set(chunkKey, { 
                            x: cx, 
                            y: cy, 
                            tiles: {} 
                        });
                    }
                }
            }
        }
    }
    
    preloadImage(tile) {
        if (!this.imageCache.has(tile.id)) {
            const img = new Image();
            img.src = tile.url;
            this.imageCache.set(tile.id, img);
        }
    }
    
    getTileAt(tileX, tileY) {
        const { chunkX, chunkY, localX, localY } = this.worldToChunkCoords(tileX, tileY);
        const chunkKey = `${chunkX},${chunkY}`;
        
        const chunk = this.loadedChunks.get(chunkKey);
        if (!chunk || !chunk.tiles) return null;
        
        const tileKey = `${localX},${localY}`;
        return chunk.tiles[tileKey] || null;
    }
    
    setTileAt(tileX, tileY, tileData) {
        const { chunkX, chunkY, localX, localY } = this.worldToChunkCoords(tileX, tileY);
        const chunkKey = `${chunkX},${chunkY}`;
        
        // Ensure the chunk is loaded
        if (!this.loadedChunks.has(chunkKey)) {
            this.loadedChunks.set(chunkKey, { 
                x: chunkX, 
                y: chunkY, 
                tiles: {} 
            });
        }
        
        const chunk = this.loadedChunks.get(chunkKey);
        if (!chunk.tiles) chunk.tiles = {};
        
        const tileKey = `${localX},${localY}`;
        
        if (tileData) {
            chunk.tiles[tileKey] = tileData;
            
            // Preload the image if necessary
            this.preloadImage(tileData);
        } else {
            // Remove tile if erasing
            if (chunk.tiles[tileKey]) {
                delete chunk.tiles[tileKey];
            }
        }
        
        // Save chunk to storage
        this.storageManager.saveChunk(chunkX, chunkY, chunk);
        
        // Re-render
        this.render();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw loaded chunks
        this.loadedChunks.forEach(chunk => {
            this.drawChunk(chunk);
        });
        
        // Draw grid lines
        this.drawGridLines();
    }
    
    drawChunk(chunk) {
        const chunkScreenX = chunk.x * this.chunkPixelSize - this.cameraX;
        const chunkScreenY = chunk.y * this.chunkPixelSize - this.cameraY;
        
        // Skip if chunk is completely outside the viewport
        if (chunkScreenX + this.chunkPixelSize < 0 || 
            chunkScreenY + this.chunkPixelSize < 0 || 
            chunkScreenX > this.canvas.width || 
            chunkScreenY > this.canvas.height) {
            return;
        }
        
        // Draw tiles in the chunk
        if (chunk.tiles) {
            Object.entries(chunk.tiles).forEach(([tileKey, tileData]) => {
                if (!tileData) return;
                
                const [localX, localY] = tileKey.split(',').map(Number);
                const screenX = chunkScreenX + localX * this.tileSize;
                const screenY = chunkScreenY + localY * this.tileSize;
                
                // Draw the tile if it's in view
                if (screenX + this.tileSize >= 0 && 
                    screenY + this.tileSize >= 0 && 
                    screenX <= this.canvas.width && 
                    screenY <= this.canvas.height) {
                    
                    // Draw tile from cache
                    if (this.imageCache.has(tileData.id)) {
                        const img = this.imageCache.get(tileData.id);
                        if (img.complete) {
                            this.ctx.drawImage(img, screenX, screenY, this.tileSize, this.tileSize);
                        }
                    }
                }
            });
        }
    }
    
    drawGridLines() {
        this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        this.ctx.lineWidth = 1;
        
        // Calculate grid boundaries
        const startX = this.cameraX % this.tileSize;
        const startY = this.cameraY % this.tileSize;
        
        // Draw vertical lines
        for (let x = -startX; x <= this.canvas.width; x += this.tileSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = -startY; y <= this.canvas.height; y += this.tileSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // Draw chunk boundaries with different color
        this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
        this.ctx.lineWidth = 2;
        
        const chunkOffsetX = (this.cameraX % this.chunkPixelSize);
        const chunkOffsetY = (this.cameraY % this.chunkPixelSize);
        
        // Draw vertical chunk lines
        for (let x = -chunkOffsetX; x <= this.canvas.width; x += this.chunkPixelSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal chunk lines
        for (let y = -chunkOffsetY; y <= this.canvas.height; y += this.chunkPixelSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    selectTile(tile) {
        this.currentTile = tile;
        this.isErasing = false;
    }
    
    enableEraser() {
        this.currentTile = null;
        this.isErasing = true;
    }
}

