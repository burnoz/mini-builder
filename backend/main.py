from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from agents.builder import build_agent
from agents.runner import run_agent
from helpers.ingest import upload_and_index_pdf
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


class AgentConfig(BaseModel):
    name: str
    model: str
    system_prompt: str = "Eres un asistente útil."
    tools: list[str] = []
    tool_configs: dict = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str


@app.post("/agents", status_code=201)
async def create_agent(config: AgentConfig):
    result = supabase.table("agents").insert(config.model_dump()).execute()
    return result.data[0]

@app.get("/agents")
async def list_agents():
    return supabase.table("agents").select("*").order("created_at", desc=True).execute().data

@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    result = supabase.table("agents").select("*").eq("id", agent_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agente no encontrado")
    return result.data

@app.put("/agents/{agent_id}")
async def update_agent(agent_id: str, config: AgentConfig):
    result = supabase.table("agents").update(config.model_dump()).eq("id", agent_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agente no encontrado")
    return result.data[0]

@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str):
    supabase.table("agents").delete().eq("id", agent_id).execute()

@app.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    content = await file.read()
    upload_and_index_pdf(content, file.filename)
    return {"message": f"Archivo '{file.filename}' indexado correctamente"}

@app.post("/agents/{agent_id}/chat")
async def chat(agent_id: str, req: ChatRequest):
    config = supabase.table("agents").select("*").eq("id", agent_id).single().execute().data
    if not config:
        raise HTTPException(status_code=404, detail="Agente no encontrado")

    # Guardar mensaje del usuario
    supabase.table("messages").insert({
        "agent_id": agent_id,
        "session_id": req.session_id,
        "role": "user",
        "content": req.message
    }).execute()

    # Construir agente y obtener respuesta
    agent = build_agent(config)
    response = await run_agent(agent, agent_id, req.message, req.session_id)

    # Guardar respuesta
    supabase.table("messages").insert({
        "agent_id": agent_id,
        "session_id": req.session_id,
        "role": "assistant",
        "content": response
    }).execute()

    return {"response": response}

@app.get("/agents/{agent_id}/history/{session_id}")
async def get_history(agent_id: str, session_id: str):
    return supabase.table("messages")\
        .select("*")\
        .eq("agent_id", agent_id)\
        .eq("session_id", session_id)\
        .order("created_at")\
        .execute().data