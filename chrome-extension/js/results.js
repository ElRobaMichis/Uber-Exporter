// Get data from URL parameter or storage
let extractedData = [];

document.addEventListener('DOMContentLoaded', function() {
    // First try to get data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
        try {
            extractedData = JSON.parse(decodeURIComponent(dataParam));
            displayResults();
        } catch (e) {
            // If URL data fails, try chrome.storage
            loadFromStorage();
        }
    } else {
        // Load from chrome.storage
        loadFromStorage();
    }
    
    // Setup download button
    document.getElementById('downloadExcel').addEventListener('click', function() {
        if (extractedData.length > 0) {
            exportToExcel(extractedData);
        }
    });
});

function loadFromStorage() {
    chrome.storage.local.get(['extractionResults'], function(result) {
        if (result.extractionResults && result.extractionResults.length > 0) {
            extractedData = result.extractionResults;
            displayResults();
        } else {
            showError('No extraction results found. Please run the extraction again.');
        }
    });
}

function displayResults() {
    // Hide loading, show content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    
    // Calculate statistics
    const validRestaurants = extractedData.filter(r => 
        r.stars !== 'N/A' && r.reviews !== 'N/A' && 
        r.bayescore !== 'N/A' && !isNaN(parseFloat(r.bayescore))
    );
    
    const totalCount = extractedData.length;
    const avgRating = validRestaurants.reduce((sum, r) => sum + parseFloat(r.stars), 0) / validRestaurants.length || 0;
    const avgBayescore = validRestaurants.reduce((sum, r) => sum + parseFloat(r.bayescore), 0) / validRestaurants.length || 0;
    
    // Update statistics
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('avgRating').textContent = avgRating.toFixed(2);
    document.getElementById('avgBayescore').textContent = avgBayescore.toFixed(4);
    
    // Sort by Bayescore (with rating as tiebreaker) and display top 20
    const sortedData = [...extractedData]
        .filter(r => r.bayescore !== 'N/A' && !isNaN(parseFloat(r.bayescore)))
        .sort((a, b) => {
            const bayescoreA = parseFloat(a.bayescore) || 0;
            const bayescoreB = parseFloat(b.bayescore) || 0;
            
            if (bayescoreA !== bayescoreB) {
                return bayescoreB - bayescoreA;
            }
            
            const ratingA = parseFloat(a.stars) || 0;
            const ratingB = parseFloat(b.stars) || 0;
            
            return ratingB - ratingA;
        });
    
    // Display top 20 restaurants
    const tbody = document.getElementById('restaurantList');
    tbody.innerHTML = '';
    
    sortedData.slice(0, 20).forEach((restaurant, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="rank">#${index + 1}</td>
            <td>${restaurant.name}</td>
            <td>⭐ ${restaurant.stars}</td>
            <td>${restaurant.reviews} reviews</td>
            <td class="bayescore">${restaurant.bayescore}</td>
        `;
    });
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function exportToExcel(data) {
    try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data with Bayescore column and sort by Bayescore (descending) with rating as tiebreaker
        const wsData = data
            .sort((a, b) => {
                // First compare by Bayescore
                const bayescoreA = parseFloat(a.bayescore) || 0;
                const bayescoreB = parseFloat(b.bayescore) || 0;
                
                if (bayescoreA !== bayescoreB) {
                    return bayescoreB - bayescoreA; // Higher Bayescore first
                }
                
                // If Bayescores are equal, use original rating as tiebreaker
                const ratingA = parseFloat(a.stars) || 0;
                const ratingB = parseFloat(b.stars) || 0;
                
                return ratingB - ratingA; // Higher rating first
            })
            .map(item => ({
                name: item.name,
                stars: item.stars,
                reviews: item.reviews,
                bayescore: item.bayescore || 'N/A'
            }));
        
        // Convert data to worksheet
        const ws = XLSX.utils.json_to_sheet(wsData, {
            header: ['name', 'stars', 'reviews', 'bayescore'],
            skipHeader: false
        });
        
        // Set column headers
        XLSX.utils.sheet_add_aoa(ws, [['Name', 'Stars', 'Reviews', 'Bayescore']], {origin: 'A1'});
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Restaurants');
        
        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const filename = `uber_eats_restaurants_bayescore_${date}.xlsx`;
        
        // Write the file
        XLSX.writeFile(wb, filename);
        
        // Show success message
        const btn = document.getElementById('downloadExcel');
        const originalText = btn.textContent;
        btn.textContent = '✅ Downloaded!';
        btn.disabled = true;
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 3000);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error creating Excel file: ' + error.message);
    }
}