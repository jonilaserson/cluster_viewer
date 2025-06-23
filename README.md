# Image Cluster Viewer

A web application for browsing images grouped by their component (cluster ID) from a CSV file.

## Features

- Upload a CSV file with columns "local_path" (path to image) and "component" (cluster ID)
- Browse images grouped by component/cluster ID
- Sort components by the number of images they contain (most to least)
- Exclude component with ID -1
- Show a batch of ~10 clusters at a time
- Quick navigation through clusters
- Adjust thumbnail size with a slider (up to 420px)
- Display additional information like condition and hashed case ID (first 5 letters)
- Click on a cluster header to "zoom in" and view only that cluster
- Uses full screen width for better visibility
- When zoomed in, the selected cluster expands to take the entire available space
- Zoomed-in view automatically uses larger thumbnails (420px)

## Setup and Usage

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

4. Upload the CSV file (`experimental/j_laserson/6k_clustered.csv`) using the file input.

5. Browse through the clusters using the navigation buttons.

## CSV File Format

The application expects a CSV file with at least the following columns:
- `local_path`: Path to the image file
- `component`: Cluster ID (numeric)

Additional columns that will be used if present:
- `name`: Name of the image
- `condition`: Medical condition or other classification
- `hashed_case_id`: Case ID hash (first 5 letters will be displayed)

## Implementation Details

- The application uses a Node.js Express server to serve the static files and handle image requests
- Images are served from their absolute paths on the server
- The frontend is built with vanilla JavaScript, HTML, and CSS
- Clusters are sorted by the number of images they contain (descending)
- Clusters with component ID -1 are excluded