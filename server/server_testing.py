import requests
import json

response = requests.post(
    "http://localhost:8000/check",
    json={"statement": "is the book of exodus real"}
)
print(json.dumps(response.json(), indent=4))

