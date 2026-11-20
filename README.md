# Prompt Library

Prompt Library is a browser-based workspace for creating, organizing, rating, and backing up prompts. It was built as a practical prompt engineering exercise to learn how different prompting techniques affect the instructions given to AI models.

## Prompting techniques learned

This project explores four core prompting techniques:

- **Zero-shot prompting:** Asking a model to complete a task using only the instructions, without an example.
- **One-shot prompting:** Providing one example before requesting the model to perform a similar task.
- **Few-shot prompting:** Providing several examples to establish a repeatable pattern or output format.
- **Chain of Thought (CoT):** Encouraging the model to show or organize intermediate reasoning steps before producing a final answer.

The library can be used to store and compare prompts that use these approaches, along with prompts tailored to specific models.

## Features

- Create prompts with a title, model name, and prompt content.
- Store prompts in the browser using `localStorage`.
- View prompts sorted by creation date.
- Preview prompt content and delete prompts from the collection.
- Add 1–5 effectiveness ratings to prompts.
- Add, edit, and delete notes for individual prompts.
- View model metadata, creation and update timestamps, and estimated token ranges.
- Export the complete library, including prompts and notes, as a versioned JSON file.
- Import JSON files with validation, merge or replace options, duplicate-ID handling, and automatic rollback when an import fails.

## Running the project

No installation or build step is required.

1. Clone or download this repository.
2. Open `index.html` in a modern browser.
3. Enter a title, model name, and prompt in the form.
4. Select **Save prompt** to add it to the library.

For local development, you can also serve the project directory with a simple static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

```text
.
├── index.html   # Page structure and prompt workspace controls
├── script.js    # Prompt CRUD, ratings, notes, metadata, and JSON import/export
├── styles.css   # Responsive dark-themed interface
└── README.md    # Project documentation
```

## Data storage

Prompts and notes are saved in browser `localStorage`. Clearing browser storage removes the library. Use **Export JSON** before clearing storage or moving to another browser.

The export includes:

- An export format version
- Export timestamp
- Library statistics
- Saved prompts and metadata
- Saved notes

Imported JSON is validated before it replaces or merges with existing data.

## Learning outcomes

Working on this project demonstrates:

- How prompt instructions change between zero-shot, one-shot, and few-shot use cases.
- How examples influence output consistency and format.
- How chain-of-thought instructions can guide a model through a structured response.
- How prompt entries can be enriched with model details, ratings, notes, and usage metadata.
- How browser storage and JSON validation can support a practical prompt management workflow.
