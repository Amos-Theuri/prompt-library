const STORAGE_KEY = "prompt-library-prompts";
const NOTES_STORAGE_KEY = "prompt-library-notes";
const BACKUP_STORAGE_KEY = "prompt-library-import-backup";
const EXPORT_VERSION = 1;

const form = document.querySelector("#prompt-form");
const titleInput = document.querySelector("#prompt-title");
const modelInput = document.querySelector("#prompt-model");
const contentInput = document.querySelector("#prompt-content");
const promptList = document.querySelector("#prompt-list");
const emptyState = document.querySelector("#empty-state");
const promptCount = document.querySelector("#prompt-count");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFile = document.querySelector("#import-file");
const importStatus = document.querySelector("#import-status");

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validateIsoDate(value, fieldName = "Date") {
  if (typeof value !== "string" || !ISO_8601_PATTERN.test(value)) {
    throw new Error(
      `${fieldName} must be a valid ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ).`
    );
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(
      `${fieldName} must be a valid ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ).`
    );
  }
}

function estimateTokens(text, isCode = false) {
  if (typeof text !== "string") {
    throw new Error("text must be a string.");
  }
  if (typeof isCode !== "boolean") {
    throw new Error("isCode must be a boolean.");
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characterCount = text.length;
  const codeMultiplier = isCode ? 1.3 : 1;
  const min = 0.75 * wordCount * codeMultiplier;
  const max = 0.25 * characterCount * codeMultiplier;
  const tokenCount = Math.max(min, max);

  let confidence = "high";
  if (tokenCount > 5000) {
    confidence = "low";
  } else if (tokenCount >= 1000) {
    confidence = "medium";
  }

  return { min, max, confidence };
}

function trackModel(modelName, content) {
  if (typeof modelName !== "string" || !modelName.trim()) {
    throw new Error("Model name must be a non-empty string.");
  }
  if (modelName.trim().length > 100) {
    throw new Error("Model name must not exceed 100 characters.");
  }
  if (typeof content !== "string") {
    throw new Error("content must be a string.");
  }

  const timestamp = new Date().toISOString();
  return {
    model: modelName.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    tokenEstimate: estimateTokens(content, false),
  };
}

function updateTimestamps(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Metadata must be an object.");
  }

  validateIsoDate(metadata.createdAt, "createdAt");
  if (typeof metadata.updatedAt !== "undefined") {
    validateIsoDate(metadata.updatedAt, "updatedAt");
    if (Date.parse(metadata.updatedAt) < Date.parse(metadata.createdAt)) {
      throw new Error("updatedAt cannot be earlier than createdAt.");
    }
  }
  const updatedAt = new Date().toISOString();
  validateIsoDate(updatedAt, "updatedAt");

  if (Date.parse(updatedAt) < Date.parse(metadata.createdAt)) {
    throw new Error("updatedAt cannot be earlier than createdAt.");
  }

  return { ...metadata, updatedAt };
}

function getPrompts() {
  try {
    const prompts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    let changed = false;

    const normalized = prompts.map((prompt) => {
      if (!prompt.metadata) {
        changed = true;
        return {
          ...prompt,
          metadata: trackModel("Unknown model", prompt.content || ""),
        };
      }
      return prompt;
    });

    if (changed) {
      savePrompts(normalized);
    }
    return normalized;
  } catch (error) {
    console.error("Unable to read saved prompts.", error);
    return [];
  }
}

function savePrompts(prompts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
    return true;
  } catch (error) {
    console.error("Unable to save prompts.", error);
    return false;
  }
}

function getNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY)) || [];
  } catch (error) {
    console.error("Unable to read saved notes.", error);
    return [];
  }
}

function saveNotes(notes) {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error("Unable to save notes.", error);
    return false;
  }
}

function createNotesControl(prompt) {
  const section = document.createElement("section");
  section.className = "notes-section";
  section.setAttribute("aria-label", `Notes for ${prompt.title}`);

  const heading = document.createElement("h5");
  heading.textContent = "Notes";

  const textarea = document.createElement("textarea");
  textarea.className = "note-input";
  textarea.rows = 3;
  textarea.placeholder = "Add a note...";
  textarea.setAttribute("aria-label", `Note for ${prompt.title}`);

  const message = document.createElement("p");
  message.className = "note-message";
  message.setAttribute("role", "status");

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "note-save-button";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "note-delete-button";
  deleteButton.textContent = "Delete";

  let editing = false;

  const note = getNotes().find((savedNote) => savedNote.promptId === prompt.id);

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function showSavedState(savedNote) {
    textarea.value = savedNote ? savedNote.content : "";
    textarea.readOnly = Boolean(savedNote);
    editing = !savedNote;
    saveButton.textContent = savedNote ? "Edit" : "Save";
    deleteButton.hidden = !savedNote;
  }

  showSavedState(note);

  saveButton.addEventListener("click", () => {
    if (!editing) {
      if (!note) {
        editing = true;
        textarea.readOnly = false;
        textarea.focus();
        saveButton.textContent = "Save";
      } else {
        editing = true;
        textarea.readOnly = false;
        textarea.focus();
        saveButton.textContent = "Save";
      }
      showMessage("");
      return;
    }

    const content = textarea.value.trim();
    if (!content) {
      showMessage("Note cannot be empty.", true);
      return;
    }

    const notes = getNotes();
    const existingNote = notes.find((savedNote) => savedNote.promptId === prompt.id);
    const now = Date.now();

    if (existingNote) {
      existingNote.content = content;
      existingNote.updatedAt = now;
    } else {
      notes.push({
        id: `note-${now}-${Math.random().toString(36).slice(2)}`,
        promptId: prompt.id,
        content,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!saveNotes(notes)) {
      showMessage("Unable to save note.", true);
      return;
    }

    const savedNote = getNotes().find((saved) => saved.promptId === prompt.id);
    showSavedState(savedNote);
    showMessage("Note saved.");
  });

  deleteButton.addEventListener("click", () => {
    if (!window.confirm("Delete this note?")) {
      return;
    }

    const notes = getNotes().filter((savedNote) => savedNote.promptId !== prompt.id);
    if (!saveNotes(notes)) {
      showMessage("Unable to delete note.", true);
      return;
    }

    showSavedState(null);
    showMessage("Note deleted.");
  });

  actions.append(saveButton, deleteButton);
  section.append(heading, textarea, actions, message);
  return section;
}

function createRatingControl(prompt) {
  const rating = document.createElement("div");
  rating.className = "rating";
  rating.setAttribute("role", "radiogroup");
  rating.setAttribute("aria-label", `Rate ${prompt.title}`);

  for (let value = 1; value <= 5; value += 1) {
    const star = document.createElement("button");
    star.className = "rating-star";
    star.type = "button";
    star.textContent = value <= prompt.rating ? "★" : "☆";
    star.setAttribute("aria-label", `${value} star${value > 1 ? "s" : ""}`);
    star.setAttribute("aria-checked", value === prompt.rating);
    star.setAttribute("role", "radio");
    star.addEventListener("click", () => {
      const prompts = getPrompts();
      const selectedPrompt = prompts.find((savedPrompt) => savedPrompt.id === prompt.id);

      if (!selectedPrompt) {
        return;
      }

      selectedPrompt.rating = value;
      if (selectedPrompt.metadata) {
        try {
          selectedPrompt.metadata = updateTimestamps(selectedPrompt.metadata);
        } catch (error) {
          console.error("Unable to update prompt timestamps.", error);
        }
      }
      if (savePrompts(prompts)) {
        renderPrompts();
      }
    });
    rating.append(star);
  }

  const ratingLabel = document.createElement("span");
  ratingLabel.className = "rating-label";
  ratingLabel.textContent = prompt.rating
    ? `${prompt.rating}/5 effectiveness`
    : "Not rated yet";
  rating.append(ratingLabel);

  return rating;
}

function formatHumanDate(isoDate) {
  try {
    validateIsoDate(isoDate);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoDate));
  } catch (error) {
    console.error("Unable to format prompt date.", error);
    return "Invalid date";
  }
}

function createMetadataDisplay(prompt) {
  const metadata = prompt.metadata;
  const section = document.createElement("section");
  section.className = "metadata-section";
  section.setAttribute("aria-label", `Metadata for ${prompt.title}`);

  if (!metadata) {
    const empty = document.createElement("p");
    empty.className = "metadata-empty";
    empty.textContent = "Metadata unavailable";
    section.append(empty);
    return section;
  }

  const model = document.createElement("p");
  model.className = "metadata-model";
  const modelLabel = document.createElement("span");
  modelLabel.textContent = "Model ";
  model.append(modelLabel, document.createTextNode(metadata.model));

  const dates = document.createElement("p");
  dates.className = "metadata-dates";
  const createdLabel = document.createElement("span");
  createdLabel.textContent = "Created ";
  const updatedLabel = document.createElement("span");
  updatedLabel.textContent = "Updated ";
  dates.append(
    createdLabel,
    document.createTextNode(formatHumanDate(metadata.createdAt)),
    document.createElement("br"),
    updatedLabel,
    document.createTextNode(formatHumanDate(metadata.updatedAt))
  );

  const estimate = document.createElement("p");
  estimate.className = "metadata-estimate";
  const confidence = document.createElement("span");
  confidence.className = `confidence confidence-${metadata.tokenEstimate.confidence}`;
  confidence.textContent = metadata.tokenEstimate.confidence;
  estimate.append(document.createTextNode(
    `${formatTokenCount(metadata.tokenEstimate.min)}–${formatTokenCount(metadata.tokenEstimate.max)} tokens · `
  ));
  estimate.append(confidence);

  section.append(model, dates, estimate);
  return section;
}

function formatTokenCount(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function createPromptCard(prompt) {
  const card = document.createElement("article");
  card.className = "prompt-card";
  card.dataset.promptId = prompt.id;

  const title = document.createElement("h4");
  title.textContent = prompt.title;

  const preview = document.createElement("p");
  preview.textContent = prompt.content;

  const rating = createRatingControl(prompt);
  const metadata = createMetadataDisplay(prompt);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${prompt.title}`);
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", () => {
    const prompts = getPrompts().filter((savedPrompt) => savedPrompt.id !== prompt.id);
    savePrompts(prompts);
    const notes = getNotes().filter((note) => note.promptId !== prompt.id);
    saveNotes(notes);
    renderPrompts();
  });

  const notes = createNotesControl(prompt);
  card.append(title, preview, rating, metadata, notes, deleteButton);
  return card;
}

function renderPrompts() {
  const prompts = getPrompts().slice().sort((a, b) => {
    const aTime = a.metadata ? Date.parse(a.metadata.createdAt) : 0;
    const bTime = b.metadata ? Date.parse(b.metadata.createdAt) : 0;
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
  promptList.replaceChildren(...prompts.map(createPromptCard));
  promptCount.textContent = prompts.length;
  emptyState.hidden = prompts.length > 0;
}

function setImportStatus(message, isError = false) {
  if (!importStatus) {
    return;
  }
  importStatus.textContent = message;
  importStatus.classList.toggle("error", isError);
}

function validateMetadata(metadata, promptId) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`Prompt "${promptId}" has invalid metadata.`);
  }
  if (
    typeof metadata.model !== "string" ||
    !metadata.model.trim() ||
    metadata.model.length > 100
  ) {
    throw new Error(`Prompt "${promptId}" has an invalid model name.`);
  }

  validateIsoDate(metadata.createdAt, `Prompt "${promptId}" createdAt`);
  validateIsoDate(metadata.updatedAt, `Prompt "${promptId}" updatedAt`);
  if (Date.parse(metadata.updatedAt) < Date.parse(metadata.createdAt)) {
    throw new Error(`Prompt "${promptId}" updatedAt cannot be earlier than createdAt.`);
  }

  const estimate = metadata.tokenEstimate;
  if (
    !estimate ||
    typeof estimate !== "object" ||
    !Number.isFinite(estimate.min) ||
    !Number.isFinite(estimate.max) ||
    estimate.min < 0 ||
    estimate.max < estimate.min ||
    !["high", "medium", "low"].includes(estimate.confidence)
  ) {
    throw new Error(`Prompt "${promptId}" has an invalid token estimate.`);
  }
}

function validatePrompt(prompt, index) {
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
    throw new Error(`Prompt at index ${index} must be an object.`);
  }
  if (typeof prompt.id !== "string" || !prompt.id.trim()) {
    throw new Error(`Prompt at index ${index} has an invalid ID.`);
  }
  if (typeof prompt.title !== "string" || !prompt.title.trim() || prompt.title.length > 80) {
    throw new Error(`Prompt "${prompt.id}" has an invalid title.`);
  }
  if (typeof prompt.content !== "string" || !prompt.content.trim()) {
    throw new Error(`Prompt "${prompt.id}" has invalid content.`);
  }
  if (
    !Number.isInteger(prompt.rating) ||
    prompt.rating < 0 ||
    prompt.rating > 5
  ) {
    throw new Error(`Prompt "${prompt.id}" has an invalid rating.`);
  }
  validateMetadata(prompt.metadata, prompt.id);
}

function validateNotes(notes) {
  if (!Array.isArray(notes)) {
    throw new Error("The notes field must be an array.");
  }

  const ids = new Set();
  notes.forEach((note, index) => {
    if (!note || typeof note !== "object" || Array.isArray(note)) {
      throw new Error(`Note at index ${index} must be an object.`);
    }
    if (typeof note.id !== "string" || !note.id.trim()) {
      throw new Error(`Note at index ${index} has an invalid ID.`);
    }
    if (ids.has(note.id)) {
      throw new Error(`Duplicate note ID found: "${note.id}".`);
    }
    ids.add(note.id);
    if (typeof note.promptId !== "string" || !note.promptId.trim()) {
      throw new Error(`Note "${note.id}" has an invalid promptId.`);
    }
    if (typeof note.content !== "string" || !note.content.trim()) {
      throw new Error(`Note "${note.id}" has invalid content.`);
    }
    if (!Number.isFinite(note.createdAt) || !Number.isFinite(note.updatedAt)) {
      throw new Error(`Note "${note.id}" has invalid timestamps.`);
    }
  });
}

function calculateStatistics(prompts) {
  const ratedPrompts = prompts.filter((prompt) => prompt.rating > 0);
  const averageRating = ratedPrompts.length
    ? ratedPrompts.reduce((sum, prompt) => sum + prompt.rating, 0) / ratedPrompts.length
    : 0;

  const modelCounts = new Map();
  prompts.forEach((prompt) => {
    const model = prompt.metadata.model;
    modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
  });

  let mostUsedModel = null;
  let highestCount = 0;
  modelCounts.forEach((count, model) => {
    if (count > highestCount) {
      highestCount = count;
      mostUsedModel = model;
    }
  });

  return {
    totalPrompts: prompts.length,
    averageRating: Number(averageRating.toFixed(2)),
    mostUsedModel,
  };
}

function validateExportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The import file must contain a JSON object.");
  }
  if (payload.version !== EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version "${payload.version}". This application supports version ${EXPORT_VERSION}.`
    );
  }
  validateIsoDate(payload.exportedAt, "exportedAt");
  if (!Array.isArray(payload.prompts)) {
    throw new Error("The export payload's prompts field must be an array.");
  }

  const promptIds = new Set();
  payload.prompts.forEach((prompt, index) => {
    validatePrompt(prompt, index);
    if (promptIds.has(prompt.id)) {
      throw new Error(`Duplicate prompt ID found in import file: "${prompt.id}".`);
    }
    promptIds.add(prompt.id);
  });

  validateNotes(payload.notes || []);

  const statistics = payload.statistics;
  if (!statistics || typeof statistics !== "object" || Array.isArray(statistics)) {
    throw new Error("The export payload's statistics field is missing or invalid.");
  }

  const calculated = calculateStatistics(payload.prompts);
  if (
    statistics.totalPrompts !== calculated.totalPrompts ||
    !Number.isFinite(statistics.averageRating) ||
    Math.abs(statistics.averageRating - calculated.averageRating) > 0.01 ||
    statistics.mostUsedModel !== calculated.mostUsedModel
  ) {
    throw new Error("Export statistics do not match the complete prompts array.");
  }

  return payload;
}

function exportLibrary() {
  try {
    const prompts = getPrompts();
    const notes = getNotes();
    if (!Array.isArray(prompts)) {
      throw new Error("Saved prompts data is not a valid array.");
    }
    prompts.forEach(validatePrompt);
    validateNotes(notes);

    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      statistics: calculateStatistics(prompts),
      prompts,
      notes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = payload.exportedAt
      .replace(/\.\d{3}Z$/, "Z")
      .replace(/:/g, "-");
    link.href = url;
    link.download = `prompt-library-${timestamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setImportStatus(
      `Exported ${prompts.length} prompt${prompts.length === 1 ? "" : "s"} successfully.`,
      false
    );
  } catch (error) {
    console.error("Unable to export prompt library.", error);
    setImportStatus(
      error instanceof Error ? `Export failed: ${error.message}` : "Export failed.",
      true
    );
  }
}

function createImportBackup() {
  const backup = {
    createdAt: new Date().toISOString(),
    prompts: localStorage.getItem(STORAGE_KEY),
    notes: localStorage.getItem(NOTES_STORAGE_KEY),
  };
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backup));
  return backup;
}

function rollbackImport(backup) {
  if (!backup) {
    return;
  }

  if (backup.prompts === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, backup.prompts);
  }

  if (backup.notes === null) {
    localStorage.removeItem(NOTES_STORAGE_KEY);
  } else {
    localStorage.setItem(NOTES_STORAGE_KEY, backup.notes);
  }
}

function mergeImportedData(importedPrompts, importedNotes) {
  const existingPrompts = getPrompts();
  const promptsById = new Map(existingPrompts.map((prompt) => [prompt.id, prompt]));

  importedPrompts.forEach((importedPrompt) => {
    const existingPrompt = promptsById.get(importedPrompt.id);
    if (!existingPrompt) {
      promptsById.set(importedPrompt.id, importedPrompt);
      return;
    }

    const replace = window.confirm(
      `A prompt named "${existingPrompt.title}" already has ID "${importedPrompt.id}".\n\nChoose OK to replace it with "${importedPrompt.title}", or Cancel to keep the existing prompt.`
    );
    if (replace) {
      promptsById.set(importedPrompt.id, importedPrompt);
    }
  });

  const existingNotes = getNotes();
  const notesById = new Map(existingNotes.map((note) => [note.id, note]));
  importedNotes.forEach((importedNote) => {
    if (!notesById.has(importedNote.id)) {
      notesById.set(importedNote.id, importedNote);
      return;
    }

    const replace = window.confirm(
      `A note with ID "${importedNote.id}" already exists.\n\nChoose OK to replace it, or Cancel to keep the existing note.`
    );
    if (replace) {
      notesById.set(importedNote.id, importedNote);
    }
  });

  return {
    prompts: Array.from(promptsById.values()),
    notes: Array.from(notesById.values()),
  };
}

async function importLibrary(file) {
  let backup = null;

  try {
    if (!file) {
      throw new Error("No import file was selected.");
    }
    setImportStatus(`Reading "${file.name}"...`, false);

    const text = await file.text();
    if (!text.trim()) {
      throw new Error("The import file is empty.");
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `The import file is not valid JSON: ${error instanceof Error ? error.message : "Unknown parsing error"}`
      );
    }

    validateExportPayload(payload);

    const replaceAll = window.confirm(
      "Replace the entire existing prompt library?\n\nChoose OK to replace prompts and notes, or Cancel to merge and resolve duplicate IDs."
    );

    backup = createImportBackup();
    let promptsToSave;
    let notesToSave;

    if (replaceAll) {
      promptsToSave = payload.prompts;
      notesToSave = payload.notes || [];
    } else {
      const merged = mergeImportedData(payload.prompts, payload.notes || []);
      promptsToSave = merged.prompts;
      notesToSave = merged.notes;
    }

    if (!savePrompts(promptsToSave) || !saveNotes(notesToSave)) {
      throw new Error("localStorage rejected the imported library data.");
    }

    const storedPrompts = getPrompts();
    const storedNotes = getNotes();
    storedPrompts.forEach((prompt, index) => validatePrompt(prompt, index));
    validateNotes(storedNotes);

    renderPrompts();
    setImportStatus(
      `Imported successfully: ${storedPrompts.length} prompt${storedPrompts.length === 1 ? "" : "s"} and ${storedNotes.length} note${storedNotes.length === 1 ? "" : "s"}.`,
      false
    );
  } catch (error) {
    if (backup) {
      try {
        rollbackImport(backup);
        renderPrompts();
      } catch (rollbackError) {
        console.error("Rollback failed.", rollbackError);
      }
      setImportStatus(
        `${error instanceof Error ? error.message : "Import failed."} Existing data was restored from the backup.`,
        true
      );
    } else {
      setImportStatus(
        error instanceof Error ? `Import failed: ${error.message}` : "Import failed.",
        true
      );
    }
    console.error("Unable to import prompt library.", error);
  } finally {
    importFile.value = "";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const modelName = modelInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !modelName || !content) {
    return;
  }

  try {
    const metadata = trackModel(modelName, content);
    const prompts = getPrompts();
    prompts.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      content,
      rating: 0,
      metadata,
    });

    if (!savePrompts(prompts)) {
      window.alert("Unable to save prompt. Please try again.");
      return;
    }

    form.reset();
    renderPrompts();
    titleInput.focus();
  } catch (error) {
    console.error("Unable to create prompt metadata.", error);
    window.alert(error instanceof Error ? error.message : "Unable to create prompt.");
  }
});

exportButton.addEventListener("click", exportLibrary);
importButton.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const [file] = importFile.files;
  if (file) {
    importLibrary(file);
  }
});

renderPrompts();
