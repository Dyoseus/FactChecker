import requests

response = requests.post(
    "http://localhost:8000/check",
    json={"statement": "does trump hate black people"}
)
print(response.json())
