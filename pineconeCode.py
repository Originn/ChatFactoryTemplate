# Import Pinecone correctly
from pinecone import Pinecone

# Initialize the Pinecone client
pc = Pinecone(api_key='c67c46c1-c8f1-42ef-aa7f-c729c8fb6a99', environment='us-west4-gcp')

# List indexes and print the result
info = pc.list_indexes()
print(info)
