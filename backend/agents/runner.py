from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import Agent
from google.genai.types import Content, Part

# Estado global — persiste mientras uvicorn esté corriendo
_session_services: dict[str, InMemorySessionService] = {}
_runners: dict[str, Runner] = {}

async def run_agent(agent: Agent, agent_id: str, message: str, session_id: str) -> str:
    # Reusar runner existente o crear uno nuevo
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

    # Siempre intentar crear la sesión — si ya existe la ignoramos
    try:
        await session_service.create_session(
            app_name=agent_id,
            user_id="user",
            session_id=session_id
        )
    except Exception:
        pass  # ya existe, no hay problema

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

    return response_text