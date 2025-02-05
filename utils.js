// todo: fix spotdl output parsing
export function processDownloadOutput(output) {
  if (output.includes("Processing")) {
    return "Processing";
  }
  if (output.includes("Downloading")) {
    return "Downloading";
  }
  if (output.includes("Converting")) {
    return "Converting";
  }
  if (output.includes("Embedding metadata")) {
    return "Embedding metadata";
  }
  if (output.includes("Downloaded")) {
    return "Completed";
  }
  if (output.includes("Skipping") && output.includes("(duplicate)")) {
    return "Skipped: (duplicate)";
  }
  return "Downloaded";
}

export function truncateTitle(title, maxLength = 30) {
  return title.slice(0, maxLength) + (title.length > maxLength ? "..." : "");
}
