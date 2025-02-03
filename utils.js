import GLib from "gi://GLib";

export function getSpotifyMetadata() {
  try {
    let [success, stdout, stderr] = GLib.spawn_command_line_sync(
      `dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify ` +
        `/org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get ` +
        `string:"org.mpris.MediaPlayer2.Player" string:"Metadata"`,
    );
    if (!success) {
      throw new Error(`Command failed: ${stderr.toString()}`);
    }
    let output = stdout.toString();
    let titleMatch = output.match(
      /xesam:title"\s+variant\s+string\s+"([^"]+)"/,
    );
    let artistMatch = output.match(
      /xesam:artist"\s+variant\s+array\s+\[\s+string\s+"([^"]+)"/,
    );
    let urlMatch = output.match(/xesam:url"\s+variant\s+string\s+"([^"]+)"/);

    let title = titleMatch ? titleMatch[1] : "";
    let artist = artistMatch ? artistMatch[1] : "";
    let url = urlMatch ? urlMatch[1] : "";

    return { title, artist, url, success: true };
  } catch (e) {
    console.error(`Error fetching Spotify metadata: ${e.message}`);
    return { title: "", artist: "", url: "", success: false };
  }
}

export function getG4MusicMetadata() {
  try {
    let [success, stdout, stderr] = GLib.spawn_command_line_sync(
      `dbus-send --print-reply --dest=com.github.neithern.g4music ` +
        `/org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get ` +
        `string:"org.mpris.MediaPlayer2.Player" string:"Metadata"`,
    );

    if (!success) {
      throw new Error(`Command failed: ${stderr.toString()}`);
    }

    let output = stdout.toString();
    let titleMatch = output.match(
      /xesam:title"\s+variant\s+string\s+"([^"]+)"/,
    );
    let artistMatch = output.match(
      /xesam:artist"\s+variant\s+array\s+\[\s+string\s+"([^"]+)"/,
    );
    let urlMatch = output.match(/mpris:artUrl"\s+variant\s+string\s+"([^"]+)"/);

    let title = titleMatch ? titleMatch[1] : "";
    let artist = artistMatch ? artistMatch[1] : "";
    let artUrl = urlMatch ? urlMatch[1] : "";

    return { title, artist, artUrl, success: true };
  } catch (e) {
    console.error(`Error fetching G4Music metadata: ${e.message}`);
    return { title: "", artist: "", artUrl: "", success: false };
  }
}

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
