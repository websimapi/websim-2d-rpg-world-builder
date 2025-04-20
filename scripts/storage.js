class StorageManager {
    constructor() {
        this.WORLD_DATA_KEY = 'rpg_world_data';
        this.TILE_LIBRARY_KEY = 'rpg_tile_library';
    }

    // Save generated tiles to localStorage
    saveTile(tile) {
        const tileLibrary = this.getTileLibrary();
        tileLibrary.push(tile);
        localStorage.setItem(this.TILE_LIBRARY_KEY, JSON.stringify(tileLibrary));
        return tileLibrary;
    }

    // Get all tiles from localStorage
    getTileLibrary() {
        const tileLibraryString = localStorage.getItem(this.TILE_LIBRARY_KEY);
        return tileLibraryString ? JSON.parse(tileLibraryString) : [];
    }

    // Save world data to localStorage
    saveWorld(worldData) {
        localStorage.setItem(this.WORLD_DATA_KEY, JSON.stringify(worldData));
    }

    // Load world data from localStorage
    loadWorld() {
        const worldDataString = localStorage.getItem(this.WORLD_DATA_KEY);
        return worldDataString ? JSON.parse(worldDataString) : null;
    }

    // Get a specific chunk from the world data
    getChunk(x, y) {
        const worldData = this.loadWorld() || { chunks: {} };
        const chunkKey = `${x},${y}`;
        return worldData.chunks[chunkKey] || null;
    }

    // Save a specific chunk to the world data
    saveChunk(x, y, chunkData) {
        const worldData = this.loadWorld() || { chunks: {} };
        const chunkKey = `${x},${y}`;
        worldData.chunks[chunkKey] = chunkData;
        this.saveWorld(worldData);
    }

    // Clear all data
    clearAllData() {
        localStorage.removeItem(this.WORLD_DATA_KEY);
        localStorage.removeItem(this.TILE_LIBRARY_KEY);
    }
}

