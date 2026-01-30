from typing import Callable, List, Tuple

from PyQt6.QtCore import QObject, QRunnable, QThreadPool, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from llm_client import IDEA_REPORT_PATH, LLMClient, LLMResult


class LLMWorkerSignals(QObject):
    finished = pyqtSignal(LLMResult)
    failed = pyqtSignal(str)


class LLMWorker(QRunnable):
    def __init__(self, task):
        super().__init__()
        self.task = task
        self.signals = LLMWorkerSignals()

    def run(self) -> None:
        try:
            result = self.task()
        except Exception as exc:  # pragma: no cover
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
        response_text = result.text.strip()
        self.conversation.append(("Coach", response_text))
        self._append_log("Coach", response_text)
        if result.is_mock:
            self._append_log("Note", "Using mock output. Populate gemini_api_key.txt.")
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
            self._append_log("Note", "Using mock output. Populate gemini_api_key.txt.")
        self._set_busy(False)
        self.status("Workshop report saved")

    def _set_busy(self, busy: bool) -> None:
        self.send_button.setDisabled(busy)
        self.save_button.setDisabled(busy)
