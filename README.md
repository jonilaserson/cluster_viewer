# Image Cluster Viewer

A web application for browsing, analyzing, and verifying images grouped by cluster ID from a CSV file.

## Key Features

### Cluster Navigation and Visualization
- Browse images grouped by cluster ID with intuitive navigation
- Sort clusters by size (most images to least)
- View clusters in batches with pagination controls
- Click anywhere on a cluster header to zoom in on that specific cluster
- Adjust thumbnail size with a slider for optimal viewing

### Image Analysis
- Query images using JavaScript expressions (e.g., "bucket < 15")
- Mark matching images that satisfy query conditions
- Filter to show only clusters containing matching images
- View image metadata including condition and case ID information

### Verification Workflow
- Select images within clusters for verification
- Export verified clusters to a new CSV file
- Track verification status with visual indicators
- Create remainder clusters for unselected images

### Duplicate Management
- Mark selected images as duplicates within clusters
- Assign duplicate groups with color-coded visual indicators
- Group-based selection (selecting one image in a duplicate group selects all)
- Reset duplicate markings as needed
- Export duplicate group information in the CSV output

## Setup and Usage

1. Install and start the server:
   ```
   npm install
   npm start
   ```

2. Open your browser to `http://localhost:3000`

3. Upload a CSV file with image paths and cluster IDs

4. Explore clusters using the navigation controls

## CSV File Format

Required columns:
- `local_path`: Full path to the image file
- `component`: Cluster ID (numeric)

Optional columns:
- `name`: Image name
- `condition`: Classification or category
- `hashed_case_id`: Case identifier
- `image_source` or `image.source`: Source of the image (supports both column names)
- Any additional columns can be used in queries

## Technical Notes

- Built with Node.js Express, vanilla JavaScript, HTML, and CSS
- Serves images directly from their absolute paths
- Supports filtering and advanced query expressions
- Optimized for browsing large sets of clustered images
