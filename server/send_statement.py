import requests
import json

response = requests.post(
    "http://localhost:8004/check",
    json={"statement": "Did they eat pets and dogs in springfield?"}
)
print(json.dumps(response.json(), indent=4))

