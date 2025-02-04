import GLib from "gi://GLib";
import St from "gi://St";
import Clutter from "gi://Clutter";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import Gio from "gi://Gio";
import { processDownloadOutput, getSpotifyMetadata } from "./utils.js";

export default class SpotifySongDisplayExtension {
  constructor() {
    this._timeoutId = null;
    this._label = null;
    this._button = null;
    this._isDownloading = false;
    this._currentDownloadPid = null;
    this._downloadedSongs = new Set();
    this._downloadQueue = [];
    this._streams = new Map();
  }

  _updateSong = () => {
    if (this._isDownloading) return true;

    const { title, success } = getSpotifyMetadata();
    if (success && title) {
      const displayTitle = this._downloadedSongs.has(title)
        ? `${title} ✓`
        : title;
      this._label.set_text(displayTitle);
      this._button.show();
    } else {
      this._button.hide();
    }
    return true;
  };

  async _handleDownload() {
    if (this._isDownloading) {
      console.log("Download already in progress");
      return;
    }

    const { title, url } = getSpotifyMetadata();
    if (!title || !url) {
      this._label.set_text("Couldn't find song");
    }

    const truncatedTitle =
      title.slice(0, 25) + (title.length > 25 ? "..." : "");
    this._label.set_text(`Preparing: ${truncatedTitle}`);

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
      this._initiateDownload(title, url, truncatedTitle);
      return false;
    });
  }

  _initiateDownload(fullTitle, url, truncatedTitle) {
    const downloadFolder = GLib.get_home_dir() + "/Music";

    try {
      this._isDownloading = true;
      const [success, pid, , stdout, stderr] = GLib.spawn_async_with_pipes(
        null,
        ["spotdl", "--output", downloadFolder, url],
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null,
      );

      if (!success) {
        throw new Error("Failed to start spotdl");
      }

      this._currentDownloadPid = pid;
      this._setupProcessWatch(pid, fullTitle, truncatedTitle);
      this._handleOutputStream(stdout, stderr, truncatedTitle);
    } catch (error) {
      this._handleDownloadError(error);
    }
  }

  _setupProcessWatch(pid, fullTitle, truncatedTitle) {
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {
      this._isDownloading = false;
      this._currentDownloadPid = null;
      this._downloadedSongs.add(fullTitle);

      // Cleanup streams
      this._streams.forEach((stream) => stream.close());
      this._streams.clear();

      // Close the PID
      GLib.spawn_close_pid(pid);

      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
        if (!this._isDownloading) {
          const { title: currentTitle } = getSpotifyMetadata();
          if (currentTitle) {
            const displayTitle = this._downloadedSongs.has(currentTitle)
              ? `${currentTitle} ✓`
              : currentTitle;
            this._label.set_text(displayTitle);
          }
        }
        return false;
      });
    });
  }

  _handleOutputStream(stdout, stderr, truncatedTitle) {
    const createReader = (fd, isError = false) => {
      const stream = new Gio.DataInputStream({
        base_stream: new Gio.UnixInputStream({ fd, close_fd: true }),
      });

      this._streams.set(fd, stream);

      const readLine = () => {
        stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
          try {
            const [line] = stream.read_line_finish_utf8(res);
            if (line) {
              const status = processDownloadOutput(line);
              if (this._isDownloading) {
                this._label.set_text(`${truncatedTitle} -> ${status}`);
              }
              console.log(`${isError ? "Error" : "Download"}: ${line}`);
              readLine();
            }
          } catch (error) {
            console.error(
              `Error reading ${isError ? "stderr" : "stdout"}: ${error.message}`,
            );
          }
        });
      };

      readLine();
    };

    createReader(stdout);
    createReader(stderr, true);
  }

  _handleDownloadError(error) {
    this._isDownloading = false;
    this._label.set_text("Download failed");
    console.error(`Error downloading song: ${error.message}`);
  }

  enable() {
    this._downloadedSongs.clear();
    this._button = new PanelMenu.Button(0.0, "Spotify Song Display");
    this._label = new St.Label({
      text: "Loading...",
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._button.add_child(this._label);
    this._button.connect("button-press-event", () => this._handleDownload());
    Main.panel.addToStatusArea("spotify-song-display", this._button, 3, "left");
    this._button.hide();

    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
    }

    this._timeoutId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      2,
      this._updateSong,
    );
  }

  disable() {
    this._cleanup();
  }

  _cleanup() {
    if (this._timeoutId) {
      GLib.Source.remove(this._timeoutId);
      this._timeoutId = null;
    }

    if (this._currentDownloadPid) {
      try {
        GLib.spawn_async(
          null,
          ["kill", this._currentDownloadPid.toString()],
          null,
          GLib.SpawnFlags.SEARCH_PATH,
          null,
        );

        GLib.spawn_close_pid(this._currentDownloadPid);
      } catch (error) {
        console.error(`Error killing download process: ${error.message}`);
      }
    }

    // Clean up streams
    this._streams.forEach((stream) => stream.close());
    this._streams.clear();

    if (this._button) {
      this._button.destroy();
      this._button = null;
    }

    this._downloadedSongs.clear();
    this._isDownloading = false;
    this._currentDownloadPid = null;
  }
}
