# Book Writer Agent (PyQt6)

A Python-only rewrite of the Book Writer Agent using a PyQt6 desktop interface and the Gemini 2.5 Flash model. The app includes an idea workshop chatbot, a style profile generator, and style/consistency checkers that reference the generated `.txt` reports.

## Requirements

- Python 3.10+
- A Gemini API key set in `GEMINI_API_KEY`

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the app

```bash
python main.py
```

## Features

### Idea Workshop Tab

- Chat with a guided idea workshop coach.
- Save a full idea workshop report to `data/idea_workshop_report.txt`.

### Style Builder Tab

- Provide an author and descriptive style notes.
- Generate a detailed style profile saved to `data/style_profile.txt`.

### Checkers Tab

- Paste manuscript text to review.
- Style Checker compares text against `style_profile.txt`.
- Consistency Checker compares text against `idea_workshop_report.txt`.

## Environment Setup

Set the Gemini API key before running:

```bash
export GEMINI_API_KEY="your_key_here"
```

If the key is missing, the app provides mock responses for UI testing.
