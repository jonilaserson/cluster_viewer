const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Special route to serve images from their absolute paths
app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;

    // Read the CSV file to find the full path for this filename
    fs.readFile(path.join(__dirname, '..', '6k_clustered.csv'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading CSV file:', err);
            return res.status(500).send('Error reading CSV file');
        }

        const lines = data.split('\n');
        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Simple CSV parsing (not handling quoted fields with commas)
            const fields = line.split(',');

            // Find the local_path column (assuming it's the second column based on the sample)
            const localPath = fields[1];

            if (localPath && localPath.includes(filename)) {
                // Found the matching file
                if (fs.existsSync(localPath)) {
                    return res.sendFile(localPath);
                } else {
                    console.log(`File not found: ${localPath}`);
                }
            }
        }

        // If we get here, we didn't find the file
        res.status(404).send('Image not found');
    });
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