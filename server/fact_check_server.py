from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal
import uvicorn

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
    result: Literal["True", "False", "Partially True"]
    explanation: str

# Store active WebSocket connections
active_connections: list[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except:
        active_connections.remove(websocket)

@app.post("/send-fact-check")
async def send_fact_check(fact_check: FactCheck):
    # Broadcast the fact check to all connected clients
    for connection in active_connections:
        await connection.send_json({
            "type": "NEW_FACT_CHECK",
            "factCheck": fact_check.dict()
        })
    return {"status": "sent"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
