from supabase import create_client
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import os
import io

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
model = SentenceTransformer("intfloat/multilingual-e5-base")

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Divide el texto en chunks con overlap por caracteres."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks

def upload_and_index_pdf(file_content: bytes, filename: str):
    # 1. Subir PDF a Supabase Storage
    # Nota: El bucket 'documents' debe existir en Supabase
    try:
        supabase.storage.from_("documents").upload(
            path=filename,
            file=file_content,
            file_options={"content-type": "application/pdf"}
        )
        print(f"PDF subido a storage: {filename}")
    except Exception as e:
        print(f"Error subiendo a storage (posiblemente ya existe): {e}")

    # 2. Extraer texto del PDF
    reader = PdfReader(io.BytesIO(file_content))
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    if not full_text.strip():
        print(f"No se pudo extraer texto de {filename}")
        return

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
                "storage_path": filename
            }
        }).execute()

    print(f"{len(chunks)} chunks indexados para '{filename}'")

# Uso
if __name__ == "__main__":
    upload_and_index_pdf("reto_plataforma_agentica.pdf")