from typing import Callable

from PyQt6.QtCore import QObject, QRunnable, QThreadPool, pyqtSignal
from PyQt6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from llm_client import IDEA_REPORT_PATH, LLMClient, LLMResult, STYLE_PROFILE_PATH


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
            self.results.append("\n\n[Mock output used. Populate gemini_api_key.txt]")
        self._set_busy(False)
        self.status("Check complete")

    def _handle_error(self, message: str) -> None:
        self._set_busy(False)
        self.status("Checker error")
        QMessageBox.critical(self, "Checker Error", message)

    def _set_busy(self, busy: bool) -> None:
        self.style_button.setDisabled(busy)
        self.consistency_button.setDisabled(busy)
