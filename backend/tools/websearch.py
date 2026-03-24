from google.adk.tools import FunctionTool
from duckduckgo_search import DDGS

def make_websearch_tool(config: dict) -> FunctionTool:
    max_results = config.get("max_results", 5)
    region = config.get("region", "mx-es")  # ajusta según tu región

    def search_web(query: str) -> str:
        """
        Busca información actualizada en internet.
        Úsala para preguntas sobre eventos recientes o datos que pueden haber cambiado.

        Args:
            query: El término o pregunta a buscar en internet

        Returns:
            Resultados relevantes de la web
        """
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, region=region, max_results=max_results))

            if not results:
                return "No encontré resultados para esa búsqueda."

            return "\n\n".join([
                f"[{i+1}] {r['title']}\n{r['href']}\n{r['body']}"
                for i, r in enumerate(results)
            ])
        except Exception as e:
            return f"Error al buscar en la web: {str(e)}"

    return FunctionTool(func=search_web)