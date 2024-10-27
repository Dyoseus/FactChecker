// contentScript.js

// Function to extract live captions
function getCaptions() {
    const captions = document.querySelector('.caption-window');
    return captions ? captions.innerText.trim() : '';
}

// Keep track of the last sent caption and current query
let accumulatedCaptions = '';
let pendingCaptions = '';  // Store new captions while waiting for fact check
let lastRequestTime = 0;
let isFactCheckPending = false;
const MIN_REQUEST_INTERVAL = 2000; // 5 seconds
const MAX_WORD_COUNT = 30;
const POPUP_DURATION = 8000; // 8 seconds for popup display

// Helper function to count words
function countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Function to trim excess words to maintain max word count
function trimToMaxWords(text) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length <= MAX_WORD_COUNT) {
        return text;
    }
    return words.slice(-(MAX_WORD_COUNT)).join(' ');
}

// Function to send result.text to the backend server via POST
function sendToBackend(claimText) {
    const backendURL = 'http://localhost:8004/check';
    fetch(backendURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: claimText  // Changed from 'claimText' to 'statement' to match your backend
    
    }).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Sent claim to backend successfully:', data);
    })
    .catch(error => {
        console.error('❌ Error sending claim to backend:', error);
        console.error('Request details:', {
            url: backendURL,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                statement: claimText
            })
        });
    });
}

// Function to perform fact check
function performFactCheck(text) {
    isFactCheckPending = true;
    chrome.runtime.sendMessage({ type: 'FACT_CHECK', text: text }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            isFactCheckPending = false;
        }
    });
}

// Add rainbow animation styles to the document
function injectStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes rainbow-border {
            0% { border-color: #ff0000; }
            17% { border-color: #ff8000; }
            33% { border-color: #ffff00; }
            50% { border-color: #00ff00; }
            67% { border-color: #0000ff; }
            83% { border-color: #8000ff; }
            100% { border-color: #ff0000; }
        }
        
        @keyframes rainbow-text {
            0% { color: #ff0000; }
            17% { color: #ff8000; }
            33% { color: #ffff00; }
            50% { color: #00ff00; }
            67% { color: #0000ff; }
            83% { color: #8000ff; }
            100% { color: #ff0000; }
        }

        .fact-check-popup {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: rgba(255, 255, 255, 0.95);
            border: 3px solid #ff0000;
            border-radius: 12px;
            padding: 15px;
            z-index: 9999;
            max-width: 350px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            animation: rainbow-border 5s linear infinite;
            backdrop-filter: blur(5px);
        }

        .fact-check-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            animation: rainbow-text 5s linear infinite;
        }

        .fact-check-claim {
            font-style: italic;
            margin-bottom: 12px;
            padding: 8px;
            background-color: rgba(0,0,0,0.05);
            border-radius: 6px;
        }

        .fact-check-source {
            margin-bottom: 8px;
            font-weight: 500;
        }

        .fact-check-rating {
            margin-bottom: 10px;
            padding: 5px 10px;
            border-radius: 15px;
            display: inline-block;
            font-weight: bold;
            animation: rainbow-text 5s linear infinite;
        }

        .fact-check-link {
            display: inline-block;
            margin-top: 8px;
            color: #1a73e8;
            text-decoration: none;
            transition: color 0.3s;
        }

        .fact-check-link:hover {
            text-decoration: underline;
            animation: rainbow-text 5s linear infinite;
        }
    `;
    document.head.appendChild(styleSheet);
}

// Inject styles when script loads
injectStyles();         

// Set an interval to capture and accumulate captions
setInterval(() => {
    const newCaption = getCaptions();
    const currentTime = Date.now();
    
    // Store new captions while waiting
    if (newCaption) {
        pendingCaptions += ' ' + newCaption;
        pendingCaptions = pendingCaptions.trim();
        console.log('📝 New caption captured:', {
            caption: newCaption,
            pendingCaptions: pendingCaptions
        });
    }
    
    // Only process if enough time has passed since last request
    if (currentTime - lastRequestTime >= MIN_REQUEST_INTERVAL) {
        lastRequestTime = currentTime;
        
        // If we have pending captions, append them to accumulated captions
        if (pendingCaptions) {
            if (accumulatedCaptions) {
                accumulatedCaptions += ' ' + pendingCaptions;
            } else {
                accumulatedCaptions = pendingCaptions;
            }
            pendingCaptions = ''; // Reset pending captions
        }

        // Ensure we don't exceed MAX_WORD_COUNT words
        if (countWords(accumulatedCaptions) > MAX_WORD_COUNT) {
            accumulatedCaptions = trimToMaxWords(accumulatedCaptions);
        }

        // Perform fact check if we have content and no pending check
        if (!isFactCheckPending && accumulatedCaptions) {
            performFactCheck(accumulatedCaptions);
        }
    }
}, 1000);

// Listen for fact-check results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FACT_CHECK_RESULT') {
        isFactCheckPending = false;

        if (message.data.status === 'success' && message.data.claimReview && message.data.claimReview.length > 0) {
            showFactCheckPopup(message.data);
            sendToBackend(message.data.text); // Send to backend

            accumulatedCaptions = ''; // Reset only when a fact is found
            pendingCaptions = ''; // Clear any pending captions
        }
    }
});

// Function to show fact-check results in a popup on the page
function showFactCheckPopup(result) {
    const existingPopup = document.querySelector('.fact-check-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'fact-check-popup';

    if (result.status === 'success' && result.claimReview && result.claimReview.length > 0) {
        const claimReview = result.claimReview[0];
        const webAppSearchLink = `http://localhost:3000/search?q=${encodeURIComponent(result.text)}`; // Local web app search link

        popup.innerHTML = `
            <div class="fact-check-title">Fact Check Result</div>
            <div class="fact-check-claim">"${result.text}"</div>
            <div class="fact-check-source"><strong>Source:</strong> ${result.claimant || 'Unknown'}</div>
            <div><strong>Verified by:</strong> ${claimReview.publisher.name}</div>
            <div class="fact-check-rating"><strong>Rating:</strong> ${claimReview.textualRating}</div>
            <a href="${claimReview.url}" target="_blank" class="fact-check-link">Read Full Review</a>
            <a href="${webAppSearchLink}" target="_blank" class="fact-check-link">Search in Web App</a>
        `;
    } else {
        popup.innerHTML = `<div class="fact-check-title">No Results Found</div>`;
    }

    document.body.appendChild(popup);

    setTimeout(() => {
        if (popup && popup.parentElement) {
            popup.remove();
        }
    }, POPUP_DURATION);
}
