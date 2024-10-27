from duckduckgo_search import DDGS
from typing import Dict, List, Tuple
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import time
import json
import subprocess
import sys
import platform
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn


class OllamaFactChecker:
    def __init__(self, model_name="mistral"):
        self.model_name = model_name
        self.ollama_url = "http://localhost:11434/api/chat"
        self.search_engine = DDGS()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        # Initialize the sentence transformer model
        print("Loading sentence transformer model...")
        self.sentence_transformer = SentenceTransformer('all-MiniLM-L6-v2')
        self.ensure_ollama_running()

    def summarize_combined_content(self, statement: str, sources: List[Dict], max_sentences: int = 10) -> str:
        # Combine all source content with source attribution
        combined_text = ""
        for source in sources:
            combined_text += f"\nFrom {source['domain']}:\n{source['content']}\n"
        
        # Split combined content into sentences
        sentences = [s.strip() for s in combined_text.split('.') if len(s.strip()) > 20]
        
        if not sentences:
            return combined_text

        # Get embeddings for the statement and all sentences
        statement_embedding = self.sentence_transformer.encode([statement], show_progress_bar=False)
        sentence_embeddings = self.sentence_transformer.encode(sentences, show_progress_bar=False)

        # Calculate similarity scores
        similarities = cosine_similarity(statement_embedding, sentence_embeddings)[0]

        # Get the indices of the most relevant sentences
        top_indices = np.argsort(similarities)[-max_sentences:]

        # Return the most relevant sentences in their original order
        relevant_sentences = [sentences[i] for i in sorted(top_indices)]
        
        summarized_text = '. '.join(relevant_sentences) + '.'
        print(f"\nReduced combined content from {len(combined_text)} to {len(summarized_text)} characters")
        return summarized_text

    def summarize_content(self, statement: str, content: str, max_sentences: int = 5) -> str:
        # Split content into sentences
        sentences = [s.strip() for s in content.split('.') if len(s.strip()) > 20]
        
        if not sentences:
            return content

        # Get embeddings for the statement and all sentences
        statement_embedding = self.sentence_transformer.encode([statement], show_progress_bar=False)
        sentence_embeddings = self.sentence_transformer.encode(sentences, show_progress_bar=False)

        # Calculate similarity scores
        similarities = cosine_similarity(statement_embedding, sentence_embeddings)[0]

        # Get the indices of the most relevant sentences
        top_indices = np.argsort(similarities)[-max_sentences:]

        # Return the most relevant sentences in their original order
        relevant_sentences = [sentences[i] for i in sorted(top_indices)]
        
        return '. '.join(relevant_sentences) + '.'


    def _analyze_with_ollama(self, statement: str, summarized_content: str) -> Dict:
        # Create a more concise prompt using the final summary
        prompt = f"""Fact-check this statement using the provided evidence:

    Statement: "{statement}"

    Evidence:
    {summarized_content}

    Respond with JSON:
    {{
        "verdict": "Must be one of the following: Likely True, Likely False, Partially True, Partially False, Unable to Verify",
        "explanation": "brief explanation with evidence (key points) and nuances (important context)"
    }}"""

        try:
            print("\nSending request to Ollama...")
            print(f"Prompt length: {len(prompt)} characters")
            
            response = requests.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": self.model_name,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "stream": False
                }
            )
            response.raise_for_status()
            
            response_data = response.json()
            response_content = response_data.get('message', {}).get('content', '')
            
            print("\nReceived response from Ollama")
            print(f"Response preview: {response_content[:200]}...")
            
            try:
                analysis = json.loads(response_content)
                return analysis
            except json.JSONDecodeError:
                print(f"Failed to parse response as JSON. Raw response:\n{response_content}")
                return {
                    "statement": statement,
                    "result": "Partially True",
                    "explanation": "Error in analysis - Failed to parse model response as JSON"
                }
                
        except Exception as e:
            print(f"Ollama analysis error: {e}")
            return {
                "statement": statement,
                "result": "Partially True",
                "explanation": f"Error in analysis - Error during Ollama analysis {str(e)}"
            }

    def ensure_ollama_running(self):
        try:
            requests.get("http://localhost:11434/api/version")
            print("Ollama server is already running")
            return
        except requests.exceptions.ConnectionError:
            print("Ollama server is not running. Attempting to start...")

        system = platform.system().lower()
        try:
            if system == "windows":
                subprocess.Popen(["ollama", "serve"], 
                               creationflags=subprocess.CREATE_NEW_CONSOLE)
            else:
                subprocess.Popen(["ollama", "serve"],
                               stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE)
            
            max_attempts = 30
            attempts = 0
            while attempts < max_attempts:
                try:
                    requests.get("http://localhost:11434/api/version")
                    print("Ollama server started successfully")
                    self.ensure_model_available()
                    return
                except requests.exceptions.ConnectionError:
                    attempts += 1
                    time.sleep(1)
                    
            raise Exception("Failed to start Ollama server after 30 seconds")
            
        except Exception as e:
            print(f"Error starting Ollama: {e}")
            print("Please make sure Ollama is installed and accessible from command line")
            sys.exit(1)

    def ensure_model_available(self):
        try:
            response = requests.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                models = response.json()
                model_exists = any(model['name'] == self.model_name for model in models['models'])
                
                if not model_exists:
                    print(f"Model {self.model_name} not found. Pulling model...")
                    subprocess.run(["ollama", "pull", self.model_name])
                    print(f"Model {self.model_name} pulled successfully")
        except Exception as e:
            print(f"Error checking/pulling model: {e}")
            sys.exit(1)

    def check_statement(self, statement: str) -> Dict:
        try:
            print("\nSearching for relevant information...")
            regular_results = list(self.search_engine.text(
                statement,
                max_results=3
            ))
            print(f"Found {len(regular_results)} regular search results")
            
            debunk_results = list(self.search_engine.text(
                f"fact check {statement}",
                max_results=2
            ))
            print(f"Found {len(debunk_results)} fact-check results")
            
            all_results = regular_results + debunk_results
            
            if not all_results:
                return {
                    "statement": statement,
                    "result": "Partially True",
                    "explanation": "Unable to verify - no valid sources. No relevant sources found to verify the claim."
                }

            # Print the URLs that will be processed
            print("\nFound the following URLs to analyze:")
            for result in all_results:
                url = result.get('link') or result.get('href')
                print(f"- {url or 'No URL found'}")

            analysis_result = self._analyze_sources(statement, all_results)
            return analysis_result
            
        except Exception as e:
            print(f"Search error: {e}")
            return {
                "statement": statement,
                "result": "Partially True",
                "explanation": "Unable to verify - search error"
            }


    def _extract_text_from_url(self, url: str) -> str:
        try:
            print(f"\nAttempting to extract text from: {url}")
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()
            
            # Try different content extraction strategies
            content = ""
            
            # Strategy 1: Look for article or main content
            main_content = soup.find(['article', 'main', 'div[role="main"]'])
            if main_content:
                content = main_content.get_text(strip=True, separator=' ')
            
            # Strategy 2: If no main content, get all paragraphs
            if not content:
                paragraphs = soup.find_all('p')
                content = ' '.join(p.get_text(strip=True) for p in paragraphs)
            
            # Strategy 3: If still no content, get all text from body
            if not content:
                content = soup.body.get_text(strip=True, separator=' ') if soup.body else ''
            
            # Clean up the text
            content = re.sub(r'\s+', ' ', content).strip()
            
            if content:
                print(f"Successfully extracted {len(content)} characters")
                # Print the first 100 characters as preview
                print(f"Preview: {content[:100]}...")
                return content[:8000]
            else:
                print("No content extracted")
                return ""
                
        except Exception as e:
            print(f"Error scraping {url}: {str(e)}")
            return ""

    def _analyze_sources(self, statement: str, results: List[Dict]) -> Dict:
        sources_data = []
        print(f"\nFound {len(results)} potential sources to analyze")
        
        for i, result in enumerate(results, 1):
            print(f"\nProcessing source {i}/{len(results)}")
            url = result.get('link') or result.get('href')
            if not url:
                print(f"No URL found in result: {result}")
                continue

            print(f"Processing: {url}")
            domain = urlparse(url).netloc
            full_content = self._extract_text_from_url(url)
            
            if full_content and len(full_content.strip()) > 100:
                # First summarization - per source
                summarized_content = self.summarize_content(statement, full_content)
                
                source_data = {
                    "domain": domain,
                    "url": url,
                    "content": summarized_content,
                    "title": result.get('title', '')
                }
                sources_data.append(source_data)
                print(f"Successfully added source: {domain}")
                print(f"Summarized content length: {len(summarized_content)} characters")
                print(f"Original content length: {len(full_content)} characters")
            else:
                print(f"Insufficient content extracted from: {url}")
            
            time.sleep(1)

        if not sources_data:
            print("\nNo valid content could be extracted from any sources")
            return {
                "statement": statement,
                "result": "Partially True",
                "explanation": "Unable to verify - no valid sources"
            }

        # Second summarization - combine and summarize all sources together
        final_summary = self.summarize_combined_content(statement, sources_data)
        
        print(f"\nSuccessfully processed {len(sources_data)} sources with content")
        print("Final summarized content length:", len(final_summary))
        
        # # Create analysis using the final summary
        # analysis = self._analyze_with_ollama(statement, final_summary)
        # analysis["sources"] = [{"url": s["url"], "domain": s["domain"]} for s in sources_data]
        
        # return analysis
    
    # Create analysis using the final summary
        analysis = self._analyze_with_ollama(statement, final_summary)
        sources = [s["url"] + "\n" for s in sources_data]
        sources = "\n".join(sources)
        # Combine all analysis components into a single explanation
        combined_explanation = f"""{analysis['explanation']}
Sources: {sources}"""
        print(combined_explanation)

        # Create new response structure
        response = {
            "statement": statement,
            "result": analysis['verdict'],
            "explanation": combined_explanation
        }
        
        return response

app = FastAPI()
checker = OllamaFactChecker()

class StatementRequest(BaseModel):
    statement: str

@app.post("/check")
async def check_statement(request: StatementRequest):
    try:
        if not request.statement.strip():
            raise HTTPException(status_code=400, detail="Statement cannot be empty")
            
        # Get the fact check result
        result = checker.check_statement(request.statement)
        
        # Forward the result to the service running on port 8000
        try:
            forward_response = requests.post(
                "http://localhost:8000/send-fact-check",  # Changed to correct endpoint
                json=result,
                headers={"Content-Type": "application/json"}
            )
            forward_response.raise_for_status()
            
            # Return the result to the original caller as well
            return result
            
        except requests.exceptions.RequestException as e:
            print(f"Warning: Failed to forward result to port 8000: {e}")
            # Still return the result even if forwarding failed
            return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    print("Starting Fact Checker Server...")
    uvicorn.run(app, host="0.0.0.0", port=8001)