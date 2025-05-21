import os
from pinecone import Pinecone

api_key = os.getenv("PINECONE_API_KEY")
environment = os.getenv("PINECONE_ENVIRONMENT", "us-east-1")

pc = Pinecone(api_key=api_key, environment=environment)
info = pc.list_indexes()
print(info)
