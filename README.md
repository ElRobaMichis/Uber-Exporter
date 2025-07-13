# Uber Eats Data Extractor Chrome Extension

A Chrome extension that extracts restaurant information from Uber Eats pages and exports the data to an XLSX file.

## Features

- Extract restaurant data including:
  - Restaurant Name
  - Star Rating
  - Number of Reviews
- Two extraction modes:
  - **Extract Visible**: Extracts only currently visible restaurants
  - **Extract All**: Auto-scrolls through the page to extract all restaurants
- Export data to XLSX format with proper formatting
- Right-click context menu for quick extraction
- Progress tracking during auto-scroll extraction

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `chrome-extension` directory
5. The extension icon will appear in your toolbar

## Usage

### Method 1: Using the Extension Popup
1. Navigate to any Uber Eats page (e.g., https://www.ubereats.com/)
2. Click the extension icon in your toolbar
3. Choose extraction method:
   - **Extract Visible Restaurants**: Quick extraction of currently visible items
   - **Extract All (Auto-scroll)**: Comprehensive extraction with automatic scrolling
4. Click "Download XLSX File" to save the data

### Method 2: Using Right-Click Menu
1. On any Uber Eats page, right-click
2. Select "Extract Uber Eats Data" from the context menu
3. The popup will open with the extracted data

## Output Format

The XLSX file contains three columns:
- **Name**: Restaurant name
- **Stars**: Rating (e.g., "4.5" or "N/A" if not available)
- **Reviews**: Number of reviews (e.g., "500" or "N/A" if not available)

## Notes

- The extension only works on Uber Eats websites (ubereats.com)
- Auto-scroll extraction may take 1-2 minutes depending on the number of restaurants
- The extension uses various selectors to adapt to Uber Eats' UI changes
- Data is extracted from the current view, so make sure the page is fully loaded

## Technical Details

- Built with Manifest V3
- Uses SheetJS library for XLSX generation
- Implements content script for data extraction
- Background service worker for context menu functionality

## Troubleshooting

- If no restaurants are found, try refreshing the page
- Ensure you're on a page that lists restaurants (not a specific restaurant page)
- Check the browser console for any error messages
- The extension requires an active internet connection to load the SheetJS library