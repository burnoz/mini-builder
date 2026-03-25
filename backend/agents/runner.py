from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import Agent
from google.genai.types import Content, Part

# ── Langfuse via OpenTelemetry ─────────────────────────────────────────────
from langfuse import get_client
from openinference.instrumentation.google_adk import GoogleADKInstrumentor

langfuse = get_client()

if langfuse.auth_check():
    GoogleADKInstrumentor().instrument()
    print("Langfuse conectado")
else:
    print("Langfuse: credenciales inválidas, trazabilidad desactivada")

# ── Estado global ──────────────────────────────────────────────────────────
_session_services: dict[str, InMemorySessionService] = {}
_runners: dict[str, Runner] = {}

async def run_agent(agent: Agent, agent_id: str, message: str, session_id: str) -> str:
    if agent_id not in _runners:
        session_service = InMemorySessionService()
        runner = Runner(
            agent=agent,
            app_name=agent_id,
            session_service=session_service
        )
        _session_services[agent_id] = session_service
        _runners[agent_id] = runner

    session_service = _session_services[agent_id]
    runner = _runners[agent_id]

    try:
        await session_service.create_session(
            app_name=agent_id,
            user_id="user",
            session_id=session_id
        )
    except Exception:
        pass

    user_message = Content(role="user", parts=[Part(text=message)])

    response_text = ""
    async for event in runner.run_async(
        user_id="user",
        session_id=session_id,
        new_message=user_message
    ):
        if event.is_final_response() and event.content:
            response_text = event.content.parts[0].text
            break

    langfuse.flush()
    return response_text