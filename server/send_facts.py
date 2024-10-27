import requests

response = requests.post(
    "http://localhost:8000/send-fact-check",
    json={
        "statement": "ur mom fat",
        "result": "True",
        "explanation": "bc she is"
    }
)
print(response.json())  # This will show how many active connections there are
