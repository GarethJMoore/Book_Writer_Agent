from PyQt6.QtWidgets import QMainWindow, QStatusBar, QTabWidget

from llm_client import DATA_DIR, LLMClient, load_api_key
from tabs.checkers import CheckersTab
from tabs.fact_checker import FactCheckerTab
from tabs.fact_library import FactLibraryTab
from tabs.idea_workshop import IdeaWorkshopTab
from tabs.style_builder import StyleBuilderTab


class BookWriterWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        DATA_DIR.mkdir(exist_ok=True)
        api_key = load_api_key()
        self.llm = LLMClient(api_key)

        self.setWindowTitle("Book Writer Agent (PyQt6)")
        self.resize(1100, 750)

        tabs = QTabWidget()
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        tabs.addTab(IdeaWorkshopTab(self.llm, self.set_status), "Idea Workshop")
        tabs.addTab(StyleBuilderTab(self.llm, self.set_status), "Style Builder")
        tabs.addTab(FactLibraryTab(self.set_status), "Fact Library")
        tabs.addTab(FactCheckerTab(self.llm, self.set_status), "Fact Checker")
        tabs.addTab(CheckersTab(self.llm, self.set_status), "Checkers")

        self.setCentralWidget(tabs)
        self.set_status("Ready")

    def set_status(self, message: str) -> None:
        self.status_bar.showMessage(message)
