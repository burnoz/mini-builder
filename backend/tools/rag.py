from google.adk.tools import FunctionTool
from sentence_transformers import SentenceTransformer
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
embed_model = SentenceTransformer("intfloat/multilingual-e5-base")

def make_rag_tool(config: dict) -> FunctionTool:
    threshold = config.get("threshold", 0.3)
    top_k = config.get("top_k", 5)

    def search_knowledge_base(query: str) -> str:
        """
        Busca información relevante en la base de conocimiento.
        Úsala cuando necesites responder preguntas con contexto específico.

        Args:
            query: La pregunta o tema a buscar

        Returns:
            Contexto relevante encontrado
        """
        embedding = embed_model.encode(query).tolist()

        result = supabase.rpc("match_documents", {
            "query_embedding": embedding,
            "match_threshold": threshold,
            "match_count": top_k
        }).execute()

        if not result.data:
            return "No encontré información relevante en la base de conocimiento."

        return "\n\n".join([
            f"[Fragmento {i+1}] {doc['content']}"
            for i, doc in enumerate(result.data)
        ])

    return FunctionTool(func=search_knowledge_base)