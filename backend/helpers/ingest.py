from supabase import create_client
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import os
import io

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("intfloat/multilingual-e5-base")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Divide el texto en chunks con overlap."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

def upload_and_index_pdf(file_path: str):
    filename = os.path.basename(file_path)

    # 1. Subir PDF a Supabase Storage
    with open(file_path, "rb") as f:
        supabase.storage.from_("documents").upload(
            path=filename,
            file=f,
            file_options={"content-type": "application/pdf"}
        )
    print(f"PDF subido: {filename}")

    # 2. Extraer texto del PDF
    reader = PdfReader(file_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"

    # 3. Dividir en chunks e indexar
    chunks = chunk_text(full_text)
    for i, chunk in enumerate(chunks):
        embedding = model.encode(chunk).tolist()
        supabase.table("documents").insert({
            "content": chunk,
            "embedding": embedding,
            "metadata": {
                "source": filename,
                "chunk": i,
                "storage_path": filename  # referencia al archivo original
            }
        }).execute()

    print(f"{len(chunks)} chunks indexados para '{filename}'")

# Uso
if __name__ == "__main__":
    upload_and_index_pdf("reto_plataforma_agentica.pdf")