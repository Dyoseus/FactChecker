# 🔍 FactChecker

A powerful browser-based fact-checking tool that helps users verify information in real-time.

## 🌟 Features

- **Real-time Fact Checking**: Analyze statements directly from web pages
- **Browser Extension**: Seamless integration with your browsing experience
- **AI-Powered Analysis**: Utilizes advanced NLP for accurate fact verification
- **User-Friendly Interface**: Clean, modern Next.js frontend
- **Privacy-Focused**: Local processing capabilities using Ollama

## 🏗️ Architecture

The project consists of three main components:

### 1. Browser Extension (./client)
- Chrome/Firefox compatible extension
- Real-time content analysis
- Sentence tokenization
- OAuth authentication

### 2. Backend Server (./server)
- Fast and efficient fact-checking server
- DuckDuckGo integration for web searches
- Ollama integration for AI processing
- RESTful API endpoints

### 3. Frontend Application (./frontend)
- Modern Next.js application
- Responsive UI with Tailwind CSS
- Real-time results display
- Interactive fact-checking interface

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+
- Ollama installed locally

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/FactChecker.git
cd FactChecker
```
2. Install backend dependencies
```bash
pip install -r requirements.txt
```
3. Install frontend dependencies
```bash
cd frontend/fact-checker-app
npm install
npm install lucide-react
```
4. Install browser extension dependencies
```bash
cd ../../client
npm install
```
### 🔧 Configuration
1. Set up your environment variables
2. Configure the Ollama model settings
3. Set up DuckDuckGo API credentials (if required)


## 🖥️ Usage

# Running the Server

```bash
cd server
python "duckduckgo ollama server.py"
python fact_check_server.py
```

# Starting the Frontend
```bash
cd frontend/fact-checker-app
npm run dev
```

# Loading the Browser Extension
1. Open your browser's extension management page
2. Enable developer mode
3. Load unpacked extension from the client directory

## 📚 API Documentation

The server exposes the following endpoints:
- `POST /check-fact`: Submit a statement for fact-checking
- `GET /results`: Retrieve fact-checking results
- `POST /feedback`: Submit user feedback

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - *Initial work* - [@elee012345](https://github.com/elee012345)

## 🙏 Acknowledgments

- Thanks to the Ollama team for their amazing AI models
- The Next.js team for their fantastic framework
- All contributors and supporters of this project

---



old readme in case i missed some things here

download and install ollama
ollama pull mistral
pip install requirements.txt (which we will totally have soon)
install npm
npm install lucide-react
probably some other things


need to start multiple services
IMPORTANT: RUN THESE IN ORDER
python duckduckgo ollama server.py
python fact_check_server.py
npm run dev in fact-checker-app
😛
