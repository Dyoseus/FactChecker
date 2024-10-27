// contentScript.js

// Function to extract live captions
function getCaptions() {
    const captions = document.querySelector('.caption-window');
    return captions ? captions.innerText.trim() : '';
}

// Keep track of the last sent caption to avoid redundant processing
let lastCaption = '';
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 5000; // Minimum time between requests (5 seconds)

// Set an interval to capture captions
setInterval(() => {
    const text = getCaptions();
    const currentTime = Date.now();
    
    // Only process if we have new text and enough time has passed since last request
    if (text && 
        text !== lastCaption && 
        currentTime - lastRequestTime >= MIN_REQUEST_INTERVAL) {
        
        lastCaption = text;
        lastRequestTime = currentTime;
        console.log('Captured captions:', text);

        // Send live captions to the background script for fact-checking
        chrome.runtime.sendMessage({ type: 'FACT_CHECK', text: text }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
            }
        });
    }
}, 1000); // Check every second, but rate limit actual requests

// Listen for fact-check results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FACT_CHECK_RESULT') {
        console.log('Fact check result received:', message.data);
        showFactCheckPopup(message.data);
    }
});

// Function to show fact-check results in a popup on the page
function showFactCheckPopup(result) {
    // Remove any existing popups
    const existingPopup = document.querySelector('.fact-check-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'fact-check-popup';
    popup.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: white;
        border: 2px solid #ccc;
        border-radius: 8px;
        padding: 15px;
        z-index: 9999;
        max-width: 350px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
    `;

    // Display fact-check information
    if (result.status === 'success' && result.claimReview && result.claimReview.length > 0) {
        const claimReview = result.claimReview[0];
        popup.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #1a73e8;">Fact Check Result</div>
            <div style="margin-bottom: 8px; font-style: italic;">"${result.text}"</div>
            <div style="margin-bottom: 5px;"><strong>Source:</strong> ${result.claimant || 'Unknown'}</div>
            <div style="margin-bottom: 5px;"><strong>Verified by:</strong> ${claimReview.publisher.name}</div>
            <div style="margin-bottom: 10px;"><strong>Rating:</strong> ${claimReview.textualRating}</div>
            <a href="${claimReview.url}" target="_blank" style="color: #1a73e8; text-decoration: none;">Read Full Review</a>
        `;
    } else if (result.status === 'not_found') {
        popup.innerHTML = `
            <div style="color: #666;">
                No fact-check found for this statement.
            </div>
        `;
    } else {
        popup.innerHTML = `
            <div style="color: #d93025;">
                Error: ${result.message || 'An unknown error occurred'}
            </div>
        `;
    }

    document.body.appendChild(popup);

    // Remove the popup after 10 seconds
    setTimeout(() => {
        if (popup && popup.parentElement) {
            popup.remove();
        }
    }, 10000);
}