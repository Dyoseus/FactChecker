import whisper
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import ffmpeg
import io

app = Flask(__name__)
CORS(app)  # Enable CORS to allow cross-origin requests

# Load Whisper model (use GPU if available)
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("base").to(device)

def load_audio(file: bytes, sr: int = 16000) -> np.ndarray:
    """
    Load an audio file and convert it to a NumPy array in 16kHz mono.
    """
    try:
        # Use ffmpeg to decode audio bytes to a NumPy array
        out, _ = (
            ffmpeg.input('pipe:0')
            .output('pipe:1', format='wav', acodec='pcm_s16le', ac=1, ar=sr)
            .run(input=file, capture_stdout=True, capture_stderr=True)
        )
        
        # Convert the output to a NumPy array
        audio = np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0
        return audio
    except ffmpeg.Error as e:
        print(f"Error decoding audio: {e.stderr}")
        raise

# Route to transcribe live audio
@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"status": "error", "message": "No audio file received."}), 400

    audio_file = request.files['audio'].read()  # Get the raw audio data

    try:
        # Convert raw audio data to NumPy array using the helper function
        audio_data = load_audio(audio_file)

        # Transcribe the audio using Whisper
        print("Transcribing audio...")
        result = model.transcribe(audio_data)
        transcription = result['text']
        print("Transcription complete:", transcription)

        return jsonify({"text": transcription})

    except Exception as e:
        print(f"Error during transcription: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
