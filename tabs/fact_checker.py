from typing import Callable

from PyQt6.QtCore import QObject, QRunnable, QThreadPool, pyqtSignal
from PyQt6.QtWidgets import (
    QLabel,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from llm_client import FACT_LIBRARY_PATH, LLMClient, LLMResult


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


class FactCheckerTab(QWidget):
    def __init__(self, llm: LLMClient, status: Callable[[str], None]) -> None:
        super().__init__()
        self.llm = llm
        self.status = status
        self.thread_pool = QThreadPool.globalInstance()

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Paste text to fact-check. The assistant will use the fact library and Google Search."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        self.text_input = QTextEdit()
        self.text_input.setPlaceholderText("Paste claims or draft text to verify...")
        layout.addWidget(self.text_input)

        self.check_button = QPushButton("Run Fact Check")
        self.check_button.clicked.connect(self.run_fact_check)
        layout.addWidget(self.check_button)

        self.results = QTextEdit()
        self.results.setReadOnly(True)
        layout.addWidget(self.results)

    def run_fact_check(self) -> None:
        text = self.text_input.toPlainText().strip()
        if not text:
            QMessageBox.information(self, "Missing Text", "Paste text to review first.")
            return
        if not FACT_LIBRARY_PATH.exists():
            QMessageBox.warning(
                self,
                "Missing Fact Library",
                "Save a fact library before running this check.",
            )
            return
        self.status("Running fact check with Google Search...")
        self._set_busy(True)

        def task() -> LLMResult:
            library = FACT_LIBRARY_PATH.read_text(encoding="utf-8")
            system = (
                "You are a fact checker. Use Google Search and the provided fact library "
                "to verify claims. Provide a verdict for each claim, cite sources when possible, "
                "and highlight any discrepancies."
            )
            prompt = (
                f"Fact library:\n{library}\n\nText to verify:\n{text}"
            )
            return self.llm.generate_with_search(prompt, system=system)

        worker = LLMWorker(task)
        worker.signals.finished.connect(self._handle_results)
        worker.signals.failed.connect(self._handle_error)
        self.thread_pool.start(worker)

    def _handle_results(self, result: LLMResult) -> None:
        self.results.setPlainText(result.text.strip())
        if result.is_mock:
            self.results.append("\n\n[Mock output used. Populate gemini_api_key.txt]")
        self._set_busy(False)
        self.status("Fact check complete")

    def _handle_error(self, message: str) -> None:
        self._set_busy(False)
        self.status("Fact checker error")
        QMessageBox.critical(self, "Fact Checker Error", message)

    def _set_busy(self, busy: bool) -> None:
        self.check_button.setDisabled(busy)
