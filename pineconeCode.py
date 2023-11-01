import pinecone  

pinecone.init(      
	api_key='1cdbe8f9-6f16-4828-a5e6-6fd62810db8f',      
	environment='us-west4-gcp'      
)      
index = pinecone.Index('solidcam')
index.delete(
    filter={
        "source": {"$eq": "https://storage.googleapis.com/solidcam/scturn.pdf"}
    }
)
