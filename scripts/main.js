// Initialize main components
const storageManager = new StorageManager();
const tileGenerator = new TileGenerator();

// Initialize canvas
const canvas = document.getElementById('worldCanvas');
const grid = new WorldGrid(canvas, storageManager);

// Initialize networking
const networking = new Networking(grid, storageManager);

// Initialize UI
const ui = new UI(storageManager, tileGenerator);

// Start the render loop
function animate() {
    requestAnimationFrame(animate);
    // Add any per-frame updates here if needed
}

// Start animation
animate();

// Don't initialize networking automatically to save resources
// It will be initialized when needed

