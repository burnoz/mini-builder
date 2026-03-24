from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from tools.rag import make_rag_tool
from tools.websearch import make_websearch_tool
from dotenv import load_dotenv
import os

load_dotenv()

TOOL_REGISTRY = {
    "rag": make_rag_tool,
    "websearch": make_websearch_tool,
}

def build_agent(config: dict) -> Agent:
    tools = []
    for tool_name in config.get("tools", []):
        if tool_name in TOOL_REGISTRY:
            tool_config = config.get("tool_configs", {}).get(tool_name, {})
            tools.append(TOOL_REGISTRY[tool_name](tool_config))

    model = LiteLlm(
        model=f"openrouter/{config['model']}",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        api_base="https://openrouter.ai/api/v1"
    )

    return Agent(
        name=config["name"].replace(" ", "_").lower(),
        model=model,
        instruction=config.get("system_prompt", "Eres un asistente útil."),
        tools=tools
    )