const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();

// Parse command line arguments
const argv = require('minimist')(process.argv.slice(2));
const PORT = argv.port || 3000; // Use port from command line or default to 3000

// Enable CORS for all routes
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Special route to serve images from their absolute paths
app.get('/images/:path(*)', (req, res) => {
    // The path parameter will capture the full path including slashes
    const imagePath = req.params.path;

    // Check if the path is absolute
    if (path.isAbsolute(imagePath)) {
        // Serve the file directly from its absolute path
        if (fs.existsSync(imagePath)) {
            return res.sendFile(imagePath);
        } else {
            console.log(`File not found: ${imagePath}`);
            return res.status(404).send('Image not found');
        }
    } else {
        // If it's not an absolute path, treat it as relative to the current directory
        const fullPath = path.join(process.cwd(), imagePath);
        if (fs.existsSync(fullPath)) {
            return res.sendFile(fullPath);
        } else {
            console.log(`File not found: ${fullPath}`);
            return res.status(404).send('Image not found');
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);

    // Open the browser automatically
    const url = `http://localhost:${PORT}/`;
    let command;

    switch (process.platform) {
        case 'darwin': // macOS
            command = `open ${url}`;
            break;
        case 'win32': // Windows
            command = `start ${url}`;
            break;
        default: // Linux and others
            command = `xdg-open ${url}`;
            break;
    }

    exec(command, (error) => {
        if (error) {
            console.error(`Failed to open browser: ${error}`);
            console.log(`Please open ${url} manually in your browser`);
        }
    });
});