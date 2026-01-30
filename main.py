import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Tuple

from PyQt6.QtCore import QObject, QRunnable, Qt, QThreadPool, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QApplication,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QStatusBar,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - optional dependency
    genai = None


DATA_DIR = Path("data")
IDEA_REPORT_PATH = DATA_DIR / "idea_workshop_report.txt"
STYLE_PROFILE_PATH = DATA_DIR / "style_profile.txt"


@dataclass
class LLMResult:
    text: str
    is_mock: bool


class LLMClient:
    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key
        self.is_available = bool(api_key) and genai is not None
        if self.is_available:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-2.5-flash")
        else:
            self.model = None

    def generate(self, prompt: str, system: str | None = None) -> LLMResult:
        if not self.is_available:
            return LLMResult(
                text=(
                    "[Mock response]\n\n"
                    "The Gemini API key is missing or the SDK is unavailable. "
                    "Set GEMINI_API_KEY to enable live generation."
                ),
                is_mock=True,
            )

        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        response = self.model.generate_content(full_prompt)
        return LLMResult(text=response.text or "", is_mock=False)


class LLMWorkerSignals(QObject):
    finished = pyqtSignal(LLMResult)
    failed = pyqtSignal(str)


class LLMWorker(QRunnable):
    def __init__(self, task: Callable[[], LLMResult]) -> None:
        super().__init__()
        self.task = task
        self.signals = LLMWorkerSignals()

    def run(self) -> None:
        try:
            result = self.task()
        except Exception as exc:  # pragma: no cover - UI feedback path
            self.signals.failed.emit(str(exc))
            return
        self.signals.finished.emit(result)


class IdeaWorkshopTab(QWidget):
    def __init__(self, llm: LLMClient, status: Callable[[str], None]) -> None:
        super().__init__()
        self.llm = llm
        self.status = status
        self.thread_pool = QThreadPool.globalInstance()
        self.conversation: List[Tuple[str, str]] = []

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Chat with the idea workshop coach. When ready, save the report to disk."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        self.chat_log = QTextEdit()
        self.chat_log.setReadOnly(True)
        self.chat_log.setFont(QFont("Courier", 10))
        layout.addWidget(self.chat_log)

        input_row = QHBoxLayout()
        self.user_input = QLineEdit()
        self.user_input.setPlaceholderText("Share your story idea...")
        self.send_button = QPushButton("Send")
        self.send_button.clicked.connect(self.send_message)
        input_row.addWidget(self.user_input)
        input_row.addWidget(self.send_button)
        layout.addLayout(input_row)

        self.save_button = QPushButton("Save Workshop Report")
        self.save_button.clicked.connect(self.save_report)
        layout.addWidget(self.save_button)

    def _append_log(self, speaker: str, message: str) -> None:
        self.chat_log.append(f"{speaker}:\n{message}\n")

    def send_message(self) -> None:
        content = self.user_input.text().strip()
        if not content:
            return
        self.user_input.clear()
        self.conversation.append(("User", content))
        self._append_log("You", content)
        self.status("Generating response...")
        self._set_busy(True)

        def task() -> LLMResult:
            history = "\n".join(
                f"{role}: {text}" for role, text in self.conversation
            )
            system = (
                "You are a creative writing idea workshop coach. "
                "Guide the user through idea generation: premise, characters, stakes, "
                "setting, tone, and key themes. Ask one focused question per turn."
            )
            prompt = (
                "Continue the workshop conversation. Respond as the coach.\n\n"
                f"Conversation so far:\n{history}"
            )
            return self.llm.generate(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._handle_response)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def _handle_response(self, result: LLMResult) -> None:
        self.conversation.append(("Coach", result.text.strip()))
        self._append_log("Coach", result.text.strip())
        if result.is_mock:
            self._append_log("Note", "Using mock output. Set GEMINI_API_KEY.")
        self._set_busy(False)
        self.status("Ready")

    def _handle_error(self, message: str) -> None:
        self._set_busy(False)
        self.status("Error generating response")
        QMessageBox.critical(self, "Idea Workshop Error", message)

    def save_report(self) -> None:
        if not self.conversation:
            QMessageBox.information(
                self, "Nothing to Save", "Start a conversation first."
            )
            return
        self.status("Generating workshop report...")
        self._set_busy(True)

        def task() -> LLMResult:
            history = "\n".join(
                f"{role}: {text}" for role, text in self.conversation
            )
            system = (
                "You are a writing workshop assistant. Create a complete idea report "
                "from the conversation. Include premise, characters, plot arc, "
                "worldbuilding, themes, and next steps."
            )
            prompt = f"Conversation transcript:\n{history}"
            return self.llm.generate(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._save_report_result)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def _save_report_result(self, result: LLMResult) -> None:
        IDEA_REPORT_PATH.write_text(result.text.strip(), encoding="utf-8")
        self._append_log(
            "System",
            f"Saved workshop report to {IDEA_REPORT_PATH.resolve()}.",
        )
        if result.is_mock:
            self._append_log("Note", "Using mock output. Set GEMINI_API_KEY.")
        self._set_busy(False)
        self.status("Workshop report saved")

    def _set_busy(self, busy: bool) -> None:
        self.send_button.setDisabled(busy)
        self.save_button.setDisabled(busy)


class StyleBuilderTab(QWidget):
    def __init__(self, llm: LLMClient, status: Callable[[str], None]) -> None:
        super().__init__()
        self.llm = llm
        self.status = status
        self.thread_pool = QThreadPool.globalInstance()

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Describe the desired style. The assistant will craft a full style profile "
            "and save it to disk."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        form = QFormLayout()
        self.author_input = QLineEdit()
        self.author_input.setPlaceholderText("Author name (optional)")
        form.addRow("Author", self.author_input)
        layout.addLayout(form)

        self.description_input = QTextEdit()
        self.description_input.setPlaceholderText(
            "Describe tone, voice, pacing, or any stylistic constraints."
        )
        layout.addWidget(self.description_input)

        self.generate_button = QPushButton("Generate Style Profile")
        self.generate_button.clicked.connect(self.generate_style)
        layout.addWidget(self.generate_button)

        self.preview = QTextEdit()
        self.preview.setReadOnly(True)
        self.preview.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        layout.addWidget(self.preview)

    def generate_style(self) -> None:
        description = self.description_input.toPlainText().strip()
        author = self.author_input.text().strip()
        if not description:
            QMessageBox.information(
                self, "Missing Description", "Please describe the desired style first."
            )
            return
        self.status("Generating style profile...")
        self.generate_button.setDisabled(True)

        def task() -> LLMResult:
            system = (
                "You are a literary style analyst. Create a comprehensive style guide "
                "from the provided notes. Provide sections on voice, diction, pacing, "
                "structure, and examples of do/don't guidance."
            )
            prompt = (
                f"Author inspiration: {author or 'Not specified'}\n"
                f"Style notes: {description}"
            )
            return self.llm.generate(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._handle_style_result)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def _handle_style_result(self, result: LLMResult) -> None:
        STYLE_PROFILE_PATH.write_text(result.text.strip(), encoding="utf-8")
        self.preview.setPlainText(result.text.strip())
        if result.is_mock:
            self.preview.append("\n\n[Mock output used. Set GEMINI_API_KEY]")
        self.generate_button.setDisabled(False)
        self.status("Style profile saved")

    def _handle_error(self, message: str) -> None:
        self.generate_button.setDisabled(False)
        self.status("Error generating style profile")
        QMessageBox.critical(self, "Style Profile Error", message)


class CheckersTab(QWidget):
    def __init__(self, llm: LLMClient, status: Callable[[str], None]) -> None:
        super().__init__()
        self.llm = llm
        self.status = status
        self.thread_pool = QThreadPool.globalInstance()

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Paste a chapter or draft below, then run style or consistency checks."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        self.text_input = QTextEdit()
        self.text_input.setPlaceholderText("Paste manuscript text here...")
        layout.addWidget(self.text_input)

        button_row = QHBoxLayout()
        self.style_button = QPushButton("Run Style Check")
        self.style_button.clicked.connect(self.run_style_check)
        self.consistency_button = QPushButton("Run Consistency Check")
        self.consistency_button.clicked.connect(self.run_consistency_check)
        button_row.addWidget(self.style_button)
        button_row.addWidget(self.consistency_button)
        layout.addLayout(button_row)

        self.results = QTextEdit()
        self.results.setReadOnly(True)
        layout.addWidget(self.results)

    def run_style_check(self) -> None:
        text = self.text_input.toPlainText().strip()
        if not text:
            QMessageBox.information(self, "Missing Text", "Paste text to review first.")
            return
        if not STYLE_PROFILE_PATH.exists():
            QMessageBox.warning(
                self,
                "Missing Style Profile",
                "Generate a style profile before running this check.",
            )
            return
        self.status("Running style check...")
        self._set_busy(True)

        def task() -> LLMResult:
            style_profile = STYLE_PROFILE_PATH.read_text(encoding="utf-8")
            system = (
                "You are a style checker. Compare the text against the style profile "
                "and list specific deviations with suggested fixes."
            )
            prompt = (
                f"Style profile:\n{style_profile}\n\nText to review:\n{text}"
            )
            return self.llm.generate(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._handle_results)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def run_consistency_check(self) -> None:
        text = self.text_input.toPlainText().strip()
        if not text:
            QMessageBox.information(self, "Missing Text", "Paste text to review first.")
            return
        if not IDEA_REPORT_PATH.exists():
            QMessageBox.warning(
                self,
                "Missing Workshop Report",
                "Save an idea workshop report before running this check.",
            )
            return
        self.status("Running consistency check...")
        self._set_busy(True)

        def task() -> LLMResult:
            idea_report = IDEA_REPORT_PATH.read_text(encoding="utf-8")
            system = (
                "You are a consistency checker. Compare the text against the idea "
                "workshop report and highlight inconsistencies or missing elements."
            )
            prompt = (
                f"Idea workshop report:\n{idea_report}\n\nText to review:\n{text}"
            )
            return self.llm.generate(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._handle_results)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def _handle_results(self, result: LLMResult) -> None:
        self.results.setPlainText(result.text.strip())
        if result.is_mock:
            self.results.append("\n\n[Mock output used. Set GEMINI_API_KEY]")
        self._set_busy(False)
        self.status("Check complete")

    def _handle_error(self, message: str) -> None:
        self._set_busy(False)
        self.status("Checker error")
        QMessageBox.critical(self, "Checker Error", message)

    def _set_busy(self, busy: bool) -> None:
        self.style_button.setDisabled(busy)
        self.consistency_button.setDisabled(busy)


class BookWriterWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        DATA_DIR.mkdir(exist_ok=True)
        api_key_path = Path(__file__).parent / "gemini_api_key.txt"
        api_key = None
        if api_key_path.exists():
            api_key = api_key_path.read_text(encoding="utf-8").strip()
            if not api_key:
                api_key = None
        self.llm = LLMClient(api_key)

        self.setWindowTitle("Book Writer Agent (PyQt6)")
        self.resize(1000, 700)

        tabs = QTabWidget()
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        tabs.addTab(IdeaWorkshopTab(self.llm, self.set_status), "Idea Workshop")
        tabs.addTab(StyleBuilderTab(self.llm, self.set_status), "Style Builder")
        tabs.addTab(CheckersTab(self.llm, self.set_status), "Checkers")

        self.setCentralWidget(tabs)
        self.set_status("Ready")

    def set_status(self, message: str) -> None:
        self.status_bar.showMessage(message)


def main() -> None:
    app = QApplication([])
    window = BookWriterWindow()
    window.show()
    app.exec()


if __name__ == "__main__":
    main()
