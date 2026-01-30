from typing import Callable

from PyQt6.QtWidgets import (
    QLabel,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from llm_client import FACT_LIBRARY_PATH


class FactLibraryTab(QWidget):
    def __init__(self, status: Callable[[str], None]) -> None:
        super().__init__()
        self.status = status

        layout = QVBoxLayout(self)
        intro = QLabel(
            "Store trusted facts or references here. Save updates to share with the fact checker."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        self.editor = QTextEdit()
        self.editor.setPlaceholderText("Add facts, citations, or notes...")
        layout.addWidget(self.editor)

        self.save_button = QPushButton("Save Fact Library")
        self.save_button.clicked.connect(self.save_library)
        layout.addWidget(self.save_button)

        self.load_library()

    def load_library(self) -> None:
        if FACT_LIBRARY_PATH.exists():
            self.editor.setPlainText(
                FACT_LIBRARY_PATH.read_text(encoding="utf-8")
            )

    def save_library(self) -> None:
        text = self.editor.toPlainText().strip()
        if not text:
            QMessageBox.information(
                self, "Nothing to Save", "Add some facts before saving."
            )
            return
        FACT_LIBRARY_PATH.write_text(text, encoding="utf-8")
        self.status("Fact library saved")
