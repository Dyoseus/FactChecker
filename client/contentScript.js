let liveTranscript = '';  // Store the full live transcript

// Function to create a live transcription area on the page
function createLiveTranscriptArea() {
    const existingArea = document.querySelector('.live-transcript-area');
    if (existingArea) return;  // If the transcript area already exists, don't recreate it

    const transcriptDiv = document.createElement('div');
    transcriptDiv.className = 'live-transcript-area';
    transcriptDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 300px;
        height: 200px;
        overflow-y: auto;
        background-color: rgba(255, 255, 255, 0.9);
        border: 2px solid #ccc;
        padding: 15px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;

    const title = document.createElement('div');
    title.innerText = 'Live Transcript';
    title.style.cssText = 'font-weight: bold; margin-bottom: 10px;';
    transcriptDiv.appendChild(title);

    const transcriptText = document.createElement('div');
    transcriptText.className = 'transcript-text';
    transcriptDiv.appendChild(transcriptText);

    document.body.appendChild(transcriptDiv);
}

// Function to update the live transcript display
function updateLiveTranscript(text) {
    liveTranscript += text + ' ';  // Append the new chunk to the full transcript
    const transcriptArea = document.querySelector('.transcript-text');
    if (transcriptArea) {
        transcriptArea.innerText = liveTranscript.trim();  // Update the displayed transcript
    }
}

// Function to get the YouTube video element
function getYouTubeVideoElement() {
    return document.querySelector('video');
}

// Function to process audio input from the YouTube video
async function processAudioChunk(audioChunk) {
    const formData = new FormData();
    formData.append('audio', new Blob([audioChunk]), 'audio.wav');

    // Send the audio chunk to the Flask server for transcription
    const response = await fetch('http://localhost:5000/transcribe', {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();
    const transcribedText = data.text;

    // Update the live transcript with the new transcribed text
    updateLiveTranscript(transcribedText);

    // Continue processing the transcription (fact-checking etc.)
    const sentences = extractAndProcessSentences(transcribedText);

    sentences.forEach(sentence => {
        lastRequestTime = Date.now();
        console.log('Complete sentence found:', sentence);

        // Send each sentence for fact-checking
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

// Function to capture audio from the YouTube video
async function captureYouTubeAudio() {
    // Create the live transcript display
    createLiveTranscriptArea();

    // Get the YouTube video element
    const videoElement = getYouTubeVideoElement();
    if (!videoElement) {
        console.error('No YouTube video element found!');
        return;
    }

    // Create an AudioContext to capture the video audio
    const audioContext = new AudioContext();
    const videoSource = audioContext.createMediaElementSource(videoElement);
    
    // Create a processor node to handle audio chunks
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    videoSource.connect(processor);
    videoSource.connect(audioContext.destination);  // Play the video audio

    // Capture audio chunks from the video and process them
    processor.onaudioprocess = function (e) {
        const audioData = e.inputBuffer.getChannelData(0);
        processAudioChunk(audioData);  // Send to Flask server for transcription
    };
}

// Start capturing YouTube audio when the extension is activated
captureYouTubeAudio();

// Listen for fact-check results from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FACT_CHECK_RESULT') {
        console.log('Fact check result received:', message.data);
        showFactCheckPopup(message.data);
    }
});
