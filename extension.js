import GLib from "gi://GLib";
import St from "gi://St";
import Clutter from "gi://Clutter";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import Gio from "gi://Gio";
import { processDownloadOutput, truncateTitle } from "./utils.js";
import { SpotifyDBus } from "./spotify-dbus.js";

export default class SpotifySongDisplayExtension {
  constructor() {
    this._dbus = null;
    this._label = null;
    this._button = null;
    this._isDownloading = false;
    this._currentDownloadPid = null;
    this._downloadedSongs = new Set();
    this._streams = new Map();
    this._timeouts = [];
    this._childWatches = [];
  }

  _addTimeout(fn, interval, seconds = false) {
    let id;
    if (seconds) {
      id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, fn);
    } else {
      id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, fn);
    }
    this._timeouts.push(id);
    return id;
  }

  _removeTimeouts() {
    this._timeouts.forEach((id) => GLib.Source.remove(id));
    this._timeouts = [];
  }

  _removeChildWatches() {
    this._childWatches.forEach((id) => GLib.Source.remove(id));
    this._childWatches = [];
  }

  updateLabel() {
    if (this._isDownloading) return;

    if (!this._dbus.spotifyIsActive()) {
      this._button.hide();
      return;
    }

    const metadata = this._dbus.getMetadata();
    if (metadata.success && metadata.title) {
      const displayTitle = this._downloadedSongs.has(metadata.title)
        ? `${truncateTitle(metadata.title)} ✓`
        : truncateTitle(metadata.title);
      this._label.set_text(displayTitle);
      this._button.show();
    } else {
      this._button.hide();
    }
  }

  async _handleDownload() {
    if (this._isDownloading) {
      log("Download already in progress");
      return;
    }

    const metadata = this._dbus.getMetadata();
    if (!metadata.success || !metadata.title || !metadata.url) {
      this._label.set_text("Couldn't find song");
      return;
    }

    this._label.set_text(`Preparing: ${truncateTitle(metadata.title)}`);

    this._addTimeout(() => {
      this._initiateDownload(metadata.title, metadata.url);
      return false;
    }, 50);
  }

  _initiateDownload(fullTitle, url) {
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
      this._setupProcessWatch(pid, fullTitle);
      this._handleOutputStream(stdout, stderr, truncateTitle(fullTitle));
    } catch (error) {
      this._handleDownloadError(error);
    }
  }

  _setupProcessWatch(pid, fullTitle) {
    let childWatchId = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {
      this._isDownloading = false;
      this._currentDownloadPid = null;
      this._downloadedSongs.add(fullTitle);

      this._streams.forEach((stream, fd) => {
        if (!stream.is_closed()) {
          try {
            stream.close(null);
          } catch (error) {
            logError(error, "Error closing stream");
          }
        }
      });
      this._streams.clear();

      GLib.spawn_close_pid(pid);

      this._addTimeout(() => {
        if (!this._isDownloading) {
          this.updateLabel();
        }
        return false;
      }, 2000);
    });
    this._childWatches.push(childWatchId);
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
              log(`${isError ? "Error" : "Download"}: ${line}`);
              readLine();
            }
          } catch (error) {
            logError(error, `Error reading ${isError ? "stderr" : "stdout"}`);
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
    logError(error, "Error downloading song");
  }

  enable() {
    this._button = new PanelMenu.Button(0.0, "Spotify Song Display");
    this._label = new St.Label({
      text: "Loading...",
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._button.add_child(this._label);
    this._button.connect("button-press-event", () => this._handleDownload());
    Main.panel.addToStatusArea("spotify-song-display", this._button, 3, "left");
    this._button.hide();

    this._dbus = new SpotifyDBus(this);
    this._addTimeout(() => {
      this.updateLabel();
      return true;
    }, 2000);
  }

  disable() {
    this._removeTimeouts();
    this._removeChildWatches();

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
        logError(error, "Error killing download process");
      }
      this._currentdownloadpid = null;
    }

    this._streams.forEach((stream, fd) => {
      if (!stream.is_closed()) {
        try {
          stream.close(null);
        } catch (error) {
          logError(error, "Error closing stream");
        }
      }
    });
    this._streams.clear();

    if (this._button) {
      this._button.destroy();
      this._button = null;
    }

    this._downloadedSongs.clear();
    this._isDownloading = false;
    this._dbus = null;
  }
}
