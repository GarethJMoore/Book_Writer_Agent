from typing import Callable

from PyQt6.QtCore import QObject, QRunnable, QThreadPool, pyqtSignal
from PyQt6.QtWidgets import (
    QFormLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from llm_client import LLMClient, LLMResult, STYLE_PROFILE_PATH


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
        self.preview.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding
        )
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
            self.preview.append("\n\n[Mock output used. Populate gemini_api_key.txt]")
        self.generate_button.setDisabled(False)
        self.status("Style profile saved")

    def _handle_error(self, message: str) -> None:
        self.generate_button.setDisabled(False)
        self.status("Error generating style profile")
        QMessageBox.critical(self, "Style Profile Error", message)
