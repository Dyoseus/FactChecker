// contentScript.js

let tokenizer = new SentenceTokenizer();
let accumulatedText = '';
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 5000;
const MIN_SENTENCE_LENGTH = 50; // Increased minimum length
const MIN_WORD_COUNT = 8; // Minimum number of words

function getCaptions() {
    const captions = document.querySelector('.caption-window');
    return captions ? captions.innerText.trim() : '';
}

function countWords(text) {
    return text.split(/\s+/).length;
}

function extractAndProcessSentences(text) {
    // Add new text to accumulated buffer
    accumulatedText += ' ' + text;
    accumulatedText = accumulatedText.trim();

    // Try to extract complete sentences
    const sentences = tokenizer.tokenize(accumulatedText);
    
    if (sentences.length > 0) {
        // Filter sentences that are long enough and have enough words
        const validSentences = sentences.slice(0, -1).filter(sentence => 
            sentence.length >= MIN_SENTENCE_LENGTH && 
            countWords(sentence) >= MIN_WORD_COUNT
        );
        
        // Keep the potentially incomplete last sentence in the buffer
        accumulatedText = sentences[sentences.length - 1] || '';

        return validSentences;
    }
    
    return [];
}

setInterval(() => {
    const currentTime = Date.now();
    
    if (currentTime - lastRequestTime >= MIN_REQUEST_INTERVAL) {
        const newText = getCaptions();
        
        if (newText) {
            const sentences = extractAndProcessSentences(newText);
            
            sentences.forEach(sentence => {
                lastRequestTime = currentTime;
                console.log('Complete sentence found:', sentence);

                // Send for fact-checking
                chrome.runtime.sendMessage({ 
                    type: 'FACT_CHECK', 
                    text: sentence 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError);
                    }
                });
            });
        }
    }
}, MIN_REQUEST_INTERVAL);

// Clear accumulated text if no captions are visible for a while
let noTextCounter = 0;
setInterval(() => {
    const currentCaptions = getCaptions();
    if (!currentCaptions) {
        noTextCounter++;
        if (noTextCounter > 3) {
            accumulatedText = '';
            noTextCounter = 0;
        }
    } else {
        noTextCounter = 0;
    }
}, 5000);


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