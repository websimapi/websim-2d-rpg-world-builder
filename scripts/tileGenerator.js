class TileGenerator {
    constructor() {
        this.generatingTile = false;
    }

    // Generate tile image based on prompt using AI
    async generateTile(prompt) {
        if (this.generatingTile) {
            throw new Error('Already generating a tile');
        }
        
        this.generatingTile = true;
        
        try {
            // Generate a tile image using AI
            const result = await websim.imageGen({
                prompt: prompt,
                width: 256,
                height: 256,
            });
            
            // Create a tile object
            const newTile = {
                id: 'tile_' + Date.now(),
                name: prompt.substring(0, 20) + '...',
                description: prompt,
                url: result.url,
                timestamp: Date.now()
            };
            
            return newTile;
        } catch (error) {
            console.error('Error generating tile:', error);
            throw error;
        } finally {
            this.generatingTile = false;
        }
    }
}

