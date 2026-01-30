from PyQt6.QtWidgets import QApplication

from main_window import BookWriterWindow


def main() -> None:
    app = QApplication([])
    window = BookWriterWindow()
    window.show()
    app.exec()


if __name__ == "__main__":
    main()
