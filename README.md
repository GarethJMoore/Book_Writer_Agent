# Book Writer Agent (PyQt6)

A Python-only Book Writer Agent with a PyQt6 desktop interface powered by Gemini 2.5 Flash. The app includes an idea workshop chatbot, style profile generation, a fact library with Google Search-backed fact checking, and style/consistency checkers that reference saved `.txt` reports.

## Requirements

- Python 3.10+
- A Gemini API key stored in `gemini_api_key.txt` next to `main.py`

Install dependencies:

```bash
pip install -r requirements.txt
```

## Configure the API key

Put your Gemini API key in `gemini_api_key.txt` (in the same directory as `main.py`). A mock placeholder file is included by default:

```text
YOUR_KEY_HERE
```

If the file is missing or empty, the app will return mock responses for safe UI testing.

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

### Fact Library Tab

- Maintain a reusable fact library saved to `data/fact_library.txt`.

### Fact Checker Tab

- Paste claims to verify against the fact library and Gemini's Google Search tool.

### Checkers Tab

- Paste manuscript text to review.
- Style Checker compares text against `style_profile.txt`.
- Consistency Checker compares text against `idea_workshop_report.txt`.
