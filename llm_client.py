from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - optional dependency
    genai = None

DATA_DIR = Path("data")
IDEA_REPORT_PATH = DATA_DIR / "idea_workshop_report.txt"
STYLE_PROFILE_PATH = DATA_DIR / "style_profile.txt"
FACT_LIBRARY_PATH = DATA_DIR / "fact_library.txt"
API_KEY_PATH = Path("gemini_api_key.txt")


@dataclass
class LLMResult:
    text: str
    is_mock: bool


def load_api_key() -> Optional[str]:
    if not API_KEY_PATH.exists():
        return None
    value = API_KEY_PATH.read_text(encoding="utf-8").strip()
    if not value:
        return None
    if value.upper() in {"YOUR_KEY_HERE", "MOCK", "MOCK_API_KEY"}:
        return None
    return value


class LLMClient:
    def __init__(self, api_key: Optional[str]) -> None:
        self.api_key = api_key
        self.is_available = bool(api_key) and genai is not None
        if self.is_available:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
        else:
            self.model = None

    def generate(self, prompt: str, system: Optional[str] = None) -> LLMResult:
        if not self.is_available:
            return self._mock_result()

        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        response = self.model.generate_content(full_prompt)
        return LLMResult(text=response.text or "", is_mock=False)

    def generate_with_search(self, prompt: str, system: Optional[str] = None) -> LLMResult:
        if not self.is_available:
            return self._mock_result()

        try:
            search_model = genai.GenerativeModel(
                "gemini-2.5-flash", tools=[{"google_search": {}}]
            )
            full_prompt = f"{system}\n\n{prompt}" if system else prompt
            response = search_model.generate_content(full_prompt)
            return LLMResult(text=response.text or "", is_mock=False)
        except Exception:
            return self.generate(prompt, system=system)

    @staticmethod
    def _mock_result() -> LLMResult:
        return LLMResult(
            text=(
                "[Mock response]\n\n"
                "The Gemini API key is missing or the SDK is unavailable. "
                "Populate gemini_api_key.txt to enable live generation."
            ),
            is_mock=True,
        )
