from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal
import uvicorn
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the FactCheck model
class FactCheck(BaseModel):
    statement: str
    result: Literal["Likely True", "Likely False", "Mostly False", "Partially False", "Unable to Verify"]
    explanation: str

# Store active WebSocket connections
active_connections: list[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection established")
    active_connections.append(websocket)
    try:
        while True:
            # Keep the connection alive
            data = await websocket.receive_text()
            logger.info(f"Received message: {data}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)
        logger.info("WebSocket connection closed")

@app.post("/send-fact-check")
async def send_fact_check(fact_check: FactCheck):
    logger.info(f"Received new fact check: {fact_check}")
    # Broadcast the fact check to all connected clients
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": "NEW_FACT_CHECK",
                "factCheck": fact_check.dict()
            })
            logger.info("Fact check sent successfully")
        except Exception as e:
            logger.error(f"Error sending fact check: {e}")
            active_connections.remove(connection)
    return {"status": "sent", "activeConnections": len(active_connections)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
